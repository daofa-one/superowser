<template>
  <div class="task-creator">
    <div class="task-creator-header">
      <h3 class="creator-title">{{ isEdit ? 'Edit Task' : 'Create New Task' }}</h3>
      <div class="creator-stats">{{ tasks.length }} existing task{{ tasks.length !== 1 ? 's' : '' }}</div>
    </div>

    <form class="creator-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="task-name" class="form-label">Task Name *</label>
        <input
          id="task-name"
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="Enter task name..."
          required
          :class="{ 'error': errors.name }"
        />
        <div v-if="errors.name" class="form-error">{{ errors.name }}</div>
      </div>

      <div class="form-group">
        <label for="task-description" class="form-label">Description</label>
        <textarea
          id="task-description"
          v-model="formData.description"
          class="form-textarea"
          placeholder="Optional description..."
          rows="3"
        />
      </div>

      <div class="form-group">
        <label class="form-checkbox">
          <input
            v-model="formData.activate"
            type="checkbox"
            class="checkbox-input"
          />
          <span class="checkbox-label">Set as active task after creation</span>
        </label>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="$emit('cancel')">
          Cancel
        </button>
        <button type="submit" class="btn-submit" :disabled="!formData.name.trim() || isSubmitting">
          {{ isSubmitting ? 'Creating...' : (isEdit ? 'Update Task' : 'Create Task') }}
        </button>
      </div>
    </form>

    <!-- Existing tasks preview (if any) -->
    <div v-if="showExisting && tasks.length > 0" class="existing-tasks">
      <h4 class="existing-title">Existing Tasks</h4>
      <div class="existing-list">
        <div
          v-for="task in tasks.slice(0, 5)"
          :key="task.id"
          class="existing-task"
          :class="{ active: task.isActive }"
        >
          <span class="task-name">{{ task.name }}</span>
          <span v-if="task.isActive" class="active-indicator">Active</span>
        </div>
        <div v-if="tasks.length > 5" class="more-tasks">
          ... {{ tasks.length - 5 }} more tasks
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { TaskEntry } from '../../../shared/models'

interface TaskWithStats extends TaskEntry {
  pageCount?: number
  noteCount?: number
}

interface Props {
  tasks?: TaskWithStats[]
  showExisting?: boolean
  editTask?: TaskWithStats
}

interface Emits {
  (e: 'create', data: { name: string; description?: string; activate: boolean }): void
  (e: 'update', data: { task: TaskWithStats; name: string; description?: string; activate: boolean }): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  tasks: () => [],
  showExisting: true,
  editTask: undefined
})

const emit = defineEmits<Emits>()

const isEdit = !!props.editTask
const isSubmitting = ref(false)

// Form data
const formData = reactive({
  name: props.editTask?.name || '',
  description: props.editTask?.description || '',
  activate: !isEdit // Default to true for new tasks, false for edits
})

// Form validation
const errors = reactive({
  name: ''
})

const validateForm = () => {
  errors.name = ''

  if (!formData.name.trim()) {
    errors.name = 'Task name is required'
    return false
  }

  if (formData.name.length > 100) {
    errors.name = 'Task name must be 100 characters or less'
    return false
  }

  // Check for duplicate names (excluding current task if editing)
  const existingTask = props.tasks.find(task =>
    task.name.toLowerCase() === formData.name.toLowerCase().trim() &&
    (!isEdit || task.id !== props.editTask?.id)
  )

  if (existingTask) {
    errors.name = 'A task with this name already exists'
    return false
  }

  return true
}

const handleSubmit = () => {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  // Simulate async operation
  setTimeout(() => {
    if (isEdit && props.editTask) {
      emit('update', {
        task: props.editTask,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        activate: formData.activate
      })
    } else {
      emit('create', {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        activate: formData.activate
      })
    }
    isSubmitting.value = false
  }, 100)
}
</script>

<style scoped>
.task-creator {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.task-creator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.creator-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.creator-stats {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 12px;
}

.creator-form {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  outline: none;
}

.form-input.error {
  border-color: #ef4444;
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-input {
  margin: 0;
}

.checkbox-label {
  font-size: 13px;
  color: #374151;
}

.form-error {
  margin-top: 4px;
  font-size: 12px;
  color: #ef4444;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.btn-cancel,
.btn-submit {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-submit {
  background: #3b82f6;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #2563eb;
}

.btn-submit:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.existing-tasks {
  border-top: 1px solid #e2e8f0;
  padding: 16px;
  background: #fafbfc;
}

.existing-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.existing-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.existing-task {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
}

.existing-task.active {
  border-color: #10b981;
  background: #f0fdf4;
}

.task-name {
  color: #374151;
}

.active-indicator {
  font-size: 10px;
  background: #dcfce7;
  color: #166534;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.more-tasks {
  padding: 8px 12px;
  color: #64748b;
  font-size: 12px;
  text-align: center;
  font-style: italic;
}
</style>