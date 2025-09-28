<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { NoteEntry, PageEntry, NoteCategory } from '../../shared/models'
import NotesList from '../components/notes/NotesList.vue'

const store = useSidePanelStore()

// State
const notes = ref<NoteEntry[]>([])
const pages = ref<Record<string, PageEntry>>({}) // Cache pages by ID
const isLoading = ref(false)
const searchQuery = ref('')
const filterTag = ref('')
const filterTask = ref('')
const availableTags = ref<string[]>([])
const availableTasks = ref<string[]>([])
const availableCategories = ref<NoteCategory[]>([])
const filterCategory = ref<NoteCategory | ''>('')

type FilterTabId = 'tags' | 'category' | 'tasks'
const activeFilterTab = ref<FilterTabId | null>('tags')

const NOTE_CATEGORY_ORDER: NoteCategory[] = ['note', 'plan', 'brainstorm', 'highlight']

const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  note: 'General note',
  plan: 'Plan / blueprint',
  brainstorm: 'Brainstorm',
  highlight: 'Highlight'
}

const normalizeCategory = (value?: string | null): NoteCategory => {
  const normalized = (value ?? 'note').toLowerCase()
  return NOTE_CATEGORY_ORDER.includes(normalized as NoteCategory)
    ? (normalized as NoteCategory)
    : 'note'
}

const filterTabs = computed(() => {
  return [
    {
      id: 'tags' as FilterTabId,
      label: 'Tags',
      hasValue: Boolean(filterTag.value),
      disabled: availableTags.value.length === 0 && !filterTag.value
    },
    {
      id: 'category' as FilterTabId,
      label: 'Type',
      hasValue: Boolean(filterCategory.value),
      disabled: availableCategories.value.length === 0 && !filterCategory.value
    },
    {
      id: 'tasks' as FilterTabId,
      label: 'Tasks',
      hasValue: Boolean(filterTask.value),
      disabled: availableTasks.value.length === 0 && !filterTask.value
    }
  ]
})

const toggleFilterTab = (tabId: FilterTabId) => {
  const tab = filterTabs.value.find(entry => entry.id === tabId)
  if (!tab || (tab.disabled && !tab.hasValue)) {
    return
  }
  activeFilterTab.value = activeFilterTab.value === tabId ? null : tabId
}

watch(filterTabs, (tabs) => {
  if (activeFilterTab.value) {
    const active = tabs.find(tab => tab.id === activeFilterTab.value)
    if (!active || (active.disabled && !active.hasValue)) {
      activeFilterTab.value = null
    }
  }

  if (!activeFilterTab.value) {
    const fallback = tabs.find(tab => tab.hasValue) || tabs.find(tab => !tab.disabled)
    activeFilterTab.value = fallback ? fallback.id : null
  }
}, { immediate: true })

const normalizeTag = (tag: string): string | null => {
  const trimmed = tag.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
}

const normalizeTask = (task: string): string | null => {
  const trimmed = task.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.startsWith('&') ? trimmed.slice(1) : trimmed
}

const buildQueryTokens = (input: string): string[] => {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) {
    return []
  }

  const tokens = new Set<string>()

  // Add full query and individual words
  tokens.add(trimmed)
  trimmed.split(/\s+/).forEach(part => tokens.add(part))

  const normalizedTag = normalizeTag(input)
  if (normalizedTag) {
    tokens.add(normalizedTag.toLowerCase())
  }

  const normalizedTask = normalizeTask(input)
  if (normalizedTask) {
    tokens.add(normalizedTask.toLowerCase())
  }

  if (trimmed.startsWith('@')) {
    tokens.add(trimmed.slice(1))
  }

  const normalizedCategory = NOTE_CATEGORY_ORDER.find(category => trimmed.includes(category))
  if (normalizedCategory) {
    tokens.add(normalizedCategory)
  }

  return Array.from(tokens).filter(Boolean)
}

const toTagList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : []

  return Array.from(new Set(
    rawValues
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => normalizeTag(tag))
      .filter((tag): tag is string => !!tag)
  ))
}

