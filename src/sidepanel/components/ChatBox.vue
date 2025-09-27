<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { BrowserChatMessage, ExtensionChatMessage } from '../stores/sidepanel-store'

type ChatHistoryEntry = (BrowserChatMessage | ExtensionChatMessage) & { timestamp: Date }

const store = useSidePanelStore()

const inputValue = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLDivElement | null>(null)

const messages = computed<ChatHistoryEntry[]>(() => {
  const history = store.cache.recentChats ?? []
  const normalized = history
    .map((entry) => {
      const timestamp = entry.timestamp instanceof Date
        ? entry.timestamp
        : new Date(entry.timestamp)
      return { ...entry, timestamp } as ChatHistoryEntry
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  console.debug('[ChatBox] messages computed', normalized.length)
  return normalized
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

const messageSourceLabel = (entry: ChatHistoryEntry) => (
  entry.source === 'extension' ? 'Superowser' : 'Browser'
)

const scrollToBottom = () => {
  const container = messagesContainer.value
  if (container) {
    container.scrollTop = container.scrollHeight
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
    nextTick(() => scrollToBottom())
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
          v-for="entry in messages"
          :key="entry.id || entry.timestamp.getTime()"
          :class="['chat-message', entry.source]"
        >
          <div class="message-meta">
            <span class="author">{{ messageSourceLabel(entry) }}</span>
            <span class="timestamp">{{ formattedTimestamp(entry.timestamp) }}</span>
          </div>
          <div class="message-body">
            <p class="content">{{ entry.content }}</p>
            <div v-if="entry.command" class="command">/{{ entry.command }}</div>
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
  gap: 12px;
  width: 100%;
  height: 100%;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.message-count {
  font-size: 12px;
  color: #6b7280;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
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

.chat-message {
  padding: 10px 12px;
  border-radius: 10px;
  max-width: 85%;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  background: #ffffff;
  align-self: flex-start;
}

.chat-message.extension {
  background: #1d4ed8;
  color: #f8fafc;
  align-self: flex-end;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 6px;
  opacity: 0.7;
}

.chat-message.extension .message-meta {
  opacity: 0.9;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.command {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.chat-message.extension .command {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.chat-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
