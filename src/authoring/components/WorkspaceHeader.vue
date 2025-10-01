<template>
  <header class="workspace-header">
    <div class="header-left">
      <span class="document-icon" title="Document">📄</span>
      <div class="title-stack">
        <template v-if="documentLoaded">
          <div class="title-container">
            <div class="title-row">
              <h1
                v-if="!isEditingTitle"
                class="document-title"
                title="Click to edit title"
                @click="() => startEditTitle(documentTitle)"
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

              <!-- Document Status Badge -->
              <div v-if="document && !isEditingTitle" class="status-container">
                <button
                  class="status-badge"
                  :class="`status-${document.status}`"
                  title="Click to change document status"
                  @click="toggleStatusMenu"
                >
                  {{ document.status }}
                  <span class="status-arrow">▼</span>
                </button>

                <!-- Status Dropdown Menu -->
                <div v-if="showStatusMenu" class="status-menu">
                  <button
                    v-for="status in statusOptions"
                    :key="status"
                    class="status-option"
                    :class="{ active: document.status === status }"
                    @click="changeDocumentStatus(status)"
                  >
                    <span class="status-preview" :class="`status-${status}`">{{ status }}</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
          <div v-if="task" class="task-meta">
            <span class="task-badge">[{{ task.name }}]</span>
          </div>
        </template>
        <span v-else class="loading-text">Loading...</span>
      </div>
    </div>
    <div class="header-right">
      <!-- Version Indicator -->
      <VersionIndicator
        v-if="documentLoaded && document"
        :current-version="currentVersion"
        :versions="versions"
        :has-unsaved-changes="hasUnsavedChanges"
        :change-count="changeCount"
        :is-saving="saving"
        :is-auto-saving="isAutoSaving"
        :auto-save-enabled="autoSaveEnabled"
        :auto-save-interval="autoSaveInterval"
        :document-status="documentStatus"
        @quick-save="$emit('saveDocument')"
        @create-version="$emit('createVersion')"
        @show-history="$emit('toggleVersions')"
        @show-settings="$emit('showVersionSettings')"
        @compare-versions="$emit('compareVersions')"
        @export-version="$emit('exportDocument')"
      />

      <button
        class="preview-btn"
        :class="{ active: showPreview }"
        title="Toggle preview"
        @click="$emit('togglePreview')"
      >
        Preview
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useTitleEditing } from '../composables/useTitleEditing'
import VersionIndicator from './VersionIndicator.vue'
import type { DocumentEntry, TaskEntry, DocumentVersionEntry } from '../../shared/models'

interface Props {
  document: DocumentEntry | null
  documentLoaded: boolean
  documentTitle: string
  task: TaskEntry | null
  saving: boolean
  showPreview: boolean
  currentVersion?: DocumentVersionEntry
  versions: DocumentVersionEntry[]
  hasUnsavedChanges: boolean
  changeCount: number
  isAutoSaving: boolean
  autoSaveEnabled: boolean
  autoSaveInterval: number
  documentStatus?: 'draft' | 'review' | 'final' | 'archived'
}

interface Emits {
  (e: 'togglePreview'): void
  (e: 'exportDocument'): void
  (e: 'saveDocument'): void
  (e: 'toggleVersions'): void
  (e: 'updateTitle', newTitle: string): void
  (e: 'createVersion'): void
  (e: 'showVersionSettings'): void
  (e: 'compareVersions'): void
  (e: 'updateDocumentStatus', status: 'draft' | 'review' | 'final' | 'archived'): void
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
} = useTitleEditing(async () => {
  // This would call the parent's update function
  return true // Placeholder - will be handled by parent
})

async function handleSaveTitle() {
  const newTitle = await saveTitle(props.documentTitle)
  if (newTitle) {
    emit('updateTitle', newTitle)
  }
}

// Document status management
const showStatusMenu = ref(false)
const statusOptions = ['draft', 'review', 'final', 'archived'] as const

function toggleStatusMenu() {
  showStatusMenu.value = !showStatusMenu.value
}

async function changeDocumentStatus(status: 'draft' | 'review' | 'final' | 'archived') {
  if (props.document && status !== props.document.status) {
    emit('updateDocumentStatus', status)
  }
  showStatusMenu.value = false
}

// Close status menu when clicking outside
function handleClickOutside(event: Event) {
  if (!showStatusMenu.value) return

  const target = event.target as HTMLElement
  const statusContainer = target.closest('.status-container')

  // Don't close if clicking within the status container
  if (!statusContainer) {
    showStatusMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
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

/* Document Status Styles */
.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-container {
  position: relative;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: capitalize;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-arrow {
  font-size: 8px;
  margin-left: 2px;
  transition: transform 0.2s ease;
}

.status-badge:hover .status-arrow {
  transform: rotate(180deg);
}

/* Status color schemes (matching TaskDocumentsList) */
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

/* Status dropdown menu */
.status-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 0;
  min-width: 120px;
  margin-top: 2px;
}

.status-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.status-option:hover {
  background: #f3f4f6;
}

.status-option.active {
  background: #e5e7eb;
  font-weight: 600;
}

.status-preview {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: capitalize;
}
</style>
