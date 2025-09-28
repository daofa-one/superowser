<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { BrowserChatMessage, ExtensionChatMessage } from '../stores/sidepanel-store'

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

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
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
  } finally {
    isSending.value = false
    // Wait a bit longer for the message to be processed and rendered
    setTimeout(() => scrollToBottom(), 100)
  }
}
</script>

<template>
  <section class="chat-box">
    <header class="chat-header">
      <h2>Chat</h2>
      <span v-if="hasMessages" class="message-count">{{ messages.length }} messages</span>
    </header>

    <div ref="messagesContainer" class="chat-messages">
      <div v-if="!hasMessages" class="empty-state">
        <p class="empty-title">No conversation yet</p>
        <p class="empty-subtitle">Start typing below to send your first message.</p>
      </div>

      <template v-else>
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
      </template>
    </div>

    <form class="chat-input" @submit.prevent="sendMessage">
      <textarea
        v-model="inputValue"
        placeholder="Type a message…"
        rows="3"
        :disabled="isSending"
        @keydown="handleKeydown"
      />
      <div class="input-actions">
        <span class="hint">Press Enter to send · Shift + Enter for newline</span>
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
  padding: 16px;
  padding-bottom: 160px;
  background: #f9fafb;
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
  margin-right: 16px;
}

.chat-bubble.system-response,
.chat-bubble.browser-message {
  background: #ffffff;
  color: #1f2937;
  align-self: flex-start;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
  max-width: calc(100% - 16px);
  margin-left: 16px;
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
  position: fixed;
  bottom: 49px;
  left: 0;
  right: 0;
  margin-left: 16px;
  margin-right: 16px;
  background: #ffffff;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
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
</style>
