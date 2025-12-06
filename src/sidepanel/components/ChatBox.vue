<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, onErrorCaptured } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { BrowserChatMessage, ExtensionChatMessage } from '../stores/sidepanel-store'
import type { CommandSuggestion, ComponentData } from '../../shared/commands/types'
import type { NoteCategory } from '../../shared/models'
import TaskList from './task/TaskList.vue'
import TaskCreator from './task/TaskCreator.vue'
import TaskShortcuts from './task/TaskShortcuts.vue'
import SearchResultList from './search/SearchResultList.vue'
import { DEFAULT_SHORTCUTS } from './task/shortcuts-config'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('ChatBox')

type ChatHistoryEntry = (BrowserChatMessage | ExtensionChatMessage) & { timestamp: Date }

interface ChatBubble {
  id: string
  type: 'user-command' | 'system-response' | 'user-message' | 'browser-message' | 'task-list' | 'task-creator' | 'search-results'
  content: string
  timestamp: Date
  command?: string
  commandArgs?: string
  originalEntry?: ChatHistoryEntry
  componentData?: ComponentData
}

const store = useSidePanelStore()

const inputValue = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const suggestions = ref<CommandSuggestion[]>([])
const highlightedIndex = ref(-1)
let suggestionRequestId = 0

// Track cursor position for position-aware autocomplete
const cursorPosition = ref(0)

// Flag to prevent auto-submission after shortcut fills input
const justFilledFromShortcut = ref(false)

const showSaveAiModal = ref(false)
const aiDraftContent = ref('')
const aiDraftIncludeCurrentTask = ref(false)
const aiDraftExtraTasks = ref('')
const aiDraftCategory = ref<NoteCategory>('brainstorm')
const aiDraftComment = ref('')
const isSavingAiNote = ref(false)

// AI task selection state
const aiSelectedTasks = ref<string[]>([])
const aiTaskInput = ref('')
const showAiTaskSuggestions = ref(false)

// Task shortcuts state
const userShortcuts = ref(DEFAULT_SHORTCUTS)

// Component error handling
const componentErrors = ref<Map<string, string>>(new Map())
const retryAttempts = ref<Map<string, number>>(new Map())
const MAX_RETRY_ATTEMPTS = 3

const escapeCommandArg = (value: string) => `"${value.replace(/(["\\])/g, '\\$1')}"`

const runChatCommand = async (command: string) => {
  try {
    await store.sendExtensionChat(command)
  } catch (error) {
    logger.error('Command execution failed:', command, error)
    store.addNotification({
      type: 'error',
      message: 'Failed to execute command. Check console for details.'
    })
  }
}

// Global error handler for component errors
onErrorCaptured((error: Error, instance: any, errorInfo: string) => {
  logger.error('Component error captured:', error, errorInfo)

  // Store error for display
  const componentId = instance?.$.uid || 'unknown'
  componentErrors.value.set(componentId, error.message)

  // Notify user
  store.addNotification({
    type: 'error',
    message: 'Component error occurred. Some features may not work properly.'
  })

  // Return true to prevent error from propagating
  return true
})

const clearComponentError = (componentId: string) => {
  componentErrors.value.delete(componentId)
  retryAttempts.value.delete(componentId)
}

const retryComponent = (componentId: string) => {
  const attempts = retryAttempts.value.get(componentId) || 0
  if (attempts < MAX_RETRY_ATTEMPTS) {
    retryAttempts.value.set(componentId, attempts + 1)
    clearComponentError(componentId)
  } else {
    store.addNotification({
      type: 'error',
      message: 'Component failed multiple times. Please refresh the page.'
    })
  }
}

const messages = computed<ChatBubble[]>(() => {
  const history = store.cache.recentChats ?? []
  const normalized = history
    .map((entry) => {
      const timestamp = entry.timestamp instanceof Date
        ? entry.timestamp
        : new Date(entry.timestamp)
      return { ...entry, timestamp } as ChatHistoryEntry
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Convert to chat bubbles, separating command inputs from responses
  const bubbles: ChatBubble[] = []

  normalized.forEach((entry) => {
    if (entry.source === 'extension' && entry.content.startsWith('> /')) {
      // This is a command with response - split into two bubbles
      const lines = entry.content.split('\n')
      const commandLine = lines[0] // > /command
      const responsePart = lines.slice(2).join('\n') // Skip empty line

      const commandRaw = commandLine.substring(2).trim() // Remove "> "
      const [rawCommand, ...commandArgs] = commandRaw.split(/\s+/)
      const commandName = rawCommand ? rawCommand.replace(/^\//, '').toLowerCase() : ''

      // User command bubble
      bubbles.push({
        id: `${entry.id || entry.timestamp.getTime()}-command`,
        type: 'user-command',
        content: commandRaw,
        timestamp: new Date(entry.timestamp.getTime() - 1), // Slightly earlier
        command: commandName,
        commandArgs: commandArgs.join(' '),
        originalEntry: entry
      })

      // Check if this is a component-based response
      if (entry.componentData && entry.responseType) {
        const bubbleType = entry.responseType as ChatBubble['type']

        bubbles.push({
          id: `${entry.id || entry.timestamp.getTime()}-response`,
          type: bubbleType,
          content: responsePart,
          timestamp: entry.timestamp,
          command: commandName,
          commandArgs: commandArgs.join(' '),
          originalEntry: entry,
          componentData: entry.componentData
        })
      } else {
        // System response bubble (text)
        bubbles.push({
          id: `${entry.id || entry.timestamp.getTime()}-response`,
          type: 'system-response',
          content: responsePart,
          timestamp: entry.timestamp,
          command: commandName,
          commandArgs: commandArgs.join(' '),
          originalEntry: entry
        })
      }
    } else if (entry.source === 'extension') {
      // Regular extension message
      bubbles.push({
        id: entry.id || `${entry.timestamp.getTime()}`,
        type: 'user-message',
        content: entry.content,
        timestamp: entry.timestamp,
        originalEntry: entry
      })
    } else {
      // Browser message
      bubbles.push({
        id: entry.id || `${entry.timestamp.getTime()}`,
        type: 'browser-message',
        content: entry.content,
        timestamp: entry.timestamp,
        originalEntry: entry
      })
    }
  })

  console.debug('[ChatBox] messages computed', bubbles.length, 'bubbles from', normalized.length, 'entries')
  return bubbles
})

const hasMessages = computed(() => messages.value.length > 0)

const formattedTimestamp = (timestamp: Date) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp)
  } catch {
    return timestamp.toLocaleTimeString()
  }
}

