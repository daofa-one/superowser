<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { NoteEntry } from '../../shared/models'

const store = useSidePanelStore()

// Current page data
const currentPage = ref<{
  id?: string
  url: string;
  title: string;
  favicon?: string;
  tags: string[];
  tasks: string[];
  noteCount: number;
  shortcut?: string;
} | null>(null)
const isLoading = ref(true)
const isPageSaved = ref(false)
const showShortcutForm = ref(false)
const shortcutInput = ref('')
const showTagForm = ref(false)
const tagInput = ref('')
const currentTags = ref<string[]>([])
const showSaveForm = ref(false)
const taskInput = ref('')
const showTaskSuggestions = ref(false)
const availableTasks = ref<string[]>([])
const filteredTasks = ref<string[]>([])
const selectedTasks = ref<string[]>([])
const showNoteForm = ref(false)
const noteContentInput = ref('')
const noteCommentInput = ref('')
const pageNotes = ref<NoteEntry[]>([])
const includePageAssociation = ref(true)
const selectedNoteTasks = ref<string[]>([])
const noteTaskInput = ref('')

const formatDateTime = (value?: Date | string) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

// Computed properties
const displayUrl = computed(() => {
  if (!currentPage.value?.url) return ''
  try {
    const url = new URL(currentPage.value.url)
    return url.hostname + url.pathname
  } catch {
    return currentPage.value.url
  }
})

const hasNotes = computed(() => {
  return (currentPage.value?.noteCount ?? 0) > 0
})

const showInitialLoader = computed(() => isLoading.value && !currentPage.value)
const isRefreshing = computed(() => isLoading.value && !!currentPage.value)


// Methods
const loadCurrentPageInfo = async () => {
  const hadPage = !!currentPage.value

  try {
    isLoading.value = true
    console.log('Loading current page info...')

    // Get current tab info via background script
    const response = await store.sendMessage({ type: 'GET_CURRENT_TAB_INFO' })

    console.log('Background response:', response)

    if (!response || response.type !== 'SUCCESS' || !response.data) {
      if (response?.type === 'ERROR') {
        console.debug('Background not ready, keeping existing page state')
      }
      if (!hadPage) {
        currentPage.value = null
        isPageSaved.value = false
      }
      return
    }

    if (response && response.type === 'SUCCESS' && response.data) {
      const tabData = response.data
      console.log('Tab data:', tabData)

      // Check if this page is already saved in the database
      const savedPageResponse = await store.sendMessage({
        type: 'GET_PAGE_BY_URL',
        data: { url: tabData.url }
      })

      if (savedPageResponse?.type === 'ERROR') {
        console.debug('Page lookup not ready, keeping existing task metadata')
      }

      let savedPage: any = null
      if (savedPageResponse && savedPageResponse.type === 'SUCCESS' && savedPageResponse.data) {
        savedPage = savedPageResponse.data
        console.log('Found saved page:', savedPage)
      }

      let noteCount = 0
      let notes: NoteEntry[] = []
      pageNotes.value = []
      if (savedPage?.id) {
        try {
          const notesResponse = await store.sendMessage({
            type: 'GET_NOTES_BY_PAGE',
            data: { pageId: savedPage.id }
          })

          if (notesResponse?.type === 'SUCCESS' && Array.isArray(notesResponse.data)) {
            notes = notesResponse.data.map((note: any) => ({
              ...note,
              createdAt: note.createdAt ? new Date(note.createdAt) : undefined,
              updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined
            }))
            noteCount = notes.length
          }
        } catch (error) {
          console.error('Failed to load notes for page:', error)
        }
      }

      currentPage.value = {
        id: savedPage?.id,
        url: tabData.url,
        title: tabData.title,
        favicon: tabData.favicon,
        tags: savedPage?.tags || [],
        tasks: savedPage?.tasks || [],
        noteCount,
        shortcut: savedPage?.shortcut || undefined
      }
      pageNotes.value = notes
      isPageSaved.value = !!savedPage
      selectedNoteTasks.value = [...(currentPage.value.tasks || [])]

      // Update selected tasks if save form is open
      if (showSaveForm.value) {
        selectedTasks.value = [...(savedPage?.tasks || [])]
        // Add current task if available and not already selected
        if (store.cache.currentTask?.name && !selectedTasks.value.includes(store.cache.currentTask.name)) {
          selectedTasks.value.push(store.cache.currentTask.name)
        }
        filterTasks()
      }
    }
  } catch (error) {
    console.error('Failed to load current page info:', error)
    if (!hadPage) {
      currentPage.value = null
      isPageSaved.value = false
      pageNotes.value = []
    }
  } finally {
    isLoading.value = false
  }
}


