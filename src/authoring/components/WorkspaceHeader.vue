<template>
  <header class="workspace-header">
    <div class="header-left">
      <span class="document-icon" title="Document">📄</span>
      <div class="title-stack">
        <template v-if="documentLoaded">
          <div class="title-container">
            <h1
              v-if="!isEditingTitle"
              class="document-title"
              @click="() => startEditTitle(documentTitle)"
              title="Click to edit title"
            >
              {{ documentTitle }}
            </h1>
            <input
              v-else
              ref="titleInputRef"
              v-model="editTitleValue"
              class="document-title-input"
              type="text"
              @blur="handleSaveTitle"
              @keydown.enter="handleSaveTitle"
              @keydown.escape="cancelEditTitle"
            />
          </div>
          <div v-if="task" class="task-meta">
            <span class="task-badge">[{{ task.name }}]</span>
          </div>
        </template>
        <span v-else class="loading-text">Loading...</span>
      </div>
    </div>
    <div class="header-right">
      <button
        class="preview-btn"
        :class="{ active: showPreview }"
        @click="$emit('togglePreview')"
        title="Toggle preview"
      >
        👁️ Preview
      </button>
      <button
        class="export-btn"
        :disabled="!documentLoaded || !document"
        title="Export document"
        @click="$emit('exportDocument')"
      >
        Export
      </button>
      <button
        class="save-btn"
        :disabled="saving || !documentLoaded || !document"
        @click="$emit('saveDocument')"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
      <button
        class="versions-btn"
        :disabled="!documentLoaded || !document"
        @click="$emit('toggleVersions')"
      >
        Versions
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useTitleEditing } from '../composables/useTitleEditing'
import type { DocumentEntry, TaskEntry } from '../../shared/models'

interface Props {
  document: DocumentEntry | null
  documentLoaded: boolean
  documentTitle: string
  task: TaskEntry | null
  saving: boolean
  showPreview: boolean
}

interface Emits {
  (e: 'togglePreview'): void
  (e: 'exportDocument'): void
  (e: 'saveDocument'): void
  (e: 'toggleVersions'): void
  (e: 'updateTitle', newTitle: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Title editing composable
const {
  isEditingTitle,
  editTitleValue,
  titleInputRef,
  startEditTitle,
  cancelEditTitle,
  saveTitle
} = useTitleEditing(async (updates) => {
  // This would call the parent's update function
  return true // Placeholder - will be handled by parent
})

async function handleSaveTitle() {
  const newTitle = await saveTitle(props.documentTitle)
  if (newTitle) {
    emit('updateTitle', newTitle)
  }
}
</script>

<style scoped>
.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  min-height: 60px;
  flex-shrink: 0;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.title-stack {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.document-icon {
  font-size: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #edf2f7;
  color: #2b6cb0;
  align-self: stretch;
}

.document-title {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.document-title:hover {
  background-color: #e2e8f0;
}

.document-title-input {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  background: white;
  border: 2px solid #3182ce;
  border-radius: 4px;
  padding: 4px 8px;
  margin: 0;
  outline: none;
  flex: 1;
  min-width: 200px;
  font-family: inherit;
}

.loading-text {
  font-size: 16px;
  color: #718096;
  font-style: italic;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-badge {
  background: #e2e8f0;
  color: #4a5568;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.export-btn,
.save-btn,
.versions-btn,
.preview-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover,
.save-btn:hover,
.versions-btn:hover,
.preview-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.preview-btn.active {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