// Remove this function as we now handle labels in the template

const scrollToBottom = () => {
  // Scroll the main sidepanel container since chat messages use the parent's scrollbar
  const mainContainer = document.querySelector('.sp-main')
  if (mainContainer) {
    mainContainer.scrollTop = mainContainer.scrollHeight
  }
}

watch(messages, async () => {
  await nextTick()
  scrollToBottom()
}, { deep: true })

// Function to load shortcuts from settings
const loadShortcuts = (settings: any) => {
  const userConfigs = settings?.shortcuts || {}
  const customButtonsRaw = settings?.customButtons

  // Ensure customButtons is always an array
  const customButtons = Array.isArray(customButtonsRaw) ? customButtonsRaw : []

  // Merge user configs with defaults
  const defaultShortcuts = DEFAULT_SHORTCUTS.map(shortcut => ({
    ...shortcut,
    command: userConfigs[shortcut.id]?.command || shortcut.command,
    parameters: userConfigs[shortcut.id]?.parameters || '',
    autoExecute: userConfigs[shortcut.id]?.autoExecute !== undefined
      ? userConfigs[shortcut.id]?.autoExecute
      : shortcut.autoExecute,
    enabled: userConfigs[shortcut.id]?.enabled !== undefined
      ? userConfigs[shortcut.id]?.enabled
      : shortcut.enabled
  })).filter(s => s.enabled)

  // Convert custom buttons to shortcut format
  const customShortcuts = customButtons
    .sort((a: any, b: any) => a.position - b.position)
    .map((btn: any) => ({
      id: btn.id,
      label: btn.label,
      icon: btn.icon,
      command: btn.command,
      parameters: btn.parameters || '',
      description: `Custom: ${btn.command}`,
      position: 100 + btn.position, // Position after defaults
      enabled: true,
      contextActive: false,
      autoExecute: btn.autoExecute,
      requiresInput: false
    }))

  // Combine default and custom shortcuts
  userShortcuts.value = [...defaultShortcuts, ...customShortcuts]
}

// Listen for settings updates from background
const handleSettingsUpdate = (message: any) => {
  if (message.type === 'STATE_UPDATE' && message.path === 'user.settings') {
    logger.debug('Settings updated, reloading shortcuts')
    loadShortcuts(message.value)
  }
}

onMounted(async () => {
  nextTick(() => {
    scrollToBottom()
  })

  // Load user shortcut settings
  try {
    const settings = await store.sendMessage({ type: 'GET_USER_SETTINGS' })
    loadShortcuts(settings)
  } catch (error) {
    logger.error('Failed to load shortcut settings:', error)
    // Keep defaults if loading fails
    userShortcuts.value = DEFAULT_SHORTCUTS
  }

  // Add listener for settings updates
  chrome.runtime.onMessage.addListener(handleSettingsUpdate)
})

onUnmounted(() => {
  // Remove listener when component is destroyed
  chrome.runtime.onMessage.removeListener(handleSettingsUpdate)
})

const clearSuggestions = () => {
  suggestions.value = []
  highlightedIndex.value = -1
}

const handleCursorChange = () => {
  if (textareaRef.value) {
    cursorPosition.value = textareaRef.value.selectionStart || 0
  }
}

const fetchSuggestions = async (input: string) => {
  // Don't trim - we need to preserve spaces for parameter detection
  if (!input.startsWith('/')) {
    clearSuggestions()
    return
  }

  const requestId = ++suggestionRequestId
  try {
    const response = await store.sendMessage({
      type: 'GET_COMMAND_SUGGESTIONS',
      data: {
        input: input,
        cursorPosition: cursorPosition.value
      }
    })

    if (requestId !== suggestionRequestId) {
      return
    }

    if (response?.type === 'SUCCESS' && Array.isArray(response.data)) {
      suggestions.value = response.data
      highlightedIndex.value = response.data.length > 0 ? 0 : -1
    } else {
      clearSuggestions()
    }
  } catch (error) {
    logger.error('Failed to load command suggestions:', error)
    clearSuggestions()
  }
}

