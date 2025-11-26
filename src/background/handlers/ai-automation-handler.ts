/**
 * AI Automation handler for ChatGPT, Claude, and Perplexity
 * Manages AI tab lifecycle, content script injection, and prompt execution
 */

import { sendRuntimeMessageFireAndForget } from '../utils/message-utils'
import { urlsMatch, focusOrOpenUrl } from '../utils/url-utils'
import { TIMING, MESSAGES, AI_PROVIDER_URLS } from '../constants'
import type { DIContainer } from '../container'
import {
  AIRunPromptRequest,
  AIExecutePromptRequest,
  AIProgressUpdate,
  AIResult,
  AIError,
  AIAutomationSettings,
  AI_MESSAGE_TYPES
} from '../../shared/messaging/ai-types'

// Track AI automation tabs by provider
export const aiAutomationTabs = new Map<string, number>()

// Track active automation requests for contextual logging
const aiAutomationRequests = new Map<string, {
  prompt: string
  provider: string
  task?: string
}>()

/**
 * Get AI automation settings from background store
 * @param container - DI container for accessing background store
 * @returns AI automation settings with fallback to defaults
 */
export async function getAISettings(container: DIContainer): Promise<AIAutomationSettings> {
  const userSettings = container.backgroundStore?.user?.settings
  const defaultSettings = (await import('../../shared/messaging/ai-types')).getDefaultAISettings()
  return userSettings?.aiAutomation || defaultSettings
}

/**
 * Find or create a tab for the specified AI provider
 * @param provider - AI provider (chatgpt, claude, perplexity)
 * @param container - DI container
 * @returns Chrome tab
 */
export async function findOrCreateAITab(
  provider: 'chatgpt' | 'claude' | 'perplexity',
  container: DIContainer
): Promise<chrome.tabs.Tab> {
  const settings = await getAISettings(container)
  console.log('[AI Automation] Settings:', { reuseTab: settings.reuseTab })

  const targetUrl = AI_PROVIDER_URLS[provider]

  // Check if we should reuse existing tab
  if (settings.reuseTab) {
    const existingTabId = aiAutomationTabs.get(provider)
    if (existingTabId) {
      try {
        const tab = await chrome.tabs.get(existingTabId)
        if (tab && tab.url?.includes(targetUrl)) {
          console.log('[AI Automation] Reusing existing tab and focusing it')
          // Always focus the tab so users know automation is running
          await chrome.tabs.update(existingTabId, { active: true })
          await chrome.windows.update(tab.windowId!, { focused: true })
          return tab
        }
      } catch {
        // Tab no longer exists, remove from tracking
        aiAutomationTabs.delete(provider)
      }
    }

    // Fallback: scan current tabs that match provider URL
    try {
      const candidateTabs = await chrome.tabs.query({})
      const matchingTab = candidateTabs.find(tab => {
        const candidateUrl = tab.url || (tab as any).pendingUrl
        if (!candidateUrl) return false
        try {
          const hostname = new URL(candidateUrl).hostname
          const targetHostname = new URL(targetUrl).hostname
          return hostname === targetHostname || hostname.endsWith(`.${targetHostname}`)
        } catch {
          return candidateUrl.includes(targetUrl)
        }
      })

      if (matchingTab && matchingTab.id != null) {
        aiAutomationTabs.set(provider, matchingTab.id)
        // Always focus the tab so users know automation is running
        await chrome.tabs.update(matchingTab.id, { active: true })
        await chrome.windows.update(matchingTab.windowId!, { focused: true })
        console.log('[AI Automation] Reusing detected provider tab:', matchingTab.id)
        return matchingTab
      }
    } catch (error) {
      console.warn('[AI Automation] Failed to query existing tabs for reuse:', error)
    }
  }

  // Create new tab and always focus it so users know automation is running
  console.log('[AI Automation] Creating focused tab for:', targetUrl)
  const tab = await focusOrOpenUrl(targetUrl)

  aiAutomationTabs.set(provider, tab.id!)
  console.log('[AI Automation] Tab created:', { id: tab.id, active: tab.active })
  return tab
}

/**
 * Inject AI content script into the specified tab
 * @param tabId - Chrome tab ID
 */
