<template>
  <div class="task-manager">
    <!-- Header -->
    <div class="tasks-header">
      <h2 class="tasks-title">📋 Tasks</h2>
      <div class="tasks-header-actions">
        <div class="tasks-stats">
          <span v-if="hasFilter && filteredTasks.length !== tasks.length">
            {{ filteredTasks.length }} of {{ tasks.length }} tasks
          </span>
          <span v-else>
            {{ tasks.length }} tasks
          </span>
        </div>
        <button v-if="!showCreateForm" class="btn btn-primary btn-small" @click="createNewTask">
          New Task
        </button>
      </div>
    </div>

    <!-- Create Task Form -->
    <div v-if="showCreateForm" class="create-form">
      <div class="form-header">
        <h3>Create New Task</h3>
        <button class="btn-close" @click="cancelCreate">×</button>
      </div>
      <form @submit.prevent="saveNewTask">
        <div class="form-group">
          <label for="taskName">Task Name *</label>
          <input
            id="taskName"
            v-model="newTaskName"
            type="text"
            placeholder="Enter task name"
            required
          />
        </div>
        <div class="form-group">
          <label for="taskDescription">Description (optional)</label>
          <textarea
            id="taskDescription"
            v-model="newTaskDescription"
            placeholder="Enter task description"
            rows="3"
          ></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="cancelCreate">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Create Task
          </button>
        </div>
      </form>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading tasks...</span>
    </div>

    <!-- Tasks List -->
    <div v-else-if="!showCreateForm" class="tasks-list">
      <div class="tasks-toolbar">
        <input
          v-model="taskFilter"
          type="text"
          class="task-filter-input"
          placeholder="Filter tasks by name or description"
        />
        <button
          v-if="hasFilter"
          class="btn btn-secondary btn-small"
          type="button"
          @click="taskFilter = ''"
        >
          Clear
        </button>
      </div>

      <div v-if="tasks.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-message">No tasks yet</div>
        <div class="empty-hint">Create your first task to get started!</div>
      </div>
      <div v-else-if="filteredTasks.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-message">No tasks match that filter</div>
        <div class="empty-hint">Try a different keyword or clear the filter.</div>
      </div>

      <div v-else class="tasks-content">
        <div v-for="task in filteredTasks" :key="task.id" class="task-card">
          <div class="task-info">
            <div class="task-name">{{ task.name }}</div>
            <div v-if="task.description" class="task-description">
              {{ task.description }}
            </div>
            <div class="task-stats">
              <span class="stat-item">{{ task.pageCount || 0 }} pages</span>
              <span class="stat-item">{{ task.noteCount || 0 }} notes</span>
              <span v-if="task.isActive" class="active-badge">Active</span>
            </div>
          </div>
          <div class="task-actions">
            <button class="btn-action btn-primary" title="Set as active task" @click="setActiveTask(task)">
              ✓
            </button>
            <button class="btn-action btn-danger" title="Delete task" @click="deleteTask(task)">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { TaskEntry } from '../../shared/models'

interface RuntimeMessage {
  type?: string
  [key: string]: unknown
}

interface TaskWithStats extends TaskEntry {
  pageCount: number
  noteCount: number
}

const router = useRouter()
const store = useSidePanelStore()
const tasks = ref<TaskWithStats[]>([])
const isLoading = ref(true)
const showCreateForm = ref(false)
const newTaskName = ref('')
const newTaskDescription = ref('')
const taskFilter = ref('')
const hasFilter = computed(() => taskFilter.value.trim().length > 0)

const loadTasks = async () => {
  try {
    isLoading.value = true
    const response = await store.sendMessage({
      type: 'GET_TASKS'
    }) as { type: string; data?: TaskWithStats[] }

    if (response?.type === 'SUCCESS' && Array.isArray(response.data)) {
      tasks.value = response.data
    } else {
      tasks.value = []
    }
  } catch (error) {
    console.error('Failed to load tasks:', error)
    tasks.value = []
    store.addNotification({
      type: 'error',
      message: 'Failed to load tasks'
    })
  } finally {
    isLoading.value = false
  }
}

