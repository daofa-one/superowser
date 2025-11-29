<template>
  <div class="search-results">
    <div class="results-header">
      <h3 class="results-title">Search Results for "{{ query }}"</h3>
      <div class="result-count">{{ totalCount }} result{{ totalCount !== 1 ? 's' : '' }}</div>
    </div>

    <!-- Pages Section -->
    <section v-if="results.pages?.length" class="result-group">
      <h4 class="group-title">📄 Pages ({{ results.pages.length }})</h4>
      <div class="result-list">
        <article
          v-for="page in results.pages"
          :key="page.id"
          class="result-item page-result"
          :title="page.url || 'No URL available'"
          @click="handlePageClick(page)"
        >
          <div class="result-header">
            <img
              v-if="page.favicon"
              :src="page.favicon"
              class="favicon"
              alt="favicon"
              @error="handleFaviconError"
            />
            <div class="favicon-placeholder" v-else>📄</div>
            <h5 class="result-title">{{ page.title }}</h5>
            <span v-if="page.shortcut" class="shortcut">@{{ page.shortcut }}</span>
          </div>

          <a
            v-if="page.url"
            :href="page.url"
            class="result-url"
            @click.stop="handleUrlClick(page.url)"
          >
            {{ page.url }}
          </a>

          <p v-if="page.snippet" class="result-snippet">{{ page.snippet }}</p>

          <div v-if="page.tags?.length" class="result-tags">
            <span v-for="tag in page.tags" :key="tag" class="tag">
              #{{ tag }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- Notes Section -->
    <section v-if="results.notes?.length" class="result-group">
      <h4 class="group-title">📝 Notes ({{ results.notes.length }})</h4>
      <div class="result-list">
        <article
          v-for="note in results.notes"
          :key="note.id"
          class="result-item note-result"
          @click="handleNoteClick(note)"
        >
          <h5 class="result-title">{{ note.title || 'Note' }}</h5>
          <p class="result-snippet">{{ note.snippet }}</p>
          <div v-if="note.tags?.length" class="result-tags">
            <span v-for="tag in note.tags" :key="tag" class="tag">
              #{{ tag }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- Tasks Section -->
    <section v-if="results.tasks?.length" class="result-group">
      <h4 class="group-title">📋 Tasks ({{ results.tasks.length }})</h4>
      <div class="result-list">
        <article
          v-for="task in results.tasks"
          :key="task.id"
          class="result-item task-result"
          @click="handleTaskClick(task)"
        >
          <h5 class="result-title">{{ task.title }}</h5>
          <p v-if="task.snippet" class="result-snippet">{{ task.snippet }}</p>
        </article>
      </div>
    </section>

    <!-- Documents Section -->
    <section v-if="results.documents?.length" class="result-group">
      <h4 class="group-title">📁 Documents ({{ results.documents.length }})</h4>
      <div class="result-list">
        <article
          v-for="doc in results.documents"
          :key="doc.id"
          class="result-item document-result"
          @click="handleDocumentClick(doc)"
        >
          <h5 class="result-title">{{ doc.title }}</h5>
          <p v-if="doc.snippet" class="result-snippet">{{ doc.snippet }}</p>
        </article>
      </div>
    </section>

    <!-- Empty state -->
    <div v-if="totalCount === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-message">No results found</div>
      <div class="empty-hint">Try a different search query</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResultItem } from '../../../shared/commands/types'

interface Props {
  query: string
  results: {
    pages?: SearchResultItem[]
    notes?: SearchResultItem[]
    tasks?: SearchResultItem[]
    documents?: SearchResultItem[]
  }
  interactive?: boolean
}

interface Emits {
  (e: 'page-open', url: string, pageId: string): void
  (e: 'note-view', noteId: string): void
  (e: 'task-activate', taskId: string): void
  (e: 'document-open', documentId: string): void
  (e: 'result-click', item: SearchResultItem): void
}

const props = withDefaults(defineProps<Props>(), {
  interactive: true
})

const emit = defineEmits<Emits>()

// Computed total count
const totalCount = computed(() => {
  return (
    (props.results.pages?.length || 0) +
    (props.results.notes?.length || 0) +
    (props.results.tasks?.length || 0) +
    (props.results.documents?.length || 0)
  )
})

// Event handlers
const handlePageClick = async (page: SearchResultItem) => {
  if (!props.interactive) return

  emit('result-click', page)

  if (page.url) {
    try {
      await chrome.tabs.create({ url: page.url })
      emit('page-open', page.url, page.id)
    } catch (error) {
      console.error('[SearchResultList] Failed to open page:', error)
    }
  }
}

const handleUrlClick = async (url: string) => {
  if (!props.interactive) return

  try {
    await chrome.tabs.create({ url })
  } catch (error) {
    console.error('[SearchResultList] Failed to open URL:', error)
  }
}

const handleNoteClick = (note: SearchResultItem) => {
  if (!props.interactive) return

  emit('result-click', note)
  emit('note-view', note.id)
}

const handleTaskClick = (task: SearchResultItem) => {
  if (!props.interactive) return

  emit('result-click', task)
  emit('task-activate', task.id)
}

const handleDocumentClick = (doc: SearchResultItem) => {
  if (!props.interactive) return

  emit('result-click', doc)
  emit('document-open', doc.id)
}

const handleFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped>
.search-results {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.results-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.result-count {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 12px;
}

.result-group {
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.result-group:last-of-type {
  border-bottom: none;
}

.group-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.favicon-placeholder {
  font-size: 16px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut {
  font-size: 12px;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.result-url {
  display: block;
  color: #3b82f6;
  font-size: 12px;
  text-decoration: none;
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-url:hover {
  text-decoration: underline;
}

.result-snippet {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.tag {
  font-size: 11px;
  color: #6366f1;
  background: #eef2ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
  margin-bottom: 12px;
}

.empty-message {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 14px;
  color: #64748b;
}

/* Result type specific styling */
.page-result {
  border-left: 3px solid #3b82f6;
}

.note-result {
  border-left: 3px solid #10b981;
}

.task-result {
  border-left: 3px solid #f59e0b;
}

.document-result {
  border-left: 3px solid #8b5cf6;
}
</style>