watch(inputValue, (value, oldValue) => {
  logger.debug('========== inputValue changed ==========')
  logger.debug('Old value:', JSON.stringify(oldValue))
  logger.debug('New value:', JSON.stringify(value))
  logger.debug('justFilledFromShortcut:', justFilledFromShortcut.value)

  // Don't trigger autocomplete if we just filled from a shortcut
  if (justFilledFromShortcut.value) {
    logger.debug('Blocked - just filled from shortcut, skipping ALL processing')
    // Don't do anything - just wait for the flag to be cleared by the timeout
    return
  }

  if (value.startsWith('/')) {
    logger.debug('Calling fetchSuggestions')
    // Update cursor position before fetching (wait for DOM to update)
    nextTick(() => {
      handleCursorChange()
      fetchSuggestions(value)
    })
  } else {
    logger.debug('Clearing suggestions')
    clearSuggestions()
  }
})

const applySuggestion = (suggestion: CommandSuggestion, triggerSend = false) => {
  const text = suggestion.text || ''
  if (!text) {
    return
  }

  // For parameter and value suggestions, we need to smartly insert/replace
  if (suggestion.type === 'parameter' || suggestion.type === 'value') {
    const currentInput = inputValue.value
    const cursor = cursorPosition.value

    // Find where the current parameter/value starts
    // Look backwards from cursor to find the start of the current token
    let tokenStart = cursor
    while (tokenStart > 0 && !/\s/.test(currentInput[tokenStart - 1])) {
      tokenStart--
    }

    // Replace from tokenStart to cursor with the suggestion text
    const before = currentInput.substring(0, tokenStart)
    const after = currentInput.substring(cursor)
    inputValue.value = before + text + after

    // Position cursor at the end of the inserted text
    nextTick(() => {
      const newCursorPos = tokenStart + text.length
      if (textareaRef.value) {
        textareaRef.value.setSelectionRange(newCursorPos, newCursorPos)
        cursorPosition.value = newCursorPos
      }
    })
  } else {
    // For command suggestions, replace entire input
    inputValue.value = text
  }

  clearSuggestions()
  textareaRef.value?.focus()

  if (triggerSend) {
    nextTick(() => {
      void sendMessage()
    })
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (suggestions.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, suggestions.value.length - 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      return
    }
    if (event.key === 'Tab' && highlightedIndex.value >= 0) {
      event.preventDefault()
      applySuggestion(suggestions.value[highlightedIndex.value])
      return
    }
    if (event.key === 'Escape') {
      clearSuggestions()
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    if (suggestions.value.length > 0 && highlightedIndex.value >= 0) {
      // Fill input from autocomplete, don't execute
      event.preventDefault()
      applySuggestion(suggestions.value[highlightedIndex.value], false)
    } else {
      // No autocomplete active - send the message
      event.preventDefault()
      void sendMessage()
    }
  }
}

const sendMessage = async () => {
  logger.debug('========== sendMessage called ==========')
  logger.debug('Call stack for sendMessage')

  // GUARD: Don't execute if we just filled from a shortcut
  if (justFilledFromShortcut.value) {
    logger.debug('❌ BLOCKED - sendMessage called while justFilledFromShortcut is true')
    logger.debug('This prevents auto-execution after Shift+Click')
    return
  }

  const content = inputValue.value.trim()
  if (!content || isSending.value) {
    logger.debug('sendMessage aborted - empty or already sending')
    return
  }

  logger.debug('✅ Sending message:', content)
  isSending.value = true
  try {
    await store.sendExtensionChat(content)
    inputValue.value = ''
    clearSuggestions()
  } finally {
    isSending.value = false
    setTimeout(() => {
      scrollToBottom()
      textareaRef.value?.focus()
    }, 100)
  }
}

const hasCurrentTask = computed(() => !!store.cache.currentTask?.name)

const availableAiTasks = computed<string[]>(() => {
  const taskSet = new Set<string>()
  // Add tasks from recent tasks cache
  ;(store.cache.recentTasks || []).forEach((task: any) => {
    if (task?.name) {
      taskSet.add(task.name)
    }
  })
  return Array.from(taskSet)
})

const filteredAiTasks = computed<string[]>(() => {
  const input = aiTaskInput.value.trim().toLowerCase()
  if (!input) {
    return availableAiTasks.value.slice(0, 5) // Show top 5 recent tasks
  }

  return availableAiTasks.value
    .filter(task => task.toLowerCase().includes(input))
    .slice(0, 5)
})

const filterAiTasks = () => {
  // Update suggestion visibility based on filtered results
  showAiTaskSuggestions.value = filteredAiTasks.value.length > 0 || !!aiTaskInput.value.trim()
}

watch(hasCurrentTask, (present) => {
  if (!present) {
    aiDraftIncludeCurrentTask.value = false
  }
})

const openSaveAiModal = (bubble: ChatBubble) => {
  aiDraftContent.value = bubble.content.trim()
  aiDraftIncludeCurrentTask.value = hasCurrentTask.value
  aiDraftExtraTasks.value = ''
  aiDraftCategory.value = 'brainstorm'
  aiDraftComment.value = bubble.commandArgs ? `Prompt: ${bubble.commandArgs}` : ''

  if (!aiDraftIncludeCurrentTask.value) {
    aiDraftIncludeCurrentTask.value = false
  }

  showSaveAiModal.value = true
}

const closeSaveAiModal = () => {
  showSaveAiModal.value = false
  aiDraftContent.value = ''
  aiDraftIncludeCurrentTask.value = false
  aiDraftExtraTasks.value = ''
  aiDraftCategory.value = 'brainstorm'
  aiDraftComment.value = ''
  // Reset AI task selection state
  aiSelectedTasks.value = []
  aiTaskInput.value = ''
  showAiTaskSuggestions.value = false
}

const saveAiNote = async () => {
  const content = aiDraftContent.value.trim()
  if (!content || isSavingAiNote.value) {
    store.addNotification({
      type: 'error',
      message: 'Cannot save empty response'
    })
    return
  }

  const tasks = new Set<string>()
  if (aiDraftIncludeCurrentTask.value && store.cache.currentTask?.name) {
    tasks.add(store.cache.currentTask.name)
  }
  aiSelectedTasks.value.forEach(task => tasks.add(task))

  const comment = aiDraftComment.value.trim()

  isSavingAiNote.value = true
  try {
    const response = await store.sendMessage({
      type: 'SAVE_NOTE',
      data: {
        content,
        comment: comment || undefined,
        tasks: tasks.size > 0 ? Array.from(tasks) : undefined,
        category: aiDraftCategory.value
      }
    })

    if (response?.type !== 'SUCCESS') {
      throw new Error(response?.error?.message || 'Failed to save note')
    }

    store.addNotification({
      type: 'success',
      message: 'AI response saved to notes'
    })
    closeSaveAiModal()
  } catch (error) {
    logger.error('Failed to save AI response:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save AI response'
    })
  } finally {
    isSavingAiNote.value = false
  }
}

