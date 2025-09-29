<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { BrowserChatMessage, ExtensionChatMessage } from '../stores/sidepanel-store'
import type { CommandSuggestion } from '../../shared/commands/types'
import type { NoteCategory } from '../../shared/models'

type ChatHistoryEntry = (BrowserChatMessage | ExtensionChatMessage) & { timestamp: Date }

interface ChatBubble {
  id: string
  type: 'user-command' | 'system-response' | 'user-message' | 'browser-message'
  content: string
  timestamp: Date
  command?: string
  commandArgs?: string
  originalEntry?: ChatHistoryEntry
}

const store = useSidePanelStore()

const inputValue = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const suggestions = ref<CommandSuggestion[]>([])
const highlightedIndex = ref(-1)
let suggestionRequestId = 0

const showSaveAiModal = ref(false)
const aiDraftContent = ref('')
const aiDraftIncludeCurrentTask = ref(false)
const aiDraftExtraTasks = ref('')
const aiDraftCategory = ref<NoteCategory>('brainstorm')
const aiDraftComment = ref('')
const isSavingAiNote = ref(false)

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

  normalized.forEach((entry, index) => {
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

      // System response bubble
      bubbles.push({
        id: `${entry.id || entry.timestamp.getTime()}-response`,
        type: 'system-response',
        content: responsePart,
        timestamp: entry.timestamp,
        command: commandName,
        commandArgs: commandArgs.join(' '),
        originalEntry: entry
      })
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

onMounted(() => {
  nextTick(() => {
    scrollToBottom()
  })
})

const clearSuggestions = () => {
  suggestions.value = []
  highlightedIndex.value = -1
}

const fetchSuggestions = async (input: string) => {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    clearSuggestions()
    return
  }

  const requestId = ++suggestionRequestId
  try {
    const response = await store.sendMessage({
      type: 'GET_COMMAND_SUGGESTIONS',
      data: { input: trimmed }
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
    console.error('Failed to load command suggestions:', error)
    clearSuggestions()
  }
}

watch(inputValue, (value) => {
  if (value.trim().startsWith('/')) {
    fetchSuggestions(value)
  } else {
    clearSuggestions()
  }
})

const applySuggestion = (suggestion: CommandSuggestion, triggerSend = false) => {
  const text = suggestion.text || suggestion.content || ''
  if (!text) {
    return
  }
  inputValue.value = text
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
      event.preventDefault()
      applySuggestion(suggestions.value[highlightedIndex.value], true)
    } else {
      event.preventDefault()
      void sendMessage()
    }
  }
}

const sendMessage = async () => {
  const content = inputValue.value.trim()
  if (!content || isSending.value) {
    return
  }

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
  (store.cache.recentTasks || []).forEach(task => {
    if (task?.name) {
      taskSet.add(task.name)
    }
  })
  aiAvailableTasks.value.forEach(name => {
    if (name) {
      taskSet.add(name)
    }
  })
  return Array.from(taskSet)
})

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
    console.error('Failed to save AI response:', error)
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
        <p class="empty-title">No conversation yet</p>
        <p class="empty-subtitle">Start typing below to send your first message.</p>
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
            <p class="content">{{ bubble.content }}</p>
            <div v-if="bubble.command && bubble.type === 'system-response'" class="command-ref">/{{ bubble.command }}</div>
            <div
              v-if="bubble.type === 'system-response' && bubble.command === 'ai'"
              class="bubble-actions"
            >
              <button type="button" class="bubble-action" @click="openSaveAiModal(bubble)">
                Save to notes
              </button>
            </div>
          </div>
        </article>
      </TransitionGroup>
    </div>

    <form class="chat-input" @submit.prevent="sendMessage">
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
  color: #9ca3af;
  margin-top: 24px;
}

.empty-title {
  margin: 0 0 4px;
  font-weight: 600;
}

.empty-subtitle {
  margin: 0;
  font-size: 13px;
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
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
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
</style>
.modal-selected-tasks {
  margin-bottom: 4px;
}
