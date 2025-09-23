<template>
  <div class="task-manager">
    <div class="tasks-header">
      <h2>Tasks</h2>
      <button v-if="!showCreateForm" class="btn-primary" @click="createNewTask">
        New Task
      </button>
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
          <button type="button" class="btn-secondary" @click="cancelCreate">
            Cancel
          </button>
          <button type="submit" class="btn-primary">
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
      <div v-if="tasks.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-message">No tasks yet</div>
        <div class="empty-hint">Create your first task to get started!</div>
      </div>

      <div v-for="task in tasks" :key="task.id" class="task-card">
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
          <button class="btn-action btn-primary" @click="setActiveTask(task)" title="Set as active task">
            ✓
          </button>
          <button class="btn-action btn-danger" @click="deleteTask(task)" title="Delete task">
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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
  margin-bottom: 20px;
}

.tasks-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
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

/* Create Form */
.create-form {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
  outline: none;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Buttons */
.btn-primary {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #545b62;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.8;
}

.task-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-card:hover {
  border-color: #c8d4e6;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  line-height: 1.3;
}

.task-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.4;
}

.task-stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.stat-item {
  font-size: 10px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 8px;
}

.active-badge {
  font-size: 10px;
  background: #d4edda;
  color: #155724;
  padding: 2px 6px;
  border-radius: 8px;
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