const handleAiTaskInputFocus = () => {
  filterAiTasks()
  showAiTaskSuggestions.value = filteredAiTasks.value.length > 0
}

const handleAiTaskInputBlur = () => {
  setTimeout(() => {
    showAiTaskSuggestions.value = false
  }, 150)
}

const addAiTask = (taskName: string) => {
  const normalized = taskName.trim()
  if (!normalized || aiSelectedTasks.value.includes(normalized)) {
    return
  }
  aiSelectedTasks.value.push(normalized)
  aiTaskInput.value = ''
  filterAiTasks()
}

const removeAiTask = (taskName: string) => {
  aiSelectedTasks.value = aiSelectedTasks.value.filter(task => task !== taskName)
  filterAiTasks()
}

// Task component event handlers with error handling
const handleTaskActivated = async (task: any) => {
  if (!task?.name) {
    store.addNotification({
      type: 'error',
      message: 'Invalid task data'
    })
    return
  }

  await runChatCommand(`/settask ${escapeCommandArg(task.name)}`)
}

const handleTaskDeleted = async (task: any) => {
  logger.debug('Task deleted:', task)
  if (!task?.name) {
    store.addNotification({
      type: 'error',
      message: 'Invalid task data'
    })
    return
  }

  if (!confirm(`Delete task "${task.name}"? This will remove the task but keep all associated pages.`)) {
    return
  }

  try {
    const response = await store.sendMessage({
      type: 'DELETE_TASK',
      data: { taskName: task.name }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: `Task "${task.name}" deleted successfully`
      })
      await runChatCommand('/tasks')
    } else {
      throw new Error(response?.message || 'Unknown error')
    }
  } catch (error) {
    logger.error('Failed to delete task:', error)
    store.addNotification({
      type: 'error',
      message: `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

const handleTaskCreateRequested = async () => {
  // Pre-fill the input with /newtask command so user can type the name
  inputValue.value = '/newtask '
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const handleTaskEdit = (task: any) => {
  logger.debug('Task edit requested:', task)
  // Auto-fill the input with /edittask command (if it exists) or newtask with pre-filled data
  inputValue.value = `/newtask --name="${task.name}"${task.description ? ` --description="${task.description}"` : ''} --activate=false `
  nextTick(() => {
    textareaRef.value?.focus()
    // Position cursor at the end
    const textarea = textareaRef.value
    if (textarea) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

const handleTaskViewDetails = async (task: any) => {
  if (!task?.id && !task?.name) {
    store.addNotification({
      type: 'error',
      message: 'Task information unavailable'
    })
    return
  }

  const parts = ['/tasks']
  if (task.id) {
    parts.push(`--taskId=${escapeCommandArg(task.id)}`)
  } else if (task.name) {
    parts.push(`--search=${escapeCommandArg(task.name)}`)
  }
  parts.push('--detail')

  await runChatCommand(parts.join(' '))
}

// Search result component event handlers
const handlePageOpen = (url: string, pageId: string) => {
  logger.debug('Page opened:', url, pageId)
  store.addNotification({
    type: 'success',
    message: 'Page opened in new tab'
  })
}

const handleNoteView = (noteId: string) => {
  logger.debug('Note view requested:', noteId)
  // Future: Navigate to note detail view
  store.addNotification({
    type: 'info',
    message: 'Note details view - coming soon'
  })
}

const handleDocumentOpen = (documentId: string) => {
  logger.debug('Document open requested:', documentId)
  // Future: Open document in editor
  store.addNotification({
    type: 'info',
    message: 'Document editor - coming soon'
  })
}

// Shortcut event handlers
const handleShortcutExecuted = async (shortcut: any, options?: { autoExecute: boolean }) => {
  logger.debug('========== handleShortcutExecuted ==========')
  logger.debug('shortcut.id:', shortcut?.id)
  logger.debug('shortcut.command:', shortcut?.command)
  logger.debug('shortcut.parameters:', shortcut?.parameters)
  logger.debug('options:', JSON.stringify(options))
  logger.debug('typeof options:', typeof options)
  logger.debug('options?.autoExecute:', options?.autoExecute)

  // Determine if we should auto-execute based on options or shortcut.autoExecute
  const shouldAutoExecute = options?.autoExecute === true || shortcut.autoExecute

  logger.debug('Final decision - shouldAutoExecute:', shouldAutoExecute)

  // Append parameters if configured
  const fullCommand = shortcut.parameters
    ? `${shortcut.command} ${shortcut.parameters}`.trim()
    : shortcut.command

  logger.debug('Full command with parameters:', fullCommand)

  if (shouldAutoExecute) {
    logger.debug('AUTO-EXECUTING command:', fullCommand)
    // Execute command immediately with configured parameters
    try {
      await store.sendExtensionChat(fullCommand)
      // Optionally scroll to show the result
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    } catch (error) {
      logger.error('Auto-execute failed:', error)
      store.addNotification({
        type: 'error',
        message: 'Failed to execute command. Try again with parameters.'
      })
      // Fall back to input mode
      inputValue.value = fullCommand + ' '
      nextTick(() => {
        textareaRef.value?.focus()
      })
    }
  } else {
    logger.debug('FILLING INPUT with command:', fullCommand)

    // Set flag to prevent auto-submission
    justFilledFromShortcut.value = true

    // Fill the input with the shortcut command and parameters for user to modify
    inputValue.value = fullCommand + ' '

    nextTick(() => {
      textareaRef.value?.focus()
      // Position cursor at the end
      const textarea = textareaRef.value
      if (textarea) {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      }

      // Clear the flag after a short delay to allow normal autocomplete
      setTimeout(() => {
        justFilledFromShortcut.value = false
        logger.debug('Re-enabling autocomplete')
      }, 100)
    })
  }
}

const handleShortcutCustomize = () => {
  logger.debug('Shortcut customization requested')
  try {
    chrome.runtime.openOptionsPage()
  } catch (error) {
    logger.error('Failed to open options page:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to open options page. Please try again.'
    })
  }
}

// TaskCreator event handlers with validation
const handleTaskCreate = async (data: { name: string; description?: string; activate: boolean }) => {
  if (!data?.name?.trim()) {
    store.addNotification({
      type: 'error',
      message: 'Task name is required'
    })
    return
  }

  const parts = [`/newtask ${escapeCommandArg(data.name.trim())}`]
  if (data.description?.trim()) {
    parts.push(`--description=${escapeCommandArg(data.description.trim())}`)
  }
  if (data.activate === false) {
    parts.push('--activate=false')
  }

  await runChatCommand(parts.join(' '))
}

const handleTaskUpdate = async (data: { task: any; name: string; description?: string; activate: boolean }) => {
  logger.debug('Updating task:', data)

  if (!data?.task?.id) {
    store.addNotification({
      type: 'error',
      message: 'Invalid task data'
    })
    return
  }

  if (!data?.name?.trim()) {
    store.addNotification({
      type: 'error',
      message: 'Task name is required'
    })
    return
  }

  if (data.name.length > 100) {
    store.addNotification({
      type: 'error',
      message: 'Task name must be 100 characters or less'
    })
    return
  }

  try {
    const response = await store.sendMessage({
      type: 'UPDATE_TASK',
      data: {
        taskId: data.task.id,
        name: data.name.trim(),
        description: data.description?.trim(),
        activate: data.activate
      }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: `Task "${data.name}" updated successfully`
      })
      await runChatCommand('/tasks')
    } else {
      throw new Error(response?.message || 'Unknown error')
    }
  } catch (error) {
    logger.error('Failed to update task:', error)
    store.addNotification({
      type: 'error',
      message: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

const handleTaskCreatorCancel = () => {
  logger.debug('Task creator cancelled')
  // Could potentially remove the creator bubble from chat or just let user continue
}
</script>

<template>
  <section class="chat-box">
    <header class="chat-header">
      <div class="chat-title">
        <span class="chat-icon" aria-hidden="true">💬</span>
        <h2>Chat</h2>
      </div>
      <span v-if="hasMessages" class="message-count">{{ messages.length }} messages</span>
    </header>

    <div ref="messagesContainer" class="chat-messages">
      <div v-if="!hasMessages" class="empty-state">
        <p class="empty-title">💬 Chat - Your Command Center</p>
        <div class="command-examples">
          <p class="examples-header">Try these commands:</p>
          <div class="example-item">
            <code>/save</code>
            <span>Save current page with tags and tasks</span>
          </div>
          <div class="example-item">
            <code>/find [query]</code>
            <span>Search your saved pages and notes</span>
          </div>
          <div class="example-item">
            <code>/task</code>
            <span>Manage and switch tasks</span>
          </div>
          <div class="example-item">
            <code>/notes</code>
            <span>View and search your notes</span>
          </div>
          <div class="example-item">
            <code>/ai [prompt]</code>
            <span>Ask AI assistant for help</span>
          </div>
        </div>
        <p class="empty-tip">💡 <strong>Tip:</strong> Use shortcut buttons below or type <code>/</code> to see all commands</p>
      </div>

      <TransitionGroup v-else appear name="chat" tag="div" class="chat-thread">
        <article
          v-for="bubble in messages"
          :key="bubble.id"
          :class="['chat-bubble', bubble.type]"
        >
          <div class="bubble-meta">
            <span class="author">{{ bubble.type.includes('user') ? 'You' : 'Superowser' }}</span>
            <span class="timestamp">{{ formattedTimestamp(bubble.timestamp) }}</span>
          </div>
          <div class="bubble-content">
            <!-- Regular text content -->
            <div v-if="bubble.type === 'user-command' || bubble.type === 'user-message' || bubble.type === 'browser-message'">
              <p class="content">{{ bubble.content }}</p>
            </div>

            <!-- System response with potential components -->
            <div v-else-if="bubble.type === 'system-response'">
              <p class="content">{{ bubble.content }}</p>
              <div v-if="bubble.command" class="command-ref">/{{ bubble.command }}</div>
              <div v-if="bubble.command === 'ai'" class="bubble-actions">
                <button type="button" class="bubble-action" @click="openSaveAiModal(bubble)">
                  Save to notes
                </button>
              </div>
            </div>

            <!-- Task list component with error boundary -->
            <div v-else-if="bubble.type === 'task-list'" class="component-bubble">
              <div v-if="componentErrors.has(`task-list-${bubble.id}`)" class="component-error">
                <div class="error-content">
                  <span class="error-icon">⚠️</span>
                  <div class="error-text">
                    <p class="error-title">Task List Error</p>
                    <p class="error-message">{{ componentErrors.get(`task-list-${bubble.id}`) }}</p>
                  </div>
                  <div class="error-actions">
                    <button
                      type="button"
                      class="error-retry"
                      :disabled="(retryAttempts.get(`task-list-${bubble.id}`) || 0) >= MAX_RETRY_ATTEMPTS"
                      @click="retryComponent(`task-list-${bubble.id}`)"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      class="error-dismiss"
                      @click="clearComponentError(`task-list-${bubble.id}`)"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
              <TaskList
                v-else
                :key="`task-list-${bubble.id}-${retryAttempts.get(`task-list-${bubble.id}`) || 0}`"
                :tasks="bubble.componentData?.tasks || []"
                :interactive="bubble.componentData?.interactive || false"
                :filters="bubble.componentData?.filters"
                @task-activated="handleTaskActivated"
                @task-deleted="handleTaskDeleted"
                @task-edit="handleTaskEdit"
                @task-view-details="handleTaskViewDetails"
                @create-requested="handleTaskCreateRequested"
              />
            </div>

            <!-- Task creator component with error boundary -->
            <div v-else-if="bubble.type === 'task-creator'" class="component-bubble">
              <div v-if="componentErrors.has(`task-creator-${bubble.id}`)" class="component-error">
                <div class="error-content">
                  <span class="error-icon">⚠️</span>
                  <div class="error-text">
                    <p class="error-title">Task Creator Error</p>
                    <p class="error-message">{{ componentErrors.get(`task-creator-${bubble.id}`) }}</p>
                  </div>
                  <div class="error-actions">
                    <button
                      type="button"
                      class="error-retry"
                      :disabled="(retryAttempts.get(`task-creator-${bubble.id}`) || 0) >= MAX_RETRY_ATTEMPTS"
                      @click="retryComponent(`task-creator-${bubble.id}`)"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      class="error-dismiss"
                      @click="clearComponentError(`task-creator-${bubble.id}`)"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
              <TaskCreator
                v-else
                :key="`task-creator-${bubble.id}-${retryAttempts.get(`task-creator-${bubble.id}`) || 0}`"
                :tasks="bubble.componentData?.tasks || []"
                :show-existing="bubble.componentData?.showExisting !== false"
                :edit-task="bubble.componentData?.editTask"
                @create="handleTaskCreate"
                @update="handleTaskUpdate"
                @cancel="handleTaskCreatorCancel"
              />
            </div>

            <!-- Search results component with error boundary -->
            <div v-else-if="bubble.type === 'search-results'" class="component-bubble">
              <div v-if="componentErrors.has(`search-results-${bubble.id}`)" class="component-error">
                <div class="error-content">
                  <span class="error-icon">⚠️</span>
                  <div class="error-text">
                    <p class="error-title">Search Results Error</p>
                    <p class="error-message">{{ componentErrors.get(`search-results-${bubble.id}`) }}</p>
                  </div>
                  <div class="error-actions">
                    <button
                      type="button"
                      class="error-retry"
                      :disabled="(retryAttempts.get(`search-results-${bubble.id}`) || 0) >= MAX_RETRY_ATTEMPTS"
                      @click="retryComponent(`search-results-${bubble.id}`)"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      class="error-dismiss"
                      @click="clearComponentError(`search-results-${bubble.id}`)"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
              <SearchResultList
                v-else
                :key="`search-results-${bubble.id}-${retryAttempts.get(`search-results-${bubble.id}`) || 0}`"
                :query="bubble.componentData?.searchResults?.query || ''"
                :results="bubble.componentData?.searchResults?.groups || {}"
                :interactive="true"
                @page-open="handlePageOpen"
                @note-view="handleNoteView"
                @task-activate="handleTaskActivated"
                @document-open="handleDocumentOpen"
                @result-click="(item) => logger.debug('Result clicked:', item)"
              />
            </div>

            <!-- Fallback for unknown types -->
            <div v-else>
              <p class="content">{{ bubble.content }}</p>
            </div>
          </div>
        </article>
      </TransitionGroup>
    </div>


    <form class="chat-input" @submit.prevent="sendMessage">
      <!-- Command shortcuts with help button -->
      <div class="shortcuts-container">
        <TaskShortcuts
          :shortcuts="userShortcuts"
          @shortcut-executed="(shortcut, options) => handleShortcutExecuted(shortcut, options)"
          @customize="handleShortcutCustomize"
        />
        <button
          type="button"
          class="shortcut-help-btn"
          data-tooltip="Hold Shift + Click on shortcuts to customize parameters"
        >
          ?
        </button>
      </div>

      <div v-if="suggestions.length > 0" class="suggestions">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.text || suggestion.display || index"
          type="button"
          class="suggestion-item"
          :class="{ active: index === highlightedIndex }"
          @mousedown.prevent="applySuggestion(suggestion)"
        >
          <span class="suggestion-text">{{ suggestion.display || suggestion.text }}</span>
          <span class="suggestion-desc">{{ suggestion.description }}</span>
          <span v-if="suggestion.category" class="suggestion-category">{{ suggestion.category }}</span>
        </button>
      </div>

      <textarea
        ref="textareaRef"
        v-model="inputValue"
        placeholder="Type a message…"
        rows="3"
        :disabled="isSending"
        @keydown="handleKeydown"
        @click="handleCursorChange"
        @keyup="handleCursorChange"
      />
      <div class="input-actions">
        <span class="hint">Enter to send · Shift+Enter for newline · Tab to complete</span>
        <button type="submit" class="send-button" :disabled="isSending || !inputValue.trim()">
          {{ isSending ? 'Sending…' : 'Send' }}
        </button>
      </div>
    </form>

    <div v-if="showSaveAiModal" class="modal-backdrop">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="ai-save-title">
        <header class="modal-header">
          <h3 id="ai-save-title">Save AI Response</h3>
        </header>
        <section class="modal-body">
          <label class="modal-field">
            <span>Content</span>
            <textarea v-model="aiDraftContent" rows="6" class="modal-textarea"></textarea>
          </label>

          <label class="modal-field">
            <span>Comment (optional)</span>
            <input v-model="aiDraftComment" type="text" class="modal-input" placeholder="Prompt or your note" />
          </label>

          <label class="modal-field">
            <span>Category</span>
            <select v-model="aiDraftCategory" class="modal-select">
              <option value="brainstorm">Brainstorm</option>
              <option value="plan">Plan / Blueprint</option>
              <option value="note">General Note</option>
              <option value="highlight">Highlight</option>
            </select>
          </label>

          <label class="modal-checkbox">
            <input
              v-model="aiDraftIncludeCurrentTask"
              type="checkbox"
              :disabled="!hasCurrentTask"
            />
            <span>Link to current task ({{ hasCurrentTask ? store.cache.currentTask?.name : 'none' }})</span>
          </label>

          <div v-if="aiSelectedTasks.length > 0" class="modal-selected-tasks">
            <span v-for="task in aiSelectedTasks" :key="task" class="modal-task-pill">
              📁 {{ task }}
              <button type="button" class="pill-remove" aria-label="Remove task" @click="removeAiTask(task)">×</button>
            </span>
          </div>

          <label class="modal-field">
            <span>Add task</span>
            <div class="modal-task-input">
              <input
                v-model="aiTaskInput"
                type="text"
                class="modal-input"
                placeholder="Type to search or create"
                autocomplete="off"
                @focus="handleAiTaskInputFocus"
                @blur="handleAiTaskInputBlur"
                @keyup.enter.prevent="aiTaskInput && addAiTask(aiTaskInput)"
              />

              <div v-if="showAiTaskSuggestions" class="modal-task-suggestions">
                <button
                  v-for="task in filteredAiTasks"
                  :key="task"
                  type="button"
                  class="task-suggestion"
                  @mousedown.prevent="addAiTask(task)"
                >
                  📁 {{ task }}
                </button>
                <button
                  v-if="aiTaskInput && !filteredAiTasks.includes(aiTaskInput.trim()) && !aiSelectedTasks.includes(aiTaskInput.trim())"
                  type="button"
                  class="task-suggestion create"
                  @mousedown.prevent="addAiTask(aiTaskInput)"
                >
                  ➕ Create "{{ aiTaskInput.trim() }}"
                </button>
              </div>
            </div>
          </label>
        </section>
        <footer class="modal-actions">
          <button type="button" class="btn btn-secondary" :disabled="isSavingAiNote" @click="closeSaveAiModal">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" :disabled="isSavingAiNote" @click="saveAiNote">
            {{ isSavingAiNote ? 'Saving…' : 'Save note' }}
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat-box {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.chat-icon {
  font-size: 18px;
}

.message-count {
  font-size: 12px;
  color: #6b7280;
}

.chat-messages {
  flex: 1;
  padding: 12px 12px 18px 12px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state {
  text-align: center;
  color: #4b5563;
  margin-top: 24px;
  padding: 0 16px;
}

.empty-title {
  margin: 0 0 20px;
  font-weight: 600;
  font-size: 16px;
  color: #1f2937;
}

.command-examples {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  margin: 0 auto 16px;
  max-width: 400px;
  text-align: left;
}

.examples-header {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.example-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.example-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.example-item code {
  background: #f3f4f6;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-weight: 600;
  white-space: nowrap;
  min-width: 100px;
}

.example-item span {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.empty-tip {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.empty-tip code {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.chat-bubble {
  padding: 10px 12px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  margin-bottom: 12px;
}

.chat-bubble.user-command,
.chat-bubble.user-message {
  background: #1d4ed8;
  color: #f8fafc;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  max-width: calc(100% - 16px);
  margin-right: 8px;
}

.chat-bubble.system-response,
.chat-bubble.browser-message {
  background: #ffffff;
  color: #1f2937;
  align-self: flex-start;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
  max-width: calc(100% - 16px);
  margin-left: 8px;
}

.bubble-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-bottom: 6px;
  opacity: 0.8;
  font-weight: 500;
  gap: 8px;
}

.chat-bubble.user-command .bubble-meta,
.chat-bubble.user-message .bubble-meta {
  opacity: 0.9;
}

.bubble-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
  font-size: 14px;
}

.command-ref {
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.bubble-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.bubble-action {
  border: none;
  background: #1d4ed8;
  color: #fff;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.bubble-action:hover {
  background: #1e3a8a;
}

.chat-input {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  padding: 12px 16px 16px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
}

.shortcuts-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-help-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: #ffffff;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  cursor: help;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
}

.shortcut-help-btn:hover {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
  transform: scale(1.1);
}

/* Custom tooltip */
.shortcut-help-btn[data-tooltip]::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: #1f2937;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Tooltip arrow */
.shortcut-help-btn[data-tooltip]::after {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  right: 6px;
  border: 6px solid transparent;
  border-top-color: #1f2937;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  z-index: 1000;
}

.shortcut-help-btn:hover::before,
.shortcut-help-btn:hover::after {
  opacity: 1;
  visibility: visible;
}

.chat-input textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  resize: none;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.chat-input textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.chat-input textarea:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.send-button {
  border: none;
  background: #1d4ed8;
  color: white;
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.send-button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.send-button:not(:disabled):hover {
  background: #1e3a8a;
}

.hint {
  opacity: 0.7;
}

.suggestions {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
  max-height: 220px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: #f8fafc;
}

.suggestion-text {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
}

.suggestion-desc {
  font-size: 12px;
  color: #64748b;
}

.suggestion-category {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
}

.chat-enter-active,
.chat-leave-active,
.chat-appear-active {
  transition: all 0.22s ease;
}

.chat-enter-from,
.chat-leave-to,
.chat-appear-from {
  opacity: 0;
  transform: translateY(6px);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2000;
}

.modal-panel {
  width: min(520px, 100%);
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #1f2937;
}

.modal-input,
.modal-textarea,
.modal-select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.modal-textarea {
  resize: vertical;
  min-height: 120px;
}

.modal-input:focus,
.modal-textarea:focus,
.modal-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.modal-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1f2937;
}

.modal-checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.modal-selected-tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.modal-task-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #bbf7d0;
  font-size: 12px;
}

.modal-task-input {
  position: relative;
}

.modal-task-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}

.task-suggestion {
  padding: 8px 12px;
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.task-suggestion:hover {
  background: #f3f4f6;
}

.task-suggestion.create {
  color: #2563eb;
  border-top: 1px solid #e5e7eb;
  font-weight: 500;
}

.modal-actions {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.modal-selected-tasks {
  margin-bottom: 4px;
}

/* Component bubble styles */
.component-bubble {
  margin: 0;
  padding: 0;
}

.component-bubble .task-list {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafbfc;
  max-width: 100%;
}

/* Adjust bubble content for components */
.chat-bubble.task-list .bubble-content {
  padding: 0;
}

.chat-bubble.task-list .bubble-content .component-bubble {
  border-radius: 8px;
  overflow: hidden;
}

/* Component error boundary styles */
.component-error {
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  padding: 16px;
  margin: 8px 0;
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-text {
  flex: 1;
  min-width: 0;
}

.error-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: #7f1d1d;
  line-height: 1.4;
}

.error-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.error-retry,
.error-dismiss {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.error-retry {
  background: #dc2626;
  color: white;
}

.error-retry:hover:not(:disabled) {
  background: #b91c1c;
}

.error-retry:disabled {
  background: #fca5a5;
  cursor: not-allowed;
  opacity: 0.6;
}

.error-dismiss {
  background: #f3f4f6;
  color: #374151;
}

.error-dismiss:hover {
  background: #e5e7eb;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.detail-action {
  border: none;
  background: #3b82f6;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.detail-action:hover {
  background: #2563eb;
}
</style>