const openPage = async () => {
  if (!currentPage.value?.url) {
    return
  }

  try {
    const response = await store.sendMessage({
      type: 'OPEN_PAGE',
      data: { url: currentPage.value.url }
    })

    if (response?.type === 'ERROR') {
      throw new Error(response.error?.message || 'Failed to open page')
    }
  } catch (error) {
    console.error('Failed to open page:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to focus page tab'
    })
  }
}

const copyUrl = async () => {
  if (currentPage.value?.url) {
    try {
      await navigator.clipboard.writeText(currentPage.value.url)
      store.addNotification({
        type: 'success',
        message: 'URL copied to clipboard'
      })
    } catch (error) {
      store.addNotification({
        type: 'error',
        message: 'Failed to copy URL'
      })
    }
  }
}

const toggleShortcutForm = () => {
  showShortcutForm.value = !showShortcutForm.value
  if (showShortcutForm.value) {
    // Close other forms if open
    showTagForm.value = false
    showSaveForm.value = false
    showNoteForm.value = false
    // Pre-fill with existing shortcut if any
    shortcutInput.value = currentPage.value?.shortcut || ''
  }
}

const saveShortcut = async () => {
  if (!currentPage.value || !shortcutInput.value.trim()) return

  try {
    const response = await store.sendMessage({
      type: 'SAVE_SHORTCUT',
      data: {
        url: currentPage.value.url,
        shortcut: shortcutInput.value.trim()
      }
    })

    if (response && response.type === 'SUCCESS') {
      // Update current page with the new shortcut
      currentPage.value.shortcut = shortcutInput.value.trim()

      showShortcutForm.value = false
      store.addNotification({
        type: 'success',
        message: 'Shortcut saved successfully'
      })
    } else {
      throw new Error('Failed to save shortcut')
    }
  } catch (error) {
    console.error('Failed to save shortcut:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save shortcut'
    })
  }
}

const cancelShortcut = () => {
  showShortcutForm.value = false
  shortcutInput.value = ''
}

const toggleTagForm = () => {
  showTagForm.value = !showTagForm.value
  if (showTagForm.value) {
    // Close other forms if open
    showShortcutForm.value = false
    showSaveForm.value = false
    showNoteForm.value = false
    // Pre-fill with existing tags if any
    currentTags.value = [...(currentPage.value?.tags || [])]
    tagInput.value = ''
  }
}

const addTag = () => {
  const tag = tagInput.value.trim()
  if (tag && !currentTags.value.includes(tag)) {
    currentTags.value.push(tag)
    tagInput.value = ''
  }
}

const removeTag = (index: number) => {
  currentTags.value.splice(index, 1)
}

const saveTags = async () => {
  if (!currentPage.value) return

  try {
    const response = await store.sendMessage({
      type: 'SAVE_TAGS',
      data: {
        url: currentPage.value.url,
        tags: currentTags.value
      }
    })

    if (response && response.type === 'SUCCESS') {
      // Update current page with the new tags
      currentPage.value.tags = [...currentTags.value]

      showTagForm.value = false
      store.addNotification({
        type: 'success',
        message: 'Tags saved successfully'
      })
    } else {
      throw new Error('Failed to save tags')
    }
  } catch (error) {
    console.error('Failed to save tags:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save tags'
    })
  }
}

const cancelTags = () => {
  showTagForm.value = false
  tagInput.value = ''
  currentTags.value = [...(currentPage.value?.tags || [])]
}