const filteredTasks = computed(() => {
  const query = taskFilter.value.trim().toLowerCase()
  if (!query) {
    return tasks.value
  }

  return tasks.value.filter(task => {
    const nameMatch = task.name.toLowerCase().includes(query)
    const descriptionMatch = task.description?.toLowerCase().includes(query)
    return nameMatch || !!descriptionMatch
  })
})

const onTaskChange = (message: RuntimeMessage) => {
  (async () => {
    try {
      if (message?.type === 'TASK_CHANGED') {
        await loadTasks()
      }
    } catch (error) {
      console.error('Error handling task change:', error)
    }
  })()
  return false
}

onMounted(() => {
  loadTasks()

  // Listen for task changes from omnibox or other sources
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(onTaskChange)
  }
})

onUnmounted(() => {
  // Clean up message listener
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(onTaskChange)
  }
})

const createNewTask = () => {
  showCreateForm.value = true
  newTaskName.value = ''
  newTaskDescription.value = ''
}

const cancelCreate = () => {
  showCreateForm.value = false
  newTaskName.value = ''
  newTaskDescription.value = ''
}

const saveNewTask = async () => {
  if (!newTaskName.value.trim()) {
    store.addNotification({
      type: 'error',
      message: 'Task name is required'
    })
    return
  }

  try {
    await store.sendMessage({
      type: 'CREATE_TASK',
      data: {
        name: newTaskName.value.trim(),
        description: newTaskDescription.value.trim() || undefined
      }
    })

    showCreateForm.value = false
    await loadTasks()

    store.addNotification({
      type: 'success',
      message: `Task "${newTaskName.value}" created successfully`
    })
  } catch (error) {
    console.error('Failed to create task:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to create task'
    })
  }
}

const setActiveTask = async (task: TaskWithStats) => {
  try {
    await store.sendMessage({
      type: 'SET_ACTIVE_TASK',
      data: { taskName: task.name }
    })

    await loadTasks()

    store.addNotification({
      type: 'success',
      message: `Set "${task.name}" as active task`
    })

    // Navigate to Home view
    router.push('/')
  } catch (error) {
    console.error('Failed to set active task:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to set active task'
    })
  }
}

const deleteTask = async (task: TaskWithStats) => {
  if (!confirm(`Delete task "${task.name}"? This will remove the task but keep all associated pages.`)) {
    return
  }

  try {
    await store.sendMessage({
      type: 'DELETE_TASK',
      data: { taskName: task.name }
    })

    await loadTasks()

    store.addNotification({
      type: 'success',
      message: `Task "${task.name}" deleted successfully`
    })
  } catch (error) {
    console.error('Failed to delete task:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to delete task'
    })
  }
}
</script>

<style scoped>
.task-manager {
  max-height: 100vh;
  overflow-y: auto;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tasks-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.tasks-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tasks-stats {
  font-size: 13px;
  color: #64748b;
}

/* Loading State */
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

/* Create Form */
.create-form {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.form-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #1f2937;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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

.btn-action {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  opacity: 0;
}

.task-card:hover .btn-action,
.task-card:focus-within .btn-action,
.btn-action:focus {
  opacity: 1;
}

.btn-primary.btn-action {
  background: rgba(0, 123, 255, 0.1);
  color: #007bff;
}

.btn-primary.btn-action:hover {
  background: rgba(0, 123, 255, 0.2);
}

.btn-danger {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.btn-danger:hover {
  background: rgba(220, 53, 69, 0.2);
}

/* Tasks List */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tasks-content {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.tasks-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.task-filter-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  font-family: inherit;
}

.task-filter-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
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

.empty-message {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
}

.empty-hint {
  font-size: 14px;
  color: #64748b;
  max-width: 320px;
  line-height: 1.5;
}

.task-card {
  border-bottom: 1px solid #e2e8f0;
  padding: 12px;
  background: white;
  transition: background-color 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-card:last-child {
  border-bottom: none;
}

.task-card:hover {
  background-color: #f8fafc;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
  margin-bottom: 4px;
  line-height: 1.3;
}

.task-description {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 8px;
  line-height: 1.4;
}

.task-stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.stat-item {
  font-size: 9px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.active-badge {
  font-size: 9px;
  background: #dcfce7;
  color: #166534;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}
</style>
