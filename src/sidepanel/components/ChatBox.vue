<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { BrowserChatMessage, ExtensionChatMessage } from '../stores/sidepanel-store'
import type { CommandSuggestion } from '../../shared/commands/types'

type ChatHistoryEntry = (BrowserChatMessage | ExtensionChatMessage) & { timestamp: Date }

interface ChatBubble {
  id: string
  type: 'user-command' | 'system-response' | 'user-message' | 'browser-message'
  content: string
  timestamp: Date
  command?: string
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

      const command = commandLine.substring(2) // Remove "> "

      // User command bubble
      bubbles.push({
        id: `${entry.id || entry.timestamp.getTime()}-command`,
        type: 'user-command',
        content: command,
        timestamp: new Date(entry.timestamp.getTime() - 1), // Slightly earlier
        command: entry.command,
        originalEntry: entry
      })

      // System response bubble
      bubbles.push({
        id: `${entry.id || entry.timestamp.getTime()}-response`,
        type: 'system-response',
        content: responsePart,
        timestamp: entry.timestamp,
        command: entry.command,
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
</script>

<template>
  <section class="chat-box">
    <header class="chat-header">
      <h2 v-if="hasMessages">Chat</h2>
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
}

.chat-header h2 {
  margin-left: 16px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.message-count {
  margin-right: 16px;
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
</style>