const toggleNoteForm = () => {
  showNoteForm.value = !showNoteForm.value
  if (showNoteForm.value) {
    showShortcutForm.value = false
    showTagForm.value = false
    showSaveForm.value = false
    noteContentInput.value = ''
    noteCommentInput.value = ''
    includePageAssociation.value = true
    selectedNoteTasks.value = [...(currentPage.value?.tasks || [])]
    noteTaskInput.value = ''
  }
}

const cancelNote = () => {
  showNoteForm.value = false
  noteContentInput.value = ''
  noteCommentInput.value = ''
  selectedNoteTasks.value = []
  includePageAssociation.value = true
  noteTaskInput.value = ''
}

const normalizeTaskName = (name: string) => name.trim()

const addNoteTask = (taskName: string) => {
  const normalized = normalizeTaskName(taskName)
  if (!normalized) {
    return
  }

  if (!selectedNoteTasks.value.includes(normalized)) {
    selectedNoteTasks.value.push(normalized)
  }
  noteTaskInput.value = ''
}

const removeNoteTask = (taskName: string) => {
  selectedNoteTasks.value = selectedNoteTasks.value.filter(task => task !== taskName)
}

const resetNoteTasks = () => {
  selectedNoteTasks.value = [...(currentPage.value?.tasks || [])]
  noteTaskInput.value = ''
}

const clearNoteTasks = () => {
  selectedNoteTasks.value = []
  noteTaskInput.value = ''
}

const saveNote = async () => {
  const content = noteContentInput.value.trim()

  if (!content) {
    store.addNotification({
      type: 'error',
      message: 'Note content is required'
    })
    return
  }

  if (!currentPage.value) {
    store.addNotification({
      type: 'error',
      message: 'No page available for note'
    })
    return
  }

  try {
    if (includePageAssociation.value && !currentPage.value?.id) {
      const savePageResponse = await store.sendMessage({
        type: 'SAVE_PAGE',
        data: {
          url: currentPage.value!.url,
          title: currentPage.value!.title,
          favicon: currentPage.value?.favicon,
          tags: currentPage.value?.tags || [],
          tasks: currentPage.value?.tasks || [],
          shortcut: currentPage.value?.shortcut
        }
      })

      if (savePageResponse?.type === 'SUCCESS' && savePageResponse.data) {
        currentPage.value = {
          ...currentPage.value!,
          id: savePageResponse.data.id,
          tags: savePageResponse.data.tags || currentPage.value!.tags,
          tasks: savePageResponse.data.tasks || currentPage.value!.tasks,
          noteCount: Array.isArray(pageNotes.value) ? pageNotes.value.length : currentPage.value!.noteCount,
          shortcut: savePageResponse.data.shortcut || currentPage.value!.shortcut
        }
        isPageSaved.value = true
      } else {
        throw new Error('Failed to save page before adding note')
      }
    } else if (!includePageAssociation.value) {
      // Ensure we don't send a stale id when the user wants a task-only note
      includePageAssociation.value = false
    }

    const payload: Record<string, unknown> = {
      content
    }

    const comment = noteCommentInput.value.trim()
    if (comment) {
      payload.comment = comment
    }

    if (includePageAssociation.value && currentPage.value.id) {
      payload.pageId = currentPage.value.id
    }

    if (selectedNoteTasks.value.length > 0) {
      payload.tasks = selectedNoteTasks.value
    }

    const response = await store.sendMessage({
      type: 'SAVE_NOTE',
      data: payload
    })

    if (response?.type !== 'SUCCESS') {
      throw new Error(response?.error?.message || 'Failed to save note')
    }

    store.addNotification({
      type: 'success',
      message: 'Note saved'
    })

    cancelNote()
    await loadCurrentPageInfo()
  } catch (error) {
    console.error('Failed to save note:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save note'
    })
  }
}

const loadAvailableTasks = async () => {
  try {
    const response = await store.sendMessage({ type: 'GET_TASKS' })

    if (response && response.type === 'SUCCESS' && response.data) {
      console.log('Loaded tasks from backend:', response.data)
      availableTasks.value = response.data.map((task: any) => task.name)
      filteredTasks.value = [...availableTasks.value]
      console.log('Available task names:', availableTasks.value)
    }
  } catch (error) {
    console.error('Failed to load tasks:', error)
  }
}

const toggleSaveForm = async () => {
  showSaveForm.value = !showSaveForm.value
  if (showSaveForm.value) {
    // Close other forms if open
    showShortcutForm.value = false
    showTagForm.value = false
    showNoteForm.value = false
    // Load available tasks
    await loadAvailableTasks()
    // Pre-fill with existing tasks from saved page
    selectedTasks.value = [...(currentPage.value?.tasks || [])]
    // Add current task if available and not already selected
    if (store.cache.currentTask?.name && !selectedTasks.value.includes(store.cache.currentTask.name)) {
      selectedTasks.value.push(store.cache.currentTask.name)
    }
    taskInput.value = ''
    filterTasks()
  }
}

const filterTasks = () => {
  const query = taskInput.value.toLowerCase()
  if (!query) {
    filteredTasks.value = availableTasks.value.filter(task => !selectedTasks.value.includes(task))
  } else {
    filteredTasks.value = availableTasks.value.filter(task =>
      task.toLowerCase().includes(query) && !selectedTasks.value.includes(task)
    )
  }
  showTaskSuggestions.value = (filteredTasks.value.length > 0 || taskInput.value.length > 0) && taskInput.value.length > 0
}

const selectTask = (taskName: string) => {
  if (!selectedTasks.value.includes(taskName)) {
    selectedTasks.value.push(taskName)
  }
  taskInput.value = ''
  showTaskSuggestions.value = false
}

const removeSelectedTask = (index: number) => {
  selectedTasks.value.splice(index, 1)
}

const onTaskInputChange = () => {
  filterTasks()
}

const onTaskInputFocus = () => {
  filterTasks()
  showTaskSuggestions.value = filteredTasks.value.length > 0
}

const onTaskInputBlur = () => {
  // Delay hiding suggestions to allow for clicks
  setTimeout(() => {
    showTaskSuggestions.value = false
  }, 200)
}

const saveCurrentPage = async () => {
  if (!currentPage.value) return

  try {
    const response = await store.sendMessage({
      type: 'SAVE_CURRENT_TAB',
      data: {
        tasks: selectedTasks.value.length > 0 ? selectedTasks.value : undefined
      }
    })

    if (response && response.type === 'SUCCESS') {
      showSaveForm.value = false
      isPageSaved.value = true

      const taskMessage = selectedTasks.value.length > 0
        ? `Page saved to ${selectedTasks.value.length} task(s): ${selectedTasks.value.join(', ')}`
        : 'Page saved successfully'

      store.addNotification({
        type: 'success',
        message: taskMessage
      })

      // Reload page info to get updated data
      await loadCurrentPageInfo()
    } else {
      throw new Error('Failed to save page')
    }
  } catch (error) {
    console.error('Failed to save page:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save page'
    })
  }
}

const cancelSave = () => {
  showSaveForm.value = false
  taskInput.value = ''
  selectedTasks.value = []
}

// Listen for tab changes from background script
const onTabChange = (message: { type?: string; path?: string }, _sender: unknown, _sendResponse: unknown) => {
  if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
    console.log('Tab change detected, reloading page info...')
    loadCurrentPageInfo()
  } else if (message.type === 'STATE_UPDATE' && message.path?.startsWith('page.')) {
    // Check if this is a page update or deletion for the current page
    const currentUrl = currentPage.value?.url
    if (currentUrl && (message.path.includes('updated') || message.path.includes('deleted'))) {
      // Check if it's a URL-based update that matches current page
      const encodedCurrentUrl = encodeURIComponent(currentUrl)
      if (message.path.includes(encodedCurrentUrl) || (message.path.startsWith('page.') && (message.path.endsWith('.updated') || message.path.endsWith('.deleted')))) {
        console.log('Page update/deletion detected for current page, reloading page info...')
        loadCurrentPageInfo()
      }
    }
  }
  return false // Indicate we don't need to send a response
}

// Lifecycle
onMounted(() => {
  loadCurrentPageInfo()

  // Listen for tab changes
  chrome.runtime.onMessage.addListener(onTabChange)
})

// Cleanup listener when component unmounts
onUnmounted(() => {
  if (chrome.runtime.onMessage.hasListener(onTabChange)) {
    chrome.runtime.onMessage.removeListener(onTabChange)
  }
})
</script>

<template>
  <section class="current-page-info">
    <!-- Loading State -->
    <div v-if="showInitialLoader" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading page info...</span>
    </div>

    <!-- Content -->
    <div
      v-else-if="currentPage"
      class="page-content"
      :class="{ refreshing: isRefreshing }"
    >
      <!-- Top Section: Icon + URL -->
      <div class="top-section">
        <div class="page-icon">
          <img
            v-if="currentPage.favicon"
            :src="currentPage.favicon"
            alt="Page favicon"
            @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
          />
          <div v-else class="default-icon">🌐</div>
        </div>

        <div class="page-url">
          <div class="url-display" :title="currentPage.url">
            {{ displayUrl }}
          </div>
          <div v-if="currentPage.title" class="page-title">
            {{ currentPage.title }}
          </div>
        </div>

        <div class="page-status">
          <div
            v-if="isPageSaved"
            class="status-badge status-saved"
            title="This page is saved in Superowser"
          >
            <span class="status-icon">✓</span>
            <span class="status-text">Saved</span>
          </div>
          <div
            v-else
            class="status-badge status-unsaved"
            title="This page is not saved in Superowser"
          >
            <span class="status-icon">○</span>
            <span class="status-text">Not Saved</span>
          </div>
        </div>
      </div>

      <!-- Middle Section: Tags and Notes -->
      <div class="middle-section">
        <div class="tags-container">
          <div v-if="currentPage.tags && currentPage.tags.length > 0" class="tags">
            <span v-for="tag in currentPage.tags" :key="tag" class="tag">
              #{{ tag }}
            </span>
          </div>
          <div v-else class="no-tags">
            No tags
          </div>
        </div>

        <div class="tasks-container">
          <div v-if="currentPage.tasks && currentPage.tasks.length > 0" class="tasks">
            <span v-for="task in currentPage.tasks" :key="task" class="task">
              &{{ task }}
            </span>
          </div>
          <div v-else class="no-tasks">
            No tasks
          </div>
        </div>

        <div class="notes-container">
        <!--
          <div v-if="hasNotes" class="notes-indicator">
            📝 {{ currentPage.noteCount || 0 }} note(s)
          </div>
        -->
          <div v-if="currentPage.shortcut" class="shortcut">
            @{{ currentPage.shortcut }}
          </div>
        </div>
      </div>

      <!-- Action Section: Buttons -->
      <div class="action-section">
        <div class="action-buttons">
          <button class="btn btn-icon" title="Save page" @click="toggleSaveForm">
            👍
          </button>
          <button class="btn btn-icon" title="Set shortcut" @click="toggleShortcutForm">
            @
          </button>
          <button class="btn btn-icon" title="Manage tags" @click="toggleTagForm">
            #
          </button>
          <button class="btn btn-icon" title="Add note" @click="toggleNoteForm">
            !!
          </button>
          <button class="btn btn-icon" title="Copy URL" @click="copyUrl">
            📋
          </button>
          <!--button class="btn btn-icon" title="Open in new tab" @click="openPage">
            🔗
          </button-->
        </div>
      </div>

      <!-- Shortcut Form Section -->
      <div v-if="showShortcutForm" class="shortcut-form-section">
        <div class="form-header">
          <h4>Set Shortcut</h4>
        </div>

        <div class="form-content">
          <div class="input-group">
            <label for="shortcut-input">Shortcut:</label>
            <input
              id="shortcut-input"
              v-model="shortcutInput"
              type="text"
              placeholder="Enter shortcut (e.g., @docs)"
              class="shortcut-input"
              @keyup.enter="saveShortcut"
              @keyup.escape="cancelShortcut"
            />
          </div>

          <div class="input-group">
            <label>URL:</label>
            <input
              :value="currentPage.url"
              type="text"
              readonly
              class="url-input"
            />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="!shortcutInput.trim()" @click="saveShortcut">
            Save
          </button>
          <button class="btn btn-secondary" @click="cancelShortcut">
            Cancel
          </button>
        </div>
      </div>

      <!-- Tag Form Section -->
      <div v-if="showTagForm" class="tag-form-section">
        <div class="form-header">
          <h4>Manage Tags</h4>
        </div>

        <div class="form-content">
          <div class="input-group">
            <label for="tag-input">Add Tag:</label>
            <div class="tag-input-wrapper">
              <input
                id="tag-input"
                v-model="tagInput"
                type="text"
                placeholder="Enter tag and press Enter"
                class="tag-input"
                @keyup.enter="addTag"
                @keyup.escape="cancelTags"
              />
              <button class="btn btn-add-tag" :disabled="!tagInput.trim()" @click="addTag">
                Add
              </button>
            </div>
          </div>

          <div v-if="currentTags.length > 0" class="current-tags">
            <label>Current Tags:</label>
            <div class="tags-list">
              <span
                v-for="(tag, index) in currentTags"
                :key="tag"
                class="tag-item"
              >
                {{ tag }}
                <button class="tag-remove" @click="removeTag(index)">×</button>
              </span>
            </div>
          </div>
          <div v-else class="no-tags-message">
            No tags yet. Add your first tag above.
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" @click="saveTags">
            Save Tags
          </button>
          <button class="btn btn-secondary" @click="cancelTags">
            Cancel
          </button>
        </div>
      </div>

      <!-- Note Form Section -->
      <div v-if="showNoteForm" class="note-form-section">
        <div class="form-header">
          <h4>Add Note</h4>
        </div>

        <div class="form-content">
          <div class="input-group">
            <label for="note-content-input">Note *</label>
            <textarea
              id="note-content-input"
              v-model="noteContentInput"
              rows="4"
              placeholder="Write your note here"
              class="note-textarea"
              @keyup.escape="cancelNote"
            ></textarea>
          </div>

          <div class="input-group">
            <label for="note-comment-input">Comment (optional)</label>
            <input
              id="note-comment-input"
              v-model="noteCommentInput"
              type="text"
              placeholder="Add a short comment"
              class="note-comment-input"
              @keyup.escape="cancelNote"
            />
          </div>

          <div class="input-group association-group">
            <label>Link to page</label>
            <div class="association-row">
              <label class="association-toggle">
                <input
                  v-model="includePageAssociation"
                  type="checkbox"
                />
                <span>Include current page</span>
              </label>
              <span v-if="includePageAssociation && currentPage" class="association-chip">
                {{ currentPage.title || displayUrl }}
                <button type="button" @click="includePageAssociation = false">×</button>
              </span>
              <span v-else class="association-hint">Note will not be linked to the page.</span>
            </div>
          </div>

          <div class="input-group association-group">
            <label>Link to tasks</label>
            <div class="association-row">
              <div v-if="selectedNoteTasks.length" class="association-chips">
                <span v-for="task in selectedNoteTasks" :key="task" class="association-chip">
                  &{{ task }}
                  <button type="button" @click="removeNoteTask(task)">×</button>
                </span>
              </div>
              <span v-else class="association-hint">No tasks linked</span>
            </div>
            <div class="task-chip-actions">
              <button type="button" class="btn btn-secondary" @click="resetNoteTasks">
                Use page tasks
              </button>
              <button type="button" class="btn btn-secondary" @click="clearNoteTasks">
                Clear tasks
              </button>
              <input
                v-model="noteTaskInput"
                type="text"
                placeholder="Type to add task"
                class="note-task-input"
                @keyup.enter.prevent="noteTaskInput && addNoteTask(noteTaskInput)"
              />
            </div>
          </div>

          <p class="note-hint">
            Use the toggles above to keep the note connected to this page, specific tasks, or both.
          </p>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="!noteContentInput.trim()" @click="saveNote">
            Save Note
          </button>
          <button class="btn btn-secondary" @click="cancelNote">
            Cancel
          </button>
        </div>
      </div>

      <!-- Saved Notes Section -->
      <div v-if="pageNotes.length > 0" class="notes-section">
        <div class="notes-header">
          <h4>Saved Notes</h4>
          <span class="notes-count">{{ pageNotes.length }}</span>
        </div>
        <ul class="notes-list">
          <li v-for="note in pageNotes" :key="note.id" class="note-item">
            <p class="note-content">{{ note.content }}</p>
            <p v-if="note.comment" class="note-comment">💬 {{ note.comment }}</p>
            <div class="note-meta">
              <span class="note-timestamp">{{ formatDateTime(note.createdAt) }}</span>
              <div class="note-links">
                <span v-if="note.pageId" class="note-link-badge">📄 Page</span>
                <div v-if="note.tasks && note.tasks.length" class="note-tasks">
                  <span v-for="task in note.tasks" :key="task" class="note-task">&{{ task }}</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Save Page Form Section -->
      <div v-if="showSaveForm" class="save-form-section">
        <div class="form-header">
          <h4>Save Page</h4>
        </div>

        <div class="form-content">
          <!-- Selected Tasks Display -->
          <div v-if="selectedTasks.length > 0" class="input-group">
            <label>Selected Tasks:</label>
            <div class="selected-tasks-list">
              <span
                v-for="(task, index) in selectedTasks"
                :key="task"
                class="selected-task-item"
              >
                📁 {{ task }}
                <button class="task-remove" @click="removeSelectedTask(index)">×</button>
              </span>
            </div>
          </div>

          <div class="input-group">
            <label for="task-input">Add Task (optional):</label>
            <div class="task-input-wrapper">
              <input
                id="task-input"
                v-model="taskInput"
                type="text"
                placeholder="Type to search tasks or create new"
                class="task-input"
                autocomplete="off"
                @input="onTaskInputChange"
                @focus="onTaskInputFocus"
                @blur="onTaskInputBlur"
                @keyup.enter="taskInput && selectTask(taskInput)"
                @keyup.escape="cancelSave"
              />

              <!-- Task Suggestions Dropdown -->
              <div v-if="showTaskSuggestions" class="task-suggestions">
                <div
                  v-for="task in filteredTasks"
                  :key="task"
                  class="task-suggestion-item"
                  @mousedown="selectTask(task)"
                >
                  📁 {{ task }}
                </div>
                <div v-if="taskInput && !filteredTasks.includes(taskInput) && !selectedTasks.includes(taskInput)" class="task-suggestion-item create-new" @mousedown="selectTask(taskInput)">
                  ➕ Create new task: "{{ taskInput }}"
                </div>
              </div>
            </div>

            <div v-if="store.cache.currentTask" class="current-task-info">
              Current active task: <strong>{{ store.cache.currentTask.name }}</strong>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" @click="saveCurrentPage">
            👍 Save Page
          </button>
          <button class="btn btn-secondary" @click="cancelSave">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- No Page State -->
    <div v-else class="no-page-state">
      <div class="empty-icon">🌍</div>
      <div class="empty-message">No active page</div>
    </div>
  </section>
</template>

<style scoped>
.current-page-info {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.page-content {
  transition: opacity 0.2s ease;
}

.page-content.refreshing {
  opacity: 0.85;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f0f0f0;
  border-left: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Top Section */
.top-section {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.page-status {
  flex-shrink: 0;
  margin-left: auto;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
}

.status-saved {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-unsaved {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #e9ecef;
}

.status-icon {
  font-size: 10px;
  line-height: 1;
}

.status-text {
  font-size: 10px;
  line-height: 1;
}

.page-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}

.page-icon img {
  width: 16px;
  height: 16px;
}

.default-icon {
  font-size: 16px;
}

.page-url {
  flex: 1;
  min-width: 0;
}

.url-display {
  font-size: 13px;
  color: #007bff;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-title {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
  font-weight: normal;
  line-height: 1.3;
  max-height: 1.3em; /* 1 line max */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Middle Section */
.middle-section {
  margin-bottom: 12px;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.tags-container {
  margin-bottom: 8px;
}

.tasks-container {
  margin-bottom: 8px;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  background: #f0f8ff;
  color: #0066cc;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e0f0ff;
}

.no-tags {
  font-size: 12px;
  color: #999;
  font-style: italic;
}

.tasks {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.task {
  font-size: 12px;
  background: #fff3cd;
  color: #856404;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ffeaa7;
}

.no-tasks {
  font-size: 12px;
  color: #999;
  font-style: italic;
}

.notes-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notes-indicator {
  font-size: 12px;
  color: #666;
}

.shortcut {
  font-size: 12px;
  background: #f8f9fa;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* Action Section */
.action-section {
  display: flex;
  justify-content: center;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

/* Buttons */
.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  min-height: 32px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 6px;
  background: #f8f9fa;
  color: #495057;
  font-size: 14px;
}

.btn-icon:hover:not(:disabled) {
  background: #e9ecef;
}

/* Shortcut Form Section */
.shortcut-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.form-header {
  margin-bottom: 12px;
}

.form-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-content {
  margin-bottom: 16px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 4px;
}

.shortcut-input,
.url-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.shortcut-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.url-input {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-actions .btn {
  min-width: 70px;
}

/* Tag Form Section */
.tag-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.note-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.association-group {
  margin-top: 16px;
}

.association-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.association-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #1f2937;
}

.association-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e0f2fe;
  color: #0c4a6e;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}

.association-chip button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}

.association-hint {
  font-size: 12px;
  color: #64748b;
}

.association-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.task-chip-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.notes-section {
  margin-top: 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.notes-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.notes-count {
  font-size: 12px;
  color: #666;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 2px 8px;
}

.notes-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-item {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.note-content {
  margin: 0 0 6px;
  font-size: 14px;
  color: #1f2937;
  white-space: pre-wrap;
}

.note-comment {
  margin: 0 0 6px;
  font-size: 13px;
  color: #475569;
}

.note-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #64748b;
}

.note-timestamp {
  font-style: italic;
}

.note-links {
  display: flex;
  gap: 6px;
  align-items: center;
}

.note-link-badge {
  background: #fef3c7;
  color: #92400e;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
}

.note-tasks {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.note-task {
  background: #e0f2fe;
  color: #0c4a6e;
  border-radius: 999px;
  padding: 2px 8px;
}

.tag-input-wrapper {
  display: flex;
  gap: 8px;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.tag-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.btn-add-tag {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add-tag:hover:not(:disabled) {
  background: #0056b3;
}

.btn-add-tag:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.current-tags {
  margin-top: 16px;
}

.current-tags label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 13px;
  border: 1px solid #bbdefb;
}

.tag-remove {
  background: none;
  border: none;
  color: #1976d2;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.no-tags-message {
  margin-top: 12px;
  font-size: 13px;
  color: #999;
  font-style: italic;
}

/* Save Form Section */
.save-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #c3d9ff;
}

.task-input-wrapper {
  position: relative;
}

.task-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.note-textarea {
  width: 100%;
  min-height: 120px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.note-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.note-comment-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.note-comment-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.note-task-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.note-task-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.note-hint {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.task-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.task-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
}

.task-suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.task-suggestion-item:hover {
  background-color: #f5f5f5;
}

.task-suggestion-item:last-child {
  border-bottom: none;
}

.task-suggestion-item.create-new {
  background-color: #e8f5e8;
  color: #2e7d32;
  font-style: italic;
}

.task-suggestion-item.create-new:hover {
  background-color: #c8e6c9;
}

.current-task-info {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
  padding: 6px 8px;
  background: #e3f2fd;
  border-radius: 4px;
  border-left: 3px solid #2196f3;
}

.selected-tasks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.selected-task-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e8f5e8;
  color: #2e7d32;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 13px;
  border: 1px solid #c8e6c9;
}

.task-remove {
  background: none;
  border: none;
  color: #2e7d32;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.task-remove:hover {
  opacity: 1;
}

/* No Page State */
.no-page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
}
</style>