const toTaskList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : []

  return Array.from(new Set(
    rawValues
      .filter((task): task is string => typeof task === 'string')
      .map(task => normalizeTask(task))
      .filter((task): task is string => !!task)
  ))
}

// Computed
const filteredNotes = computed(() => {
  let result = notes.value

  // Search filter
  if (searchQuery.value.trim()) {
    const tokens = buildQueryTokens(searchQuery.value)
    result = result.filter(note => {
      if (tokens.length === 0) {
        return true
      }

      const noteContent = note.content.toLowerCase()
      const noteComment = note.comment ? note.comment.toLowerCase() : ''
      const noteTasks = toTaskList(note.tasks).map(task => task.toLowerCase())
      const noteTags = toTagList(note.tags).map(tag => tag.toLowerCase())
      const noteCategory = normalizeCategory(note.category).toLowerCase()

      const matchesContent = tokens.some(token =>
        noteContent.includes(token) ||
        (noteComment && noteComment.includes(token))
      )

      const matchesTasks = tokens.some(token =>
        noteTasks.some(task => task.includes(token))
      )

      const matchesNoteTags = tokens.some(token =>
        noteTags.some(tag => tag.includes(token))
      )

      // Also search in associated page tags
      const page = note.pageId ? pages.value[note.pageId] : null
      const pageTags = toTagList(page?.tags).map(tag => tag.toLowerCase())
      const matchesPageTags = tokens.some(token =>
        pageTags.some(tag => tag.includes(token))
      )

      const matchesCategory = tokens.some(token => noteCategory.includes(token))

      return matchesContent || matchesTasks || matchesNoteTags || matchesPageTags || matchesCategory
    })
  }

  // Tag filter (based on associated page tags)
  if (filterTag.value) {
    result = result.filter(note => {
      const page = note.pageId ? pages.value[note.pageId] : null
      const pageTags = toTagList(page?.tags)
      const noteTags = toTagList(note.tags)
      return pageTags.includes(filterTag.value) || noteTags.includes(filterTag.value)
    })
  }

  // Task filter
  if (filterTask.value) {
    result = result.filter(note => {
      const noteTasks = toTaskList(note.tasks)
      return noteTasks.includes(filterTask.value)
    })
  }

  if (filterCategory.value) {
    result = result.filter(note => normalizeCategory(note.category) === filterCategory.value)
  }

  return result
})

const notesCount = computed(() => filteredNotes.value.length)
const totalNotesCount = computed(() => notes.value.length)

// Methods
const loadAllNotes = async () => {
  try {
    isLoading.value = true

    // Get all notes using the dedicated message type
    const response = await store.sendMessage({
      type: 'GET_ALL_NOTES'
    })

    if (response?.type === 'SUCCESS' && response.data) {
      const categorySet = new Set<NoteCategory>()

      notes.value = response.data
        .map((note: NoteEntry) => {
          const category = normalizeCategory(note.category)
          categorySet.add(category)

          return {
            ...note,
            category,
            createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
            updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date()
          }
        })
        .sort((a: NoteEntry, b: NoteEntry) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

      // Load pages for notes that have page associations
      const pageIds = [...new Set(notes.value.map(note => note.pageId).filter(Boolean))]
      const pageData: Record<string, PageEntry> = {}

      // Fetch all associated pages
      await Promise.all(pageIds.map(async (pageId) => {
        try {
          const pageResponse = await store.sendMessage({
            type: 'GET_PAGE',
            data: { id: pageId }
          })
          if (pageResponse?.type === 'SUCCESS' && pageResponse.data) {
            pageData[pageId] = pageResponse.data
          }
        } catch (error) {
          console.warn(`Failed to load page ${pageId}:`, error)
        }
      }))

      pages.value = pageData

      // Collect tags from notes/pages (handles legacy data) and tasks from notes
      const allTags = new Set<string>()
      const allTasks = new Set<string>()

      notes.value.forEach(note => {
        // Collect tasks from notes
        const noteTasks = toTaskList(note.tasks)
        noteTasks.forEach(task => allTasks.add(task))

        // Collect tags saved on the note (legacy data support)
        const noteTags = toTagList(note.tags) // Legacy notes may store tags directly
        noteTags.forEach(tag => allTags.add(tag))

        // Collect tags from associated pages
        if (note.pageId && pageData[note.pageId]) {
          const page = pageData[note.pageId]
          const pageTags = toTagList(page.tags)
          pageTags.forEach(tag => allTags.add(tag))
        }
      })

      const sortedCategories = Array.from(categorySet).sort((a, b) => {
        return NOTE_CATEGORY_ORDER.indexOf(a) - NOTE_CATEGORY_ORDER.indexOf(b)
      })

      availableCategories.value = sortedCategories

      try {
        // Merge with background's popular tag stats to backfill legacy data
        const popularTagsResponse = await store.sendMessage({
          type: 'GET_POPULAR_TAGS'
        })

        if (popularTagsResponse?.type === 'SUCCESS' && Array.isArray(popularTagsResponse.data)) {
          popularTagsResponse.data.forEach((entry: { tag: string }) => {
            const normalized = normalizeTag(entry.tag)
            if (normalized) {
              allTags.add(normalized)
            }
          })
        }

      } catch (error) {
        console.warn('Failed to load popular tags:', error)
      }

      availableTags.value = Array.from(allTags).sort()
      availableTasks.value = Array.from(allTasks).sort()
    }
  } catch (error) {
    console.error('Failed to load notes:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to load notes'
    })
  } finally {
    isLoading.value = false
  }
}

