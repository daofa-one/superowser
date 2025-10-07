<template>
  <div class="task-list">
    <div class="task-list-header">
      <h3 class="task-list-title">{{ title }}</h3>
      <div class="task-stats">{{ tasks.length }} task{{ tasks.length !== 1 ? 's' : '' }}</div>
    </div>

    <!-- Filtering (if interactive) -->
    <div v-if="interactive && showFilters" class="task-filters">
      <input
        v-model="filterQuery"
        placeholder="Filter tasks..."
        class="filter-input"
      />
      <select v-model="statusFilter" class="status-filter">
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <!-- Task grid/list -->
    <div v-if="filteredTasks.length > 0" class="tasks-container">
      <TaskCard
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        :interactive="interactive"
        :compact="compact"
        @activated="handleTaskActivated"
        @deleted="handleTaskDeleted"
        @edit="handleTaskEdit"
        @view-details="handleTaskViewDetails"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-message">
        {{ filterQuery ? `No tasks match "${filterQuery}"` : 'No tasks found' }}
      </div>
      <div v-if="!filterQuery" class="empty-hint">
        Create your first task to get started!
      </div>
    </div>

    <!-- Create new task -->
    <button
      v-if="interactive"
      class="create-task-btn"
      @click="$emit('create-requested')"
    >
      <span class="create-icon">+</span>
      <span>New Task</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TaskCard from './TaskCard.vue'
import type { TaskEntry } from '../../../shared/models'

interface TaskWithStats extends TaskEntry {
  pageCount?: number
  noteCount?: number
}

interface Props {
  tasks: TaskWithStats[]
  interactive?: boolean
  compact?: boolean
  title?: string
  showFilters?: boolean
  filters?: {
    search?: string
    status?: string
  }
}

interface Emits {
  (e: 'task-activated', task: TaskWithStats): void
  (e: 'task-deleted', task: TaskWithStats): void
  (e: 'task-edit', task: TaskWithStats): void
  (e: 'task-view-details', task: TaskWithStats): void
  (e: 'create-requested'): void
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  compact: false,
  title: 'Tasks',
  showFilters: true
})

const emit = defineEmits<Emits>()

// Debug: log the tasks prop
console.log('[TaskList] Received tasks prop:', props.tasks)

// Local filter state
const filterQuery = ref(props.filters?.search || '')
const statusFilter = ref(props.filters?.status || 'all')

// Computed filtered tasks
const filteredTasks = computed(() => {
  let filtered = props.tasks

  // Apply search filter
  if (filterQuery.value.trim()) {
    const query = filterQuery.value.toLowerCase().trim()
    filtered = filtered.filter(task =>
      task.name.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    )
  }

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(task => {
      if (statusFilter.value === 'active') {
        return task.status !== 'completed' && task.status !== 'archived'
      }
      return task.status === statusFilter.value
    })
  }

  return filtered
})

// Event handlers
const handleTaskActivated = (task: TaskWithStats) => {
  emit('task-activated', task)
}

const handleTaskDeleted = (task: TaskWithStats) => {
  emit('task-deleted', task)
}

const handleTaskEdit = (task: TaskWithStats) => {
  emit('task-edit', task)
}

const handleTaskViewDetails = (task: TaskWithStats) => {
  emit('task-view-details', task)
}
</script>

<style scoped>
.task-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.task-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.task-list-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.task-stats {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 12px;
}

.task-filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
}

.filter-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.filter-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
}

.status-filter {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.status-filter:focus {
  border-color: #3b82f6;
  outline: none;
}

.tasks-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
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
  line-height: 1.5;
}

.create-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: none;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-task-btn:hover {
  background: #f1f5f9;
  color: #2563eb;
}

.create-icon {
  font-size: 16px;
  font-weight: bold;
}
</style>