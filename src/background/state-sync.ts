// State synchronization mechanism between background and side panel

import { useBackgroundStore } from './stores/background-store'

export interface StateUpdateMessage {
  type: 'STATE_UPDATE'
  path: string
  value: any
  timestamp: string
}

export interface StateRequestMessage {
  type: 'STATE_REQUEST'
  paths: string[]
}

export interface StateBroadcastMessage {
  type: 'STATE_BROADCAST'
  updates: Array<{
    path: string
    value: any
  }>
  timestamp: string
}

// Initialize state synchronization in background script
export function initializeStateSync() {
  const backgroundStore = useBackgroundStore()

  // Listen for state requests from side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_REQUEST') {
      handleStateRequest(message, sendResponse)
      return true // Will respond asynchronously
    }

    if (message.type === 'ADD_EXTENSION_SEARCH') {
      backgroundStore.addExtensionSearch(message.data)
      sendResponse({ type: 'SUCCESS', data: { success: true } })
      return false
    }

    if (message.type === 'EXTENSION_CHAT') {
      backgroundStore.addExtensionChat(message.data)
      sendResponse({ type: 'SUCCESS', data: { success: true } })
      return false
    }

    if (message.type === 'GET_RECENT_PAGES') {
      // This is now handled in the main message handler in index.ts
      // through container.pageUseCases.getRecentPages()
      return false
    }

    // Don't handle other message types here
    return false
  })

  // Subscribe to store changes for automatic broadcasting
  backgroundStore.$subscribe((mutation, state) => {
    // Only broadcast certain shared state changes
    const sharedPaths = [
      'user.currentTask',
      'user.previousTask',
      'user.workingSet',
      'user.extensionSearchHistory',
      'user.extensionChatHistory',
      'browser.browserSearchHistory',
      'browser.browserChatHistory',
      'browser.currentTab',
      'browser.currentUrl'
    ]

    const mutationPath = `${mutation.storeId}.${mutation.payload?.path || ''}`

    if (sharedPaths.some(path => mutationPath.startsWith(path))) {
      broadcastStateUpdate(mutationPath, getNestedValue(state, mutationPath))
    }
  })

  // Listen for tab updates to update browser state
  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        backgroundStore.updateCurrentTab(tab)
      }
    })
  }

  // Listen for tab activation
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId)
        if (tab) {
          backgroundStore.updateCurrentTab(tab)
        }
      } catch (error) {
        console.warn('Failed to get active tab:', error)
      }
    })
  }

  // Detect chat messages from specific platforms
  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        detectChatPlatform(tab, backgroundStore)
      }
    })
  }
}

function handleStateRequest(
  message: StateRequestMessage,
  sendResponse: (response: any) => void
) {
  try {
    const backgroundStore = useBackgroundStore()
    const stateData: any = {}

    for (const path of message.paths) {
      stateData[path] = getNestedValue(backgroundStore.$state, path)
    }

    sendResponse({
      type: 'SUCCESS',
      data: stateData
    })
  } catch (error) {
    sendResponse({
      type: 'ERROR',
      error: {
        message: error.message,
        details: error.stack
      }
    })
  }
}

function broadcastStateUpdate(path: string, value: any) {
  const message: StateUpdateMessage = {
    type: 'STATE_UPDATE',
    path,
    value,
    timestamp: new Date().toISOString()
  }

  // Try to send to all extension contexts
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors - side panel might not be open
    })
  } catch (error) {
    // Extension context might not be available
    console.debug('Failed to broadcast state update:', error)
  }
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }

  return current
}

function detectChatPlatform(tab: chrome.tabs.Tab, backgroundStore: any) {
  if (!tab.url || !backgroundStore.user.settings.autoDetectChatMessages) {
    return
  }

  const chatPlatforms = {
    'chat.openai.com': 'chatgpt',
    'claude.ai': 'claude',
    'bard.google.com': 'bard',
    'copilot.microsoft.com': 'copilot'
  }

  let platform: keyof typeof chatPlatforms | 'other' = 'other'

  for (const [domain, platformName] of Object.entries(chatPlatforms)) {
    if (tab.url.includes(domain)) {
      platform = platformName as keyof typeof chatPlatforms
      break
    }
  }

  // If we detected a chat platform, we could inject a content script
  // to extract chat messages, but for now we'll just note the platform
  if (platform !== 'other') {
    console.debug(`Detected chat platform: ${platform} on ${tab.url}`)

    // Could inject content script here to extract messages
    // chrome.scripting.executeScript({
    //   target: { tabId: tab.id },
    //   files: ['content-scripts/chat-extractor.js']
    // })
  }
}

// Utility function for side panel to request initial state
export async function requestInitialState(paths: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const message: StateRequestMessage = {
      type: 'STATE_REQUEST',
      paths
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (response?.type === 'ERROR') {
        reject(new Error(response.error.message))
        return
      }

      resolve(response.data)
    })
  })
}

// Setup state sync listener in side panel
export function setupSidePanelStateSync(store: any) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      handleStateUpdate(message, store)
    }
  })
}

function handleStateUpdate(message: StateUpdateMessage, store: any) {
  try {
    // Map background state paths to side panel cache paths
    const pathMappings: Record<string, string> = {
      'background.user.currentTask': 'currentTask',
      'background.user.previousTask': 'previousTask',
      'background.user.workingSet': 'workingSet',
      'background.user.extensionSearchHistory': 'recentSearches',
      'background.user.extensionChatHistory': 'recentChats',
      'background.browser.browserSearchHistory': 'recentSearches',
      'background.browser.browserChatHistory': 'recentChats',
      'background.browser.currentUrl': 'currentTabInfo.url',
    }

    const mappedPath = pathMappings[message.path]
    if (mappedPath) {
      store.updateCache(mappedPath, message.value)
    }
  } catch (error) {
    console.warn('Failed to handle state update:', error)
  }
}