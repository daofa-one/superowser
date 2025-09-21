<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'

const store = useSidePanelStore()

// Current page data
const currentPage = ref<{
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
  return currentPage.value?.noteCount > 0
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

      let savedPage = null
      if (savedPageResponse && savedPageResponse.type === 'SUCCESS' && savedPageResponse.data) {
        savedPage = savedPageResponse.data
        console.log('Found saved page:', savedPage)
      }

      currentPage.value = {
        url: tabData.url,
        title: tabData.title,
        favicon: tabData.favicon,
        tags: savedPage?.tags || [],
        tasks: savedPage?.tasks || [],
        noteCount: savedPage?.noteCount || 0,
        shortcut: savedPage?.shortcut || undefined
      }
      isPageSaved.value = !!savedPage

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
  currentTags.value = []
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
          <div v-if="hasNotes" class="notes-indicator">
            📝 {{ currentPage.noteCount || 0 }} note(s)
          </div>
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
          <button class="btn btn-icon" title="Copy URL" @click="copyUrl">
            📋
          </button>
          <button class="btn btn-icon" title="Open in new tab" @click="openPage">
            🔗
          </button>
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
