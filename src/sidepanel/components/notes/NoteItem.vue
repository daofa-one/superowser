<script setup lang="ts">
import { computed } from 'vue'
import type { NoteEntry, NoteCategory } from '../../../shared/models'
import NoteEditForm from './NoteEditForm.vue'

interface Props {
  note: NoteEntry
  isEditing?: boolean
  showPageAssociation?: boolean
  showTaskAssociation?: boolean
  allowEdit?: boolean
}

interface Emits {
  (e: 'edit-complete'): void
  (e: 'edit-cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
  showPageAssociation: true,
  showTaskAssociation: true,
  allowEdit: true
})

const emit = defineEmits<Emits>()

const CATEGORY_META: Record<NoteCategory, { label: string; icon: string; tone: 'default' | 'accent' }> = {
  note: { label: 'Note', icon: '📝', tone: 'default' },
  plan: { label: 'Plan', icon: '🧭', tone: 'accent' },
  brainstorm: { label: 'Brainstorm', icon: '💡', tone: 'accent' },
  highlight: { label: 'Highlight', icon: '🔖', tone: 'accent' }
}

const noteCategory = computed<NoteCategory>(() => (props.note.category ?? 'note') as NoteCategory)
const noteCategoryMeta = computed(() => CATEGORY_META[noteCategory.value])

const formatDateTime = (value?: Date | string) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const handleEditComplete = () => {
  emit('edit-complete')
}

const handleEditCancel = () => {
  emit('edit-cancel')
}
</script>

<template>
  <li
    class="note-item"
    :class="{ 'editing': isEditing }"
  >
    <!-- Edit Mode -->
    <NoteEditForm
      v-if="isEditing"
      :note="note"
      @save="handleEditComplete"
      @cancel="handleEditCancel"
    />

    <!-- View Mode -->
    <div v-else class="note-content-wrapper">
      <p class="note-content">{{ note.content }}</p>
      <p v-if="note.comment" class="note-comment">💬 {{ note.comment }}</p>

      <div class="note-meta">
        <span class="note-category" :class="['tone-' + noteCategoryMeta.tone]">
          <span class="note-category-icon">{{ noteCategoryMeta.icon }}</span>
          <span class="note-category-label">{{ noteCategoryMeta.label }}</span>
        </span>
        <span class="note-timestamp">{{ formatDateTime(note.createdAt) }}</span>

        <div class="note-links">
          <span
            v-if="showPageAssociation && note.pageId"
            class="note-link-badge"
          >
            📄 Page
          </span>

          <div
            v-if="showTaskAssociation && note.tasks && note.tasks.length"
            class="note-tasks"
          >
            <span
              v-for="task in note.tasks"
              :key="task"
              class="note-task"
            >
              &{{ task }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </li>
</template>

<style scoped>
.note-item {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  cursor: context-menu;
  transition: background-color 0.2s;
}

.note-item:last-child {
  border-bottom: none;
}

.note-item:hover {
  background-color: #f8fafc;
}

.note-item.editing {
  background-color: #f8fafc;
  border: 2px solid #e2e8f0;
  cursor: default;
}

.note-content-wrapper {
  width: 100%;
}

.note-content {
  margin: 0 0 6px;
  font-size: 14px;
  color: #1f2937;
  white-space: pre-wrap;
  line-height: 1.4;
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

.note-category {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 600;
  font-size: 11px;
  background: #e2e8f0;
  color: #1f2937;
}

.note-category-icon {
  display: inline-flex;
  font-size: 12px;
}

.note-category.tone-accent {
  background: #dbeafe;
  color: #1d4ed8;
}

.note-category.tone-default {
  background: #f1f5f9;
  color: #475569;
}

.note-timestamp {
  font-style: italic;
}

.note-links {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
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
  font-size: 12px;
}
</style>
