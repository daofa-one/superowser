<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { PageEntry, TaskEntry, DocumentEntry } from '../../shared/models'

const store = useSidePanelStore()

interface TaskContentPayload {
  task: TaskEntry | null
  pages: PageEntry[]
  notes: unknown[]
}

interface TaskWithStats extends TaskEntry {
  pageCount?: number
  noteCount?: number
}

interface RuntimeMessage {
  type?: string
  path?: string
  value?: unknown
  timestamp?: string
}

// Component state
const currentTask = ref<TaskEntry | null>(null)
const taskPages = ref<PageEntry[]>([])
const taskDocuments = ref<DocumentEntry[]>([])
const isLoading = ref(true)
const showTaskSelector = ref(false)
const availableTasks = ref<TaskWithStats[]>([])
const isLoadingTasks = ref(false)
const taskFilter = ref('')
const selectedTaskName = ref<string | null>(null)
const isSettingTask = ref(false)

const filteredTasks = computed<TaskWithStats[]>(() => {
  const query = taskFilter.value.trim().toLowerCase()
  if (!query) {
    return availableTasks.value
  }

  return availableTasks.value.filter(task => {
    const matchesName = task.name.toLowerCase().includes(query)
    const matchesDescription = task.description?.toLowerCase().includes(query)
    return matchesName || !!matchesDescription
  })
})

const selectedTask = computed<TaskWithStats | null>(() => {
  if (!selectedTaskName.value) {
    return null
  }

  return availableTasks.value.find(task => task.name === selectedTaskName.value) || null
})

const cachedTaskName = computed(() => normalizeTaskName(store.cache.currentTask?.name))

const currentTaskName = computed(() => {
  const local = normalizeTaskName(currentTask.value?.name)
  if (local) return local
  const cached = cachedTaskName.value
  return cached || null
})

const syncCurrentTaskWithStore = (nextTask: TaskEntry | null) => {
  const previous = store.cache.currentTask
  const previousId = previous?.id || null
  const nextId = nextTask?.id || null

  if (previousId !== nextId) {
    store.updateCache('previousTask', previous || null)
  }

  store.updateCache('currentTask', nextTask)
}

const applyCurrentTask = async (task: TaskEntry | null) => {
  currentTask.value = task
  syncCurrentTaskWithStore(task)

  if (task) {
    await loadTaskPages(task.name)
    await loadTaskDocuments(task.id)
    if (showTaskSelector.value) {
      selectedTaskName.value = task.name
    }
  } else {
    taskPages.value = []
    taskDocuments.value = []
    if (showTaskSelector.value) {
      selectedTaskName.value = null
    }
  }
}

// Computed properties
const displayUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname + urlObj.pathname
  } catch {
    return url
  }
}

// Methods
const loadCurrentTask = async () => {
  try {
    isLoading.value = true

    // Get current active task
    const taskResponse = await store.sendMessage({
      type: 'GET_ACTIVE_TASK'
    }) as { type: string; data?: TaskEntry | null }

    if (taskResponse?.type === 'SUCCESS') {
      await applyCurrentTask(taskResponse.data ?? null)
    } else {
      await applyCurrentTask(null)
    }
  } catch (error) {
    console.error('Failed to load current task:', error)
    await applyCurrentTask(null)
  } finally {
    isLoading.value = false
  }
}

const loadTaskPages = async (taskName: string) => {
  try {
    const response = await store.sendMessage({
      type: 'GET_TASK_CONTENT',
      data: { taskName }
    }) as { type: string; data?: TaskContentPayload }

    if (response?.type === 'SUCCESS' && response.data) {
      taskPages.value = response.data.pages || []
    } else {
      taskPages.value = []
    }
  } catch (error) {
    console.error('Failed to load task pages:', error)
    taskPages.value = []
  }
}