export async function injectAIContentScript(tabId: number): Promise<void> {
  try {
    console.log(`[AI Injection] Starting injection for tab ${tabId}`)

    // Check if content script is already injected
    const checkResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        hasBridge: window.hasOwnProperty('superowserAIBridge'),
        bridgeValue: (window as any).superowserAIBridge,
        url: window.location.href
      })
    })

    const checkResult = checkResults[0]?.result
    console.log(`[AI Injection] Pre-injection check:`, checkResult)

    if (checkResult?.hasBridge) {
      console.log(`[AI Injection] Script already injected for tab ${tabId}`)
      return // Already injected
    }

    // Inject the AI automation content script
    console.log(`[AI Injection] Injecting ai-bridge.js for tab ${tabId}`)

    try {
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['assets/ai-bridge.js']
      })
      console.log(`[AI Injection] Injection results:`, injectionResults)
    } catch (injectionError) {
      console.error(`[AI Injection] Failed to inject script:`, injectionError)
      throw injectionError
    }

    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, TIMING.AI_INJECTION_WAIT_MS))

    // Verify injection was successful
    const verifyResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        hasBridge: window.hasOwnProperty('superowserAIBridge'),
        bridgeValue: (window as any).superowserAIBridge,
        url: window.location.href,
        scriptTags: Array.from(document.querySelectorAll('script')).length
      })
    })

    const verifyResult = verifyResults[0]?.result
    console.log(`[AI Injection] Post-injection verification:`, verifyResult)

    if (!verifyResult?.hasBridge) {
      throw new Error(`${MESSAGES.AI_BRIDGE_NOT_FOUND}. URL: ${verifyResult?.url}`)
    }

    console.log(`[AI Injection] Successfully injected and verified for tab ${tabId}`)
  } catch (error) {
    console.error(`[AI Injection] Failed for tab ${tabId}:`, error)
    throw new Error(`Failed to inject AI content script: ${error}`)
  }
}

/**
 * Send progress update to UI
 */
async function sendProgressUpdate(
  requestId: string,
  status: AIProgressUpdate['status'],
  message: string,
  partialContent?: string
): Promise<void> {
  const progressUpdate: AIProgressUpdate = {
    requestId,
    status,
    message,
    partialContent,
    timestamp: Date.now()
  }

  sendRuntimeMessageFireAndForget({
    type: AI_MESSAGE_TYPES.AI_PROGRESS,
    data: progressUpdate
  })
}

/**
 * Handle AI prompt execution request
 * @param request - AI prompt request
 * @param container - DI container
 * @returns Request ID for tracking
 */
export async function handleAIRunPrompt(
  request: AIRunPromptRequest,
  container: DIContainer
): Promise<{ requestId: string }> {
  const requestId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const settings = await getAISettings(container)
    console.log('[AI Automation] handleAIRunPrompt called with settings:', settings)

    if (!settings.enabled) {
      throw new Error(MESSAGES.AI_AUTOMATION_DISABLED)
    }

    // Track request context for later result logging
    aiAutomationRequests.set(requestId, {
      prompt: request.prompt,
      provider: settings.provider,
      task: request.context?.currentTask
    })

    // Send initial progress update
    await sendProgressUpdate(requestId, 'opening_tab', 'Opening AI provider tab...')

    // Find or create AI tab
    console.log('[AI Automation] Creating tab for provider:', settings.provider)
    const tab = await findOrCreateAITab(settings.provider, container)
    console.log('[AI Automation] Tab created/found:', { id: tab.id, active: tab.active })

    // Wait for tab to finish loading
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(MESSAGES.TAB_LOADING_TIMEOUT)),
        settings.timeout
      )

      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout)
          chrome.tabs.onUpdated.removeListener(listener)
          resolve()
        }
      }

      chrome.tabs.onUpdated.addListener(listener)

      // If tab is already complete, resolve immediately
      if (tab.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    })

    await sendProgressUpdate(requestId, 'injecting_script', 'Preparing automation...')

    // Inject content script
    await injectAIContentScript(tab.id!)

    // Check tab state after injection
    const tabAfterInjection = await chrome.tabs.get(tab.id!)
    console.log('[AI Automation] Tab state after injection:', {
      id: tabAfterInjection.id,
      active: tabAfterInjection.active
    })

    await sendProgressUpdate(requestId, 'sending_prompt', 'Sending prompt to AI...')

    // Send execution request to content script
    const executeRequest: AIExecutePromptRequest = {
      prompt: request.prompt,
      selectors: settings.selectors,
      requestId
    }

    await chrome.tabs.sendMessage(tab.id!, {
      type: AI_MESSAGE_TYPES.AI_EXECUTE_PROMPT,
      data: executeRequest
    })

    return { requestId }
  } catch (error) {
    // Send error response
    const aiError: AIError = {
      requestId,
      reason: 'network_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error
    }

    sendRuntimeMessageFireAndForget({
      type: AI_MESSAGE_TYPES.AI_ERROR,
      data: aiError
    })

    throw error
  }
}

/**
 * Handle messages from AI bridge content scripts
 */
