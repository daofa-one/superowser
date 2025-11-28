/**
 * Message handler for Chrome runtime messaging
 * Routes messages between extension contexts and executes commands
 */

import {
  RequestMessage,
  ResponseMessage,
  SuccessResponse,
  ErrorResponse,
  isRequestMessage
} from '../messaging/message-types'
import { AI_MESSAGE_TYPES } from '../../shared/messaging/ai-types'
import {
  handleAIBridgeMessage,
  handleAIRunPrompt,
  getAISettings,
  updateAISettings,
  updateAISelectors,
  testAISelectors,
  findOrCreateAITab,
  injectAIContentScript
} from './ai-automation-handler'
import { getCurrentTab } from './tab-handler'
import { focusOrOpenUrl } from '../utils/url-utils'
import { formatCommandResponseForChat } from '../../shared/commands/formatters'
import type { DIContainer } from '../container'

/**
 * Initialize runtime message listener
 * @param container - DI container for accessing services
 */
export function initializeMessageHandler(container: DIContainer): void {
  chrome.runtime.onMessage.addListener((message: any, sender, sendResponse: (response?: any) => void) => {
    console.log('[Background] Received message:', {
      type: message.type,
      id: message.id,
      hasData: !!message.data,
      sender: sender.tab ? `tab:${sender.tab.id}` : 'extension',
      timestamp: Date.now()
    })

    // Handle AI bridge messages (from content scripts) - exclude AI_RUN_PROMPT which is a command request
    const aiBridgeMessageTypes = [
      AI_MESSAGE_TYPES.AI_PROGRESS,
      AI_MESSAGE_TYPES.AI_RESULT,
      AI_MESSAGE_TYPES.AI_ERROR,
      AI_MESSAGE_TYPES.AI_AUTOMATION_COMPLETE
    ]
    if (message.type && aiBridgeMessageTypes.includes(message.type)) {
      console.log('[Background] Routing to AI bridge handler:', message.type)
      handleAIBridgeMessage(message, sender, container)
      sendResponse({ success: true })
      return true
    }

    if (!isRequestMessage(message)) {
      console.log('[Background] Invalid message format:', {
        type: message.type,
        isString: typeof message.type === 'string',
        isSuccessOrError: message.type === 'SUCCESS' || message.type === 'ERROR',
        message
      })
      sendResponse({
        type: 'ERROR',
        error: { message: 'Invalid message format' }
      } as ErrorResponse)
      return true
    }

    console.log('[Background] Valid request message, routing to handleMessage:', message.type)

    // Handle message asynchronously
    handleMessage(message, container)
      .then((response: ResponseMessage) => {
        console.log('[Background] ← Success response for:', message.type, response)
        sendResponse(response)
      })
      .catch((error: Error) => {
        console.log('[Background] ← Error response for:', message.type, error.message)
        sendResponse({
          type: 'ERROR',
          id: message.id,
          error: {
            message: error.message,
            details: error.stack
          }
        } as ErrorResponse)
      })

    // Return true to indicate we'll respond asynchronously
    return true
  })
}

/**
 * Ensure container has required services
 */
function ensureContainerServices(container: DIContainer): void {
  if (!container.pageUseCases) {
    throw new Error('Container pageUseCases not initialized')
  }
  if (!container.backgroundStore) {
    throw new Error('Container backgroundStore not initialized')
  }
}

/**
 * Handle incoming messages and route to appropriate handlers
 */
