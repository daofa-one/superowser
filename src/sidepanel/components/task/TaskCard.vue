<template>
  <div class="task-card" :class="{ active: task.isActive, compact, interactive }">
    <div class="task-info">
      <h4 class="task-name">{{ task.name }}</h4>
      <p v-if="task.description && !compact" class="task-description">
        {{ task.description }}
      </p>
      <div class="task-meta">
        <span class="page-count">{{ task.pageCount || 0 }} pages</span>
        <span class="note-count">{{ task.noteCount || 0 }} notes</span>
        <span v-if="task.isActive" class="active-badge">Active</span>
      </div>
    </div>

    <div v-if="interactive" class="task-actions" role="toolbar" aria-label="Task actions">
      <button
        class="btn-view"
        title="View task details"
        @click="$emit('view-details', task)"
      >
        👁️
      </button>
      <button
        class="btn-edit"
        title="Edit task"
        @click="$emit('edit', task)"
      >
        ✏️
      </button>
      <button
        v-if="!task.isActive"
        class="btn-activate"
        title="Set as active task"
        @click="$emit('activated', task)"
      >
        ✓
      </button>
      <button
        class="btn-delete"
        title="Delete task"
        @click="$emit('deleted', task)"
      >
        🗑️
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TaskEntry } from '../../../shared/models'

interface TaskWithStats extends TaskEntry {
  pageCount?: number
  noteCount?: number
}

interface Props {
  task: TaskWithStats
  interactive?: boolean
  compact?: boolean
}

interface Emits {
  (e: 'activated', task: TaskWithStats): void
  (e: 'deleted', task: TaskWithStats): void
  (e: 'edit', task: TaskWithStats): void
  (e: 'view-details', task: TaskWithStats): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

</script>

<style scoped>
.task-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  transition: all 0.2s ease;
  position: relative;
  padding-right: 64px;
}

.task-card:hover {
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-card.active {
  border-color: #10b981;
  background: #f0fdf4;
}

.task-card.compact {
  padding: 8px 56px 8px 10px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.task-description {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.page-count,
.note-count {
  font-size: 10px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.active-badge {
  font-size: 10px;
  background: #dcfce7;
  color: #166534;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 9999px;
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.12);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
  z-index: 1;
}

.task-card:hover .task-actions,
.task-card:focus-within .task-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.btn-view,
.btn-edit,
.btn-activate,
.btn-delete {
  padding: 4px 8px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-view {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.btn-view:hover {
  background: rgba(107, 114, 128, 0.2);
}

.btn-edit {
  background: rgba(249, 115, 22, 0.1);
  color: #f97316;
}

.btn-edit:hover {
  background: rgba(249, 115, 22, 0.2);
}

.btn-activate {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.btn-activate:hover {
  background: rgba(59, 130, 246, 0.2);
}

.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