export function handleAIBridgeMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  container: DIContainer
): void {
  switch (message.type) {
    case AI_MESSAGE_TYPES.AI_PROGRESS:
      sendRuntimeMessageFireAndForget(message)
      break
    case AI_MESSAGE_TYPES.AI_RESULT:
      sendRuntimeMessageFireAndForget(message)
      recordAIResult(message.data as AIResult, container)
      break
    case AI_MESSAGE_TYPES.AI_ERROR:
      sendRuntimeMessageFireAndForget(message)
      recordAIError(message.data as AIError, container)
      handleAutomationComplete({ requestId: message.data.requestId, success: false }, sender, container)
      break
    case AI_MESSAGE_TYPES.AI_AUTOMATION_COMPLETE:
      handleAutomationComplete(message.data, sender, container)
      break
    default:
      console.warn('Unknown AI bridge message type:', message.type)
  }
}

/**
 * Handle automation completion (for auto-close functionality)
 */
async function handleAutomationComplete(
  data: { requestId: string; success: boolean },
  sender: chrome.runtime.MessageSender,
  container: DIContainer
): Promise<void> {
  const settings = await getAISettings(container)
  const requestInfo = aiAutomationRequests.get(data.requestId)

  // Ensure request metadata is cleared
  aiAutomationRequests.delete(data.requestId)

  if (settings.autoCloseTab && data.success && sender.tab?.id) {
    // Wait for user to see the result, then close the tab
    setTimeout(async () => {
      try {
        await chrome.tabs.remove(sender.tab!.id!)

        // Remove from tracking
        for (const [provider, tabId] of aiAutomationTabs.entries()) {
          if (tabId === sender.tab!.id) {
            aiAutomationTabs.delete(provider)
            break
          }
        }
      } catch (error) {
        console.warn('Failed to auto-close AI tab:', error)
      }
    }, TIMING.AI_AUTO_CLOSE_DELAY_MS)
  }
}

/**
 * Record AI result in chat history
 */
function recordAIResult(result: AIResult, container: DIContainer): void {
  if (!result?.requestId) {
    return
  }

  const metadata = aiAutomationRequests.get(result.requestId)

  const prompt = (metadata?.prompt || '').trim()
  const provider = metadata?.provider || 'chatgpt'
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

  const headerCommand = prompt ? `/ai ${prompt}` : '/ai'
  const content = result.content?.trim() || '(No response received)'

  const formatted = `> ${headerCommand}\n\n${content}\n\n— ${providerLabel}`

  try {
    container.backgroundStore?.addExtensionChat?.({
      content: formatted,
      command: 'ai',
      relatedTask: metadata?.task
    })
  } catch (error) {
    console.warn('[AI Automation] Failed to record AI result in chat history:', error)
  }
}

/**
 * Record AI error in chat history
 */
function recordAIError(error: AIError, container: DIContainer): void {
  if (!error?.requestId) {
    return
  }

  const metadata = aiAutomationRequests.get(error.requestId)

  const prompt = (metadata?.prompt || '').trim()
  const provider = metadata?.provider || 'chatgpt'
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

  const headerCommand = prompt ? `/ai ${prompt}` : '/ai'
  const details = error.message || 'Unknown automation error'
  const reason = error.reason ? ` (${error.reason})` : ''

  const formatted = `> ${headerCommand}\n\n❌ ${details}${reason}\n\n— ${providerLabel}`

  try {
    container.backgroundStore?.addExtensionChat?.({
      content: formatted,
      command: 'ai',
      relatedTask: metadata?.task
    })
  } catch (recordingError) {
    console.warn('[AI Automation] Failed to record AI error in chat history:', recordingError)
  }
}

/**
 * Update AI automation settings
 */
export async function updateAISettings(
  updates: Partial<AIAutomationSettings>,
  container: DIContainer
): Promise<void> {
  const currentSettings = await getAISettings(container)
  const newSettings = { ...currentSettings, ...updates }

  await container.backgroundStore?.updateAIAutomationSettings?.(newSettings)
}

/**
 * Update AI selectors for a specific provider
 */
export async function updateAISelectors(
  provider: string,
  selectors: Partial<AIAutomationSettings['selectors']>,
  container: DIContainer
): Promise<void> {
  const settings = await getAISettings(container)
  const newSelectors = { ...settings.selectors, ...selectors }

  await updateAISettings({ selectors: newSelectors }, container)
}

/**
 * Test AI selectors on a provider tab
 */
export async function testAISelectors(
  provider: string,
  selectors: AIAutomationSettings['selectors'],
  container: DIContainer
): Promise<{ success: boolean; found: string[]; missing: string[] }> {
  try {
    const tab = await findOrCreateAITab(provider as 'chatgpt' | 'claude' | 'perplexity', container)
    await injectAIContentScript(tab.id!)

    // Test selectors via content script
    const result = await chrome.tabs.sendMessage(tab.id!, {
      type: 'TEST_SELECTORS',
      data: { selectors }
    })

    return result
  } catch (error) {
    throw new Error(`Failed to test selectors: ${error}`)
  }
}