async function handleMessage(message: RequestMessage, container: DIContainer): Promise<ResponseMessage> {
  try {
    console.log('[Background] handleMessage called with type:', message.type)

    // Ensure critical services are available for most operations
    // (Skip for simple GET operations that don't modify state)
    const writeOperations = ['SAVE_PAGE', 'SAVE_CURRENT_TAB', 'SAVE_NOTE', 'UPDATE_PAGE',
                             'DELETE_PAGE', 'CREATE_TASK', 'DELETE_TASK', 'EXTENSION_CHAT']
    if (writeOperations.includes(message.type)) {
      ensureContainerServices(container)
    }

    let data: any

    switch (message.type) {
      case 'SAVE_PAGE':
        {
          const activeSearchContext = message.data?.searchContext
            ? message.data.searchContext
            : container.backgroundStore?.getActiveSearchContext?.()

          data = await container.pageUseCases.savePage({
            ...message.data,
            searchContext: activeSearchContext
          })
        }
        break

      case 'SAVE_CURRENT_TAB':
        const currentTab = await getCurrentTab()
        if (!currentTab) {
          throw new Error('No active tab found')
        }

        {
          const activeSearchContext = message.data?.searchContext
            ? message.data.searchContext
            : container.backgroundStore?.getActiveSearchContext?.()

          data = await container.pageUseCases.savePage({
            url: currentTab.url,
            title: currentTab.title,
            favicon: currentTab.favicon,
            ...message.data,
            searchContext: activeSearchContext
          })
        }
        break

      case 'SAVE_NOTE':
        data = await container.taskUseCases.saveNote(message.data)
        break

      case 'GET_PAGE':
        data = await container.pageService.getById(message.data.id)
        break

      case 'GET_PAGE_BY_URL':
        data = await container.pageService.getByUrl(message.data.url)
        break

      case 'GET_PAGE_BY_SHORTCUT':
        data = await container.pageUseCases.openByShortcut(message.data.shortcut)
        break

      case 'SEARCH':
        data = await container.searchService.search(message.data)
        break

      case 'OMNIBOX_COMMAND':
        data = await container.searchUseCases.executeOmniboxCommand(message.data.input)
        break

      case 'GET_TASKS':
        data = await container.taskUseCases.getAllTasksWithStats()
        break

      case 'SET_ACTIVE_TASK':
        data = await container.taskUseCases.setActiveTask(message.data.taskName)
        break

      case 'GET_ACTIVE_TASK':
        data = await container.taskUseCases.getActiveTask()
        break

      case 'CREATE_TASK':
        data = await container.taskUseCases.createTask(message.data.name, message.data.description)
        break

      case 'DELETE_TASK':
        await container.taskUseCases.deleteTaskAndCleanup(message.data.taskName)
        data = { success: true }
        break

      case 'GET_TASK_CONTENT':
        data = await container.taskUseCases.getTaskWithContent(message.data.taskName)
        break

      case 'GET_RECENT_PAGES':
        data = await container.pageUseCases.getRecentPages(20)
        break

      case 'MOVE_PAGE_TO_TASK':
        data = await container.pageUseCases.movePageToTask(message.data.pageId, message.data.taskName)
        break

      case 'GET_NOTES_BY_PAGE':
        data = await container.notesUseCases.getNotesByPage(message.data.pageId)
        break

      case 'GET_ALL_NOTES':
        data = await container.notesUseCases.getAllNotes()
        break

      case 'UPDATE_NOTE':
        const { id, ...updates } = message.data
        data = await container.notesUseCases.updateNote(id, updates)
        break

      case 'DELETE_NOTE':
        await container.notesUseCases.deleteNote(message.data.id)
        data = { success: true }
        break

      case 'UPDATE_PAGE':
        data = await container.pageUseCases.updatePage(message.data.id, message.data.updates)
        break

      case 'DELETE_PAGE':
        await container.pageUseCases.deletePageAndCleanup(message.data.id)
        data = { success: true }
        break

      // Document-related handlers
      case 'GET_DOCUMENT':
        data = await container.documentsUseCases.getDocument(message.data.documentId, {
          versionLimit: message.data?.versionLimit
        })
        break

      case 'CREATE_DOCUMENT':
        data = await container.documentsUseCases.createDocument(message.data)
        break

      case 'UPDATE_DOCUMENT':
        data = await container.documentsUseCases.updateDocument(message.data.documentId, message.data.updates)
        break

      case 'DELETE_DOCUMENT':
        await container.documentsUseCases.deleteDocument(message.data.documentId)
        data = { success: true }
        break

      case 'SAVE_DOCUMENT_VERSION':
        data = await container.documentsUseCases.createVersion(message.data)
        break

      case 'DELETE_DOCUMENT_VERSION':
        await container.documentsUseCases.deleteVersion(message.data.versionId)
        data = { success: true }
        break

      case 'UPDATE_DOCUMENT_VERSION':
        data = await container.documentsUseCases.updateVersion(message.data.versionId, message.data.updates)
        break

      case 'DUPLICATE_DOCUMENT_VERSION':
        data = await container.documentsUseCases.duplicateVersion(message.data.versionId, message.data.options)
        break

      case 'GET_TASK_DOCUMENTS':
        data = await container.documentsUseCases.listDocumentsByTask(message.data.taskId)
        break

      case 'GET_TASK':
        data = await container.taskUseCases.getTaskById(message.data.taskId)
        break

      case 'GET_TASK_PAGES':
        data = await container.taskUseCases.getPagesByTaskId(message.data.taskId)
        break

      case 'GET_TASK_NOTES':
        data = await container.taskUseCases.getNotesByTaskId(message.data.taskId)
        break

      case 'GET_CURRENT_TAB_INFO':
        data = await getCurrentTab()
        break

      case 'GET_EXTENSION_CHAT_HISTORY':
        data = container.backgroundStore?.user.extensionChatHistory
        break

      case 'GET_COMMAND_SUGGESTIONS':
        try {
          const input = message.data?.input ?? ''
          const cursorPosition = message.data?.cursorPosition ?? input.length
          if (typeof input === 'string' && input.startsWith('/')) {
            const commandContext = container.commandService.createContext('chatbox', {
              activeTask: container.analyticsService.getCurrentContext().activeTask,
              recentTags: container.analyticsService.getCurrentContext().recentTags
            })

            data = await container.commandService.getSuggestions(input, commandContext, cursorPosition)
          } else {
            data = []
          }
        } catch (error) {
          console.error('Error generating chatbox command suggestions:', error)
          data = []
        }
        break

      case 'EXTENSION_CHAT':
        try {
          if (!container.backgroundStore || !container.backgroundStore.addExtensionChat) {
            throw new Error('Background store or addExtensionChat method not available')
          }

          const chatContent: string = message.data?.content ?? ''
          const trimmedContent = chatContent.trim()

          if (trimmedContent.startsWith('/')) {
            const commandContext = container.commandService.createContext('chatbox', {
              activeTask: container.analyticsService.getCurrentContext().activeTask,
              recentTags: container.analyticsService.getCurrentContext().recentTags
            })

            const commandRequest = {
              input: trimmedContent,
              context: commandContext,
              timestamp: new Date()
            }

            const response = await container.commandService.processCommand(commandRequest)

            const [rawCommand] = trimmedContent.slice(1).split(/\s+/)
            const commandName = rawCommand?.toLowerCase()

            let displayResponse = response
            if (commandName === 'help' || commandName === '?' || commandName === 'h') {
              const commandArgs = trimmedContent.slice(1).split(/\s+/).slice(1)
              const helpTarget = commandArgs.join(' ') || undefined
              const helpText = container.commandService.getHelp(helpTarget)
              displayResponse = {
                success: true,
                type: 'text',
                content: helpText,
                followUp: response.followUp,
                metadata: response.metadata
              }
            }

            // Check if this is a component-based response
            const isComponentResponse = displayResponse.type === 'task-list' || displayResponse.type === 'task-creator'

            if (isComponentResponse) {
              // For component responses, store the component data
              const componentContent = `> ${trimmedContent}\n\n${displayResponse.content}`

              container.backgroundStore.addExtensionChat({
                content: componentContent,
                command: commandName,
                relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask,
                componentData: displayResponse.componentData || displayResponse,
                responseType: displayResponse.type
              })
            } else {
              // For text responses, use the existing formatter
              const formattedContent = formatCommandResponseForChat(trimmedContent, displayResponse)

              container.backgroundStore.addExtensionChat({
                content: formattedContent,
                command: commandName,
                relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask
              })
            }
          } else {
            container.backgroundStore.addExtensionChat({
              content: chatContent,
              command: message.data?.command,
              relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask
            })
          }

          data = { success: true }
        } catch (error) {
          console.error('Chat command processing failed:', error)
          data = { success: false, error: error instanceof Error ? error.message : String(error) }
        }
        break

      case 'GET_USER_SETTINGS':
        if (!container.backgroundStore?.user) {
          throw new Error('Background store not initialized')
        }
        data = container.backgroundStore.user.settings
        break

      case 'UPDATE_USER_SETTINGS':
        if (!container.backgroundStore) {
          throw new Error('Background store not initialized')
        }
        if (message.data?.preferredSearchEngine && container.backgroundStore.setPreferredSearchEngine) {
          await container.backgroundStore.setPreferredSearchEngine(message.data.preferredSearchEngine)
        }
        if (message.data?.preferredAiProvider && container.backgroundStore.setPreferredAiProvider) {
          await container.backgroundStore.setPreferredAiProvider(message.data.preferredAiProvider)
        }
        if (typeof message.data?.reuseAiTab === 'boolean' && container.backgroundStore.setAiTabReusePreference) {
          await container.backgroundStore.setAiTabReusePreference(message.data.reuseAiTab)
        }
        if (typeof message.data?.aiLogLevel === 'string' && ['info', 'debug'].includes(message.data.aiLogLevel) && container.backgroundStore.setAiLogLevelPreference) {
          await container.backgroundStore.setAiLogLevelPreference(message.data.aiLogLevel)
        }
        data = container.backgroundStore.user.settings
        break

      case 'UPDATE_VERSION_MANAGEMENT_SETTINGS':
        if (!container.backgroundStore?.updateVersionManagementSettings) {
          throw new Error('updateVersionManagementSettings method not available')
        }
        await container.backgroundStore.updateVersionManagementSettings(message.data)
        data = container.backgroundStore.user.settings
        break

      case 'OPEN_PAGE':
        await focusOrOpenUrl(message.data.url)
        data = { success: true }
        break

      case 'GET_SEARCH_SUGGESTIONS':
        data = await container.searchUseCases.getSearchSuggestions(message.data.query)
        break

      case 'GET_POPULAR_TAGS':
        data = await container.searchUseCases.getPopularTags(message.data?.limit)
        break

      case 'EXPORT_DATA':
        // TODO: Implement data export
        data = { message: 'Export not yet implemented' }
        break

      case 'IMPORT_DATA':
        // TODO: Implement data import
        data = { message: 'Import not yet implemented' }
        break

      case 'SAVE_SHORTCUT':
        // Save or update page with shortcut
        const existingPage = await container.pageService.getByUrl(message.data.url)
        if (existingPage) {
          // Update existing page with shortcut
          data = await container.pageService.update(existingPage.id, {
            shortcut: message.data.shortcut
          })
        } else {
          // Create new page entry with shortcut
          const currentTab = await getCurrentTab()
          data = await container.pageUseCases.savePage({
            url: message.data.url,
            title: currentTab?.title || 'Untitled',
            favicon: currentTab?.favicon,
            shortcut: message.data.shortcut,
            tags: []
          })
        }
        break

      case 'SAVE_TAGS':
        // Save or update page with tags
        const pageForTags = await container.pageService.getByUrl(message.data.url)
        if (pageForTags) {
          // Update existing page with tags
          data = await container.pageService.update(pageForTags.id, {
            tags: message.data.tags
          })
        } else {
          // Create new page entry with tags
          const currentTab = await getCurrentTab()
          data = await container.pageUseCases.savePage({
            url: message.data.url,
            title: currentTab?.title || 'Untitled',
            favicon: currentTab?.favicon,
            tags: message.data.tags
          })
        }
        break

      case 'REMOVE_PAGE_FROM_TASK':
        await container.taskUseCases.removePageFromTask(message.data.taskName, message.data.pageId)
        data = { success: true }
        break

      case 'OPEN_AUTHORING_WORKSPACE':
        {
          const { documentId, taskId } = message.data
          const workspaceUrl = chrome.runtime.getURL('/authoring/index.html') +
            `?documentId=${documentId}` +
            (taskId ? `&taskId=${taskId}` : '')

          await chrome.tabs.create({ url: workspaceUrl })
          data = { success: true }
        }
        break

      // AI Automation handlers
      case AI_MESSAGE_TYPES.AI_RUN_PROMPT:
        data = await handleAIRunPrompt(message.data, container)
        break

      case AI_MESSAGE_TYPES.AI_GET_SETTINGS:
        data = await getAISettings(container)
        break

      case AI_MESSAGE_TYPES.AI_UPDATE_SETTINGS:
        await updateAISettings(message.data, container)
        data = await getAISettings(container)
        break

      case AI_MESSAGE_TYPES.AI_UPDATE_SELECTORS:
        await updateAISelectors(message.data.provider, message.data.selectors, container)
        data = { success: true }
        break

      case AI_MESSAGE_TYPES.AI_TEST_SELECTORS:
        data = await testAISelectors(message.data.provider, message.data.selectors, container)
        break

      case 'AI_TEST_AUTOMATION':
        // Test command for verifying automation works
        console.log('[AI Test] Running automation test...')
        data = await handleAIRunPrompt({
          prompt: message.data?.prompt || 'Hello, this is a test from Superowser extension',
          context: {
            currentTask: 'test',
            documentTitle: 'Automation Test'
          }
        }, container)
        break

      case 'AI_TEST_INJECTION':
        // Test content script injection
        console.log('[AI Test] Testing content script injection...')
        try {
          const tab = await findOrCreateAITab('chatgpt', container)
          console.log('[AI Test] Tab found/created:', tab.id)
          await injectAIContentScript(tab.id!)
          console.log('[AI Test] Content script injected successfully')

          // Test if bridge is available
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func: () => window.hasOwnProperty('superowserAIBridge')
          })
          console.log('[AI Test] Bridge available:', results[0]?.result)
          data = { success: true, bridgeAvailable: results[0]?.result }
        } catch (error) {
          console.error('[AI Test] Injection failed:', error)
          data = { success: false, error: (error as Error).message }
        }
        break

      default:
        throw new Error(`Unknown message type: ${(message as any).type}`)
    }

    return {
      type: 'SUCCESS',
      id: message.id,
      data
    } as SuccessResponse

  } catch (error) {
    throw error // Will be caught by the outer catch block
  }
}