const handleNoteUpdated = () => {
  // Reload notes when a note is updated
  loadAllNotes()
}

const handleNoteDeleted = () => {
  // Reload notes when a note is deleted
  loadAllNotes()
}

const handleNoteEdit = (noteId: string) => {
  console.log('Note editing started:', noteId)
}

const clearFilters = () => {
  searchQuery.value = ''
  filterTag.value = ''
  filterTask.value = ''
  filterCategory.value = ''
  const fallback = filterTabs.value.find(tab => tab.hasValue) || filterTabs.value.find(tab => !tab.disabled)
  activeFilterTab.value = fallback ? fallback.id : null
}

const exportNotes = () => {
  try {
    const dataStr = JSON.stringify(filteredNotes.value, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `notes-export-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()

    store.addNotification({
      type: 'success',
      message: `Exported ${filteredNotes.value.length} notes`
    })
  } catch (error) {
    console.error('Failed to export notes:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to export notes'
    })
  }
}

// Listen for updates from background script
const onBackgroundUpdate = (message: { type?: string; path?: string }, _sender: unknown, _sendResponse: unknown) => {
  if (message.type === 'STATE_UPDATE') {
    // Reload notes when pages or notes are updated
    if (message.path?.startsWith('page.') || message.path?.startsWith('note.')) {
      console.log('Page/Note update detected, reloading notes...')
      loadAllNotes()
    }
  }
  return false // Indicate we don't need to send a response
}

// Lifecycle
onMounted(() => {
  loadAllNotes()

  // Listen for background state updates
  chrome.runtime.onMessage.addListener(onBackgroundUpdate)
})

onUnmounted(() => {
  // Cleanup listener when component unmounts
  if (chrome.runtime.onMessage.hasListener(onBackgroundUpdate)) {
    chrome.runtime.onMessage.removeListener(onBackgroundUpdate)
  }
})
</script>

<template>
  <div class="notes-view">
    <!-- Header -->
    <div class="notes-header">
      <h2 class="notes-title">📝 Notes</h2>
      <div class="notes-header-actions">
        <div class="notes-stats">
          <span v-if="notesCount !== totalNotesCount">
            {{ notesCount }} of {{ totalNotesCount }} notes
          </span>
          <span v-else>
            {{ totalNotesCount }} notes
          </span>
        </div>
        <button
          class="btn btn-secondary btn-small"
          :disabled="filteredNotes.length === 0"
          @click="exportNotes"
        >
          Export
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="notes-controls">
      <div class="search-row">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search notes..."
          class="search-input"
        />
        <button
          v-if="searchQuery || filterTag || filterTask || filterCategory"
          class="btn btn-secondary btn-small"
          @click="clearFilters"
        >
          Clear
        </button>
      </div>

      <div class="filter-controls">
        <div class="filter-tabs" role="tablist" aria-label="Notes filters">
          <button
            v-for="tab in filterTabs"
            :key="tab.id"
            type="button"
            class="filter-tab"
            :class="{ active: tab.id === activeFilterTab, 'has-value': tab.hasValue }"
            :disabled="tab.disabled && !tab.hasValue"
            :aria-pressed="tab.id === activeFilterTab"
            @click="toggleFilterTab(tab.id)"
          >
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.hasValue" class="tab-indicator" aria-hidden="true"></span>
          </button>
        </div>

        <div v-if="activeFilterTab === 'tags'" class="filter-panel">
          <label class="filter-panel-label" for="notes-filter-tags">Filter by tag</label>
          <select
            id="notes-filter-tags"
            v-model="filterTag"
            class="filter-select"
          >
            <option value="">All tags</option>
            <option v-for="tag in availableTags" :key="tag" :value="tag" :title="`#${tag}`">
              #{{ tag.length > 20 ? tag.slice(0, 20) + '...' : tag }}
            </option>
          </select>
        </div>

        <div v-else-if="activeFilterTab === 'category'" class="filter-panel">
          <label class="filter-panel-label" for="notes-filter-category">Filter by type</label>
          <select
            id="notes-filter-category"
            v-model="filterCategory"
            class="filter-select"
          >
            <option value="">All types</option>
            <option
              v-for="category in availableCategories"
              :key="category"
              :value="category"
            >
              {{ NOTE_CATEGORY_LABELS[category] }}
            </option>
          </select>
        </div>

        <div v-else-if="activeFilterTab === 'tasks'" class="filter-panel">
          <label class="filter-panel-label" for="notes-filter-task">Filter by task</label>
          <select
            id="notes-filter-task"
            v-model="filterTask"
            class="filter-select"
          >
            <option value="">All tasks</option>
            <option v-for="task in availableTasks" :key="task" :value="task" :title="`&${task}`">
              &{{ task.length > 20 ? task.slice(0, 20) + '...' : task }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading notes...</span>
    </div>

    <!-- Notes List -->
    <div v-else-if="filteredNotes.length > 0" class="notes-content">
      <NotesList
        :notes="filteredNotes"
        :show-page-association="true"
        :show-task-association="true"
        :allow-edit="true"
        :allow-delete="true"
        :show-empty-state="true"
        :empty-message="searchQuery || filterTag || filterTask ? 'No notes match your filters' : 'No notes found'"
        :context-menu-actions="['edit', 'removeFromPage', 'removeFromTask', 'delete']"
        @note-updated="handleNoteUpdated"
        @note-deleted="handleNoteDeleted"
        @note-edited="handleNoteEdit"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">📝</div>
      <div class="empty-title">
        <span v-if="searchQuery || filterTag || filterTask">No notes match your filters</span>
        <span v-else>No notes yet</span>
      </div>
      <div class="empty-description">
        <span v-if="searchQuery || filterTag || filterTask">
          Try adjusting your search or clearing filters to see more notes.
        </span>
        <span v-else>
          Start taking notes by visiting pages and using the side panel to add notes.
        </span>
      </div>
      <button
        v-if="searchQuery || filterTag || filterTask"
        class="btn btn-primary"
        @click="clearFilters"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.notes-view {
  padding: 16px;
}

.notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.notes-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.notes-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notes-stats {
  font-size: 13px;
  color: #64748b;
}

.notes-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.filter-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.filter-tab:hover:not(:disabled) {
  border-color: #3b82f6;
}

.filter-tab:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.filter-tab.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #ffffff;
}

.filter-tab.has-value:not(.active) {
  border-color: #1d4ed8;
  color: #1d4ed8;
}

.tab-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-panel-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.filter-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #3b82f6;
}


.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #64748b;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
}

.empty-description {
  font-size: 14px;
  color: #64748b;
  max-width: 320px;
  line-height: 1.5;
}

.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