const loadTaskDocuments = async (taskId: string) => {
  try {
    const response = await store.sendMessage({
      type: 'GET_TASK_DOCUMENTS',
      data: { taskId }
    }) as { type: string; data?: DocumentEntry[] }

    if (response?.type === 'SUCCESS' && response.data) {
      taskDocuments.value = response.data || []
    } else {
      taskDocuments.value = []
    }
  } catch (error) {
    console.error('Failed to load task documents:', error)
    taskDocuments.value = []
  }
}

const openPage = async (url: string) => {
  try {
    const response = await store.sendMessage({
      type: 'OPEN_PAGE',
      data: { url }
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

const openDocument = async (document: DocumentEntry) => {
  try {
    const response = await store.sendMessage({
      type: 'OPEN_AUTHORING_WORKSPACE',
      data: {
        documentId: document.id,
        taskId: document.taskId
      }
    })

    if (response?.type === 'ERROR') {
      throw new Error(response.error?.message || 'Failed to open document')
    }
  } catch (error) {
    console.error('Failed to open document:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to open authoring workspace'
    })
  }
}

const removeFromTask = async (page: PageEntry) => {
  if (!currentTask.value) {
    store.addNotification({
      type: 'error',
      message: 'No active task found'
    })
    return
  }

  try {
    await store.sendMessage({
      type: 'REMOVE_PAGE_FROM_TASK',
      data: {
        taskName: currentTask.value.name,
        pageId: page.id
      }
    })

    // Refresh the page list
    await loadTaskPages(currentTask.value.name)
    await loadTaskDocuments(currentTask.value.id)

    store.addNotification({
      type: 'success',
      message: `Removed "${page.title}" from task`
    })
  } catch (error) {
    console.error('Failed to remove page from task:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to remove page from task'
    })
  }
}

const deletePageCompletely = async (page: PageEntry) => {
  if (!confirm(`Delete "${page.title}" permanently? This cannot be undone.`)) {
    return
  }

  try {
    await store.sendMessage({
      type: 'DELETE_PAGE',
      data: { id: page.id }
    })

    // Refresh the page list if we still have an active task
    if (currentTask.value) {
      await loadTaskPages(currentTask.value.name)
      await loadTaskDocuments(currentTask.value.id)
    }

    store.addNotification({
      type: 'success',
      message: `Deleted "${page.title}" permanently`
    })
  } catch (error) {
    console.error('Failed to delete page:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to delete page'
    })
  }
}

const showTaskSelection = async () => {
  showTaskSelector.value = true
  taskFilter.value = ''
  await loadAvailableTasks()
}

const loadAvailableTasks = async () => {
  try {
    isLoadingTasks.value = true

    const response = await store.sendMessage({
      type: 'GET_TASKS'
    }) as { type: string; data?: TaskWithStats[] }

    if (response?.type === 'SUCCESS' && Array.isArray(response.data)) {
      availableTasks.value = response.data.map(task => ({
        ...task,
        name: (task.name ?? '').trim()
      }))

      const preferred = normalizeTaskName(selectedTaskName.value) || currentTaskName.value || availableTasks.value[0]?.name || null
      if (preferred && availableTasks.value.some(task => task.name === preferred)) {
        selectedTaskName.value = preferred
      } else {
        selectedTaskName.value = currentTaskName.value || availableTasks.value[0]?.name || null
      }
    } else {
      availableTasks.value = []
      selectedTaskName.value = null
    }
  } catch (error) {
    console.error('Failed to load available tasks:', error)
    availableTasks.value = []
    selectedTaskName.value = null
  } finally {
    isLoadingTasks.value = false
  }
}

function normalizeTaskName(name: string | null | undefined): string {
  return (name ?? '').trim()
}

const confirmActiveTask = async () => {
  if (!selectedTaskName.value) {
    return
  }

  if (selectedTaskName.value === currentTask.value?.name) {
    store.addNotification({
      type: 'info',
      message: 'Selected task is already active'
    })
    showTaskSelector.value = false
    return
  }

  const desiredName = normalizeTaskName(selectedTaskName.value)

  if (!desiredName) {
    store.addNotification({
      type: 'error',
      message: 'Cannot set an empty task name as active'
    })
    return
  }

  const nextTask = availableTasks.value.find(task => normalizeTaskName(task.name) === desiredName)

  if (!nextTask) {
    store.addNotification({
      type: 'error',
      message: 'Selected task could not be found'
    })
    return
  }

  const previousTask = currentTask.value
  const previousPages = [...taskPages.value]

  // Optimistically apply the choice so the UI refreshes instantly.
  await applyCurrentTask(nextTask)

  try {
    const response = await store.sendMessage({
      type: 'SET_ACTIVE_TASK',
      data: { taskName: desiredName }
    })

    showTaskSelector.value = false

    if (response?.type === 'SUCCESS' && response.data) {
      await applyCurrentTask(response.data)
    } else {
      await loadCurrentTask()
    }

    store.addNotification({
      type: 'success',
      message: `Set "${nextTask.name}" as active task`
    })

    await loadAvailableTasks()
  } catch (error) {
    console.error('Failed to set active task:', error)
    // Revert optimistic update
    await applyCurrentTask(previousTask)
    taskPages.value = previousPages

    store.addNotification({
      type: 'error',
      message: 'Failed to set active task'
    })
  }
}

const handleTaskActivation = async (taskName: string) => {
  selectedTaskName.value = taskName
  await confirmActiveTask()
}

const cancelTaskSelection = () => {
  showTaskSelector.value = false
}

// Listen for task changes
const onTaskChange = (message: RuntimeMessage) => {
  // Handle async operations without returning a Promise
  (async () => {
    try {
      if (message?.type === 'TASK_CHANGED') {
        console.log('Task change detected, reloading task info...')
        await loadCurrentTask()
      } else if (message?.type === 'STATE_UPDATE') {
        if (message.path === 'user.currentTask' || message.path === 'currentTask') {
          await applyCurrentTask(message.value ?? null)
        } else if (message.path === 'user.previousTask' || message.path === 'previousTask') {
          store.updateCache(message.path, message.value ?? null)
        } else if (message.path?.startsWith('task.')) {
          const currentTaskName = currentTask.value?.name
          if (currentTaskName && message.path.includes(currentTaskName) && message.path.includes('contentChanged')) {
            console.log('Current task content changed, reloading pages and documents...')
            await loadTaskPages(currentTaskName)
            if (currentTask.value?.id) {
              await loadTaskDocuments(currentTask.value.id)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling task change:', error)
    }
  })()

  // Return false immediately (synchronously)
  return false
}

watch(showTaskSelector, (isOpen) => {
  if (!isOpen) {
    taskFilter.value = ''
    isSettingTask.value = false
  }
})

// Lifecycle
onMounted(() => {
  loadCurrentTask()
  chrome.runtime.onMessage.addListener(onTaskChange)
})

onUnmounted(() => {
  if (chrome.runtime.onMessage.hasListener(onTaskChange)) {
    chrome.runtime.onMessage.removeListener(onTaskChange)
  }
})
</script>

<template>
  <section class="current-task-list">


    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading task...</span>
    </div>

    <!-- Content -->
    <div v-else-if="currentTask" class="task-content">
      <!-- Header Section -->
      <header class="task-header">
        <div class="task-info">
          <h3 class="task-name">&{{ currentTask.name }}</h3>
          <div v-if="currentTask.description" class="task-description">
            {{ currentTask.description }}
          </div>
          <div class="task-meta">
            <span class="page-count">{{ taskPages.length }} pages</span>
            <span class="document-count">{{ taskDocuments.length }} documents</span>
          </div>
        </div>
      </header>

      <!-- Main Section: Pages List -->
      <main class="pages-list">
        <div v-if="taskPages.length > 0" class="pages">
          <ul class="page-list">
            <li
              v-for="page in taskPages"
              :key="page.id"
              class="page-row"
            >
              <div class="page-icon">
                <img
                  v-if="page.favicon"
                  :src="page.favicon"
                  alt="Page favicon"
                  @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                />
                <div v-else class="default-icon">🌐</div>
              </div>

              <div class="page-main" @click="openPage(page.url)">
                <div class="page-title" :title="page.title">
                  {{ page.title }}
                </div>
                <div class="page-url" :title="page.url">
                  {{ displayUrl(page.url) }}
                </div>

                <div class="page-actions">
                  <button
                    class="btn btn-icon btn-remove"
                    title="Remove from task (keep in storage)"
                    @click.stop="removeFromTask(page)"
                  >
                    ➖
                  </button>
                  <button
                    class="btn btn-icon btn-delete"
                    title="Delete permanently"
                    @click.stop="deletePageCompletely(page)"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div v-if="page.tags && page.tags.length > 0" class="page-tags">
                <span v-for="tag in page.tags" :key="tag" class="tag">
                  #{{ tag }}
                </span>
              </div>
            </li>
          </ul>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">📁</div>
          <div class="empty-message">No pages in this task yet</div>
          <div class="empty-hint">Save pages to this task to see them here</div>
        </div>
      </main>

      <!-- Documents Section -->
      <section v-if="taskDocuments.length > 0" class="documents-section">
        <h4 class="section-title">📝 Documents</h4>
        <div class="documents-list">
          <ul class="document-list">
            <li
              v-for="document in taskDocuments"
              :key="document.id"
              class="document-row"
            >
              <div class="document-icon">
                <div class="document-type-icon">📄</div>
              </div>

              <div class="document-main" @click="openDocument(document)">
                <div class="document-title" :title="document.title">
                  {{ document.title }}
                </div>
                <div class="document-meta">
                  <span class="document-status" :class="`status-${document.status}`">
                    {{ document.status }}
                  </span>
                  <span class="document-date">
                    {{ new Date(document.updatedAt).toLocaleDateString() }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- No Active Task State -->
    <div v-else class="no-task-state">
      <div v-if="!showTaskSelector" class="no-task-content">
        <div class="empty-icon">📋</div>
        <div class="empty-message">No active task</div>
        <div class="empty-hint">Set an active task to see its pages</div>
        <button class="btn btn-primary select-task-btn" @click="showTaskSelection">
          <svg
            class="select-task-btn-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
          <span>Select Active Task</span>
        </button>
      </div>

      <!-- Task Selection Interface -->
      <div v-else class="task-selector">
        <div class="selector-header">
          <h4>Select Active Task</h4>
          <button class="btn btn-close" @click="cancelTaskSelection">×</button>
        </div>

        <div v-if="isLoadingTasks" class="loading-tasks">
          <div class="loading-spinner"></div>
          <span>Loading tasks...</span>
        </div>

        <div v-else class="task-selector-body">
          <div v-if="availableTasks.length > 0" class="task-filter">
            <input
              v-model="taskFilter"
              class="task-filter-input"
              type="search"
              placeholder="Filter tasks by name or description"
              aria-label="Filter tasks"
            />
          </div>

          <div v-if="filteredTasks.length > 0" class="task-list" role="listbox">
            <label
              v-for="task in filteredTasks"
              :key="task.id"
              :class="[
                'task-option',
                {
                  'is-active': task.id === currentTask?.id,
                  'is-selected': task.name === selectedTaskName
                }
              ]"
              tabindex="0"
              @click="selectedTaskName = task.name"
              @keydown.enter.prevent="handleTaskActivation(task.name)"
              @dblclick.prevent="handleTaskActivation(task.name)"
            >
              <input
                v-model="selectedTaskName"
                class="task-option-input"
                type="radio"
                name="task-selection"
                :value="task.name"
                :aria-checked="task.name === selectedTaskName"
              />

              <div class="task-option-info">
                <div class="task-option-name">&{{ task.name }}</div>
                <div v-if="task.description" class="task-option-description">
                  {{ task.description }}
                </div>
                <div class="task-option-meta">
                  {{ task.pageCount || 0 }} page(s) • {{ task.noteCount || 0 }} note(s)
                </div>
              </div>
              <div class="task-option-action">
                <div v-if="task.id === currentTask?.id" class="active-label">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M20.285 6.708a1 1 0 010 1.414l-9.5 9.5a1 1 0 01-1.414 0l-4.5-4.5a1 1 0 011.414-1.414L10 15.086l8.793-8.793a1 1 0 011.492.415z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Active</span>
                </div>
                <div v-else-if="task.name === selectedTaskName" class="select-label">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M10.5 16.5L7 13l1.414-1.414L10.5 13.672l5.086-5.086L17 10l-6.5 6.5z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Selected</span>
                </div>
                <div v-else class="select-label">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 12h11.586l-3.293-3.293a1 1 0 011.32-1.497l.094.083 5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.497-1.32l.083-.094L16.586 13H5a1 1 0 110-2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Choose</span>
                </div>
              </div>
            </label>
          </div>

          <div v-else-if="availableTasks.length > 0" class="no-tasks filter-empty">
            <div class="empty-icon">🔍</div>
            <div class="empty-message">No tasks match "{{ taskFilter }}"</div>
            <div class="empty-hint">Try a different keyword or clear the filter</div>
          </div>

          <div v-else class="no-tasks">
            <div class="empty-icon">📁</div>
            <div class="empty-message">No tasks available</div>
            <div class="empty-hint">Create tasks by saving pages with task names</div>
          </div>

          <footer class="selector-footer">
            <div v-if="selectedTask" class="selection-details">
              <strong>Selected:</strong>
              <span>&{{ selectedTask.name }}</span>
            </div>
            <button
              class="btn btn-primary confirm-task-btn"
              type="button"
              :disabled="
                !selectedTaskName ||
                selectedTaskName === currentTask?.name ||
                isSettingTask
              "
              @click="confirmActiveTask"
            >
              <span v-if="isSettingTask">Setting...</span>
              <span v-else>Set Active Task</span>
            </button>
          </footer>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.current-task-list {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.current-task-summary {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 12px 16px 0;
  font-size: 12px;
  color: #495057;
}

.summary-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: #868e96;
}

.summary-value {
  font-weight: 600;
  color: #212529;
}

.summary-value.is-empty {
  font-weight: 500;
  color: #adb5bd;
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

/* Task Header */
.task-header {
  padding: 12px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
  margin-bottom: 4px;
}

.task-description {
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
  margin-bottom: 8px;
}

.task-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-count {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.document-count {
  font-size: 11px;
  color: #64748b;
  background: #f0f9ff;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Pages List */
.pages-list {
  margin-top: 8px;
  max-height: 400px;
  overflow-y: auto;

  /* Hide scrollbar for modern browsers */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* Hide scrollbar for Webkit browsers (Chrome, Safari) */
.pages-list::-webkit-scrollbar {
  display: none;
}

.pages {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 12px 12px 12px;
}

.page-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.page-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  transition: background-color 0.2s;
  position: relative;
}

.page-row:hover {
  background-color: #f8fafc;
}

.page-row:last-child {
  border-bottom: none;
}

.page-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-icon img {
  width: 16px;
  height: 16px;
}

.default-icon {
  font-size: 14px;
}

.page-main {
  min-width: 0;
  cursor: pointer;
  position: relative;
  padding-right: 60px; /* Space for overlaid actions */
}

.page-main:hover .page-title {
  color: #0056b3;
}

.page-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.1;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-url {
  font-size: 12px;
  color: #3b82f6;
  line-height: 1.1;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tag {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #dbeafe;
}

.page-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 2px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.page-row:hover .page-actions,
.page-row:focus-within .page-actions {
  opacity: 1;
}

.btn {
  border: none;
  border-radius: 4px;
  padding: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon {
  background: #f8f9fa;
  color: #495057;
}

.btn-icon:hover {
  background: #e9ecef;
}

/* Empty States */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  text-align: center;
}

.no-task-state {
  padding: 16px;
}

.no-task-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 16px;
}

.select-task-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
  width: auto;
  height: auto;
}

.select-task-btn:hover {
  background: #0056b3;
}

.select-task-btn-icon {
  width: 18px;
  height: 18px;
}

/* Task Selector */
.task-selector {
  padding: 0;
}

.task-selector-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.task-filter {
  position: sticky;
  top: 0;
  background: white;
  padding-bottom: 4px;
  z-index: 1;
}

.task-filter-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.task-filter-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
  outline: none;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.selector-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #666;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #333;
}

.loading-tasks {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.task-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;

  /* Hide scrollbar for modern browsers */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* Hide scrollbar for Webkit browsers (Chrome, Safari) */
.task-list::-webkit-scrollbar {
  display: none;
}

.task-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  width: 100%;
  text-align: left;
  gap: 12px;
  color: inherit;
}

.task-option:hover {
  border-color: #007bff;
  background: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-option:last-child {
  margin-bottom: 0;
}

.task-option:focus-visible {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

.task-option.is-active {
  border-color: #2f9e44;
  background: #f1fff4;
}

.task-option.is-selected:not(.is-active) {
  border-color: #007bff;
  background: #f0f6ff;
}

.task-option-input {
  margin: 0;
  margin-right: 12px;
  accent-color: #007bff;
}

.task-option-info {
  flex: 1;
  min-width: 0;
}

.task-option-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
  line-height: 1.3;
}

.task-option-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-option-meta {
  font-size: 11px;
  color: #999;
  line-height: 1.3;
}

.task-option-action {
  flex-shrink: 0;
  margin-left: 12px;
  display: flex;
  align-items: center;
}

.task-option-action svg {
  width: 18px;
  height: 18px;
}

.select-label,
.active-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.select-label {
  color: #007bff;
}

.task-option:hover .select-label {
  color: #0056b3;
}

.active-label {
  color: #2f9e44;
}

.selector-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #e9ecef;
  margin-top: 8px;
}

.selection-details {
  font-size: 12px;
  color: #495057;
  display: flex;
  gap: 4px;
}

.confirm-task-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  width: auto;
  height: auto;
}

.confirm-task-btn:disabled {
  background: #c8d4e6;
  cursor: not-allowed;
}

.filter-empty .empty-icon {
  font-size: 28px;
}

.no-tasks {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  text-align: center;
}

/* Button Styles */
.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}
.btn-remove {
  background: #fff3cd;
  color: #856404;
}

.btn-remove:hover {
  background: #ffeaa7;
  color: #7d5a00;
}

.btn-delete {
  background: #f8d7da;
  color: #721c24;
}

.btn-delete:hover {
  background: #f5c6cb;
  color: #5a1a1d;
}

/* Documents Section */
.documents-section {
  margin: 12px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.section-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.documents-list {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.document-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.document-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  transition: background-color 0.2s;
  cursor: pointer;
}

.document-row:hover {
  background-color: #f8fafc;
}

.document-row:last-child {
  border-bottom: none;
}

.document-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.document-type-icon {
  font-size: 16px;
}

.document-main {
  min-width: 0;
}

.document-main:hover .document-title {
  color: #0056b3;
}

.document-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.3;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.document-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-draft {
  background: #fff3cd;
  color: #856404;
}

.status-review {
  background: #d1ecf1;
  color: #0c5460;
}

.status-final {
  background: #d4edda;
  color: #155724;
}

.status-archived {
  background: #f8d7da;
  color: #721c24;
}

.document-date {
  font-size: 11px;
  color: #64748b;
}
</style>
