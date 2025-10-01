<template>
  <div class="version-indicator" :class="{ 'has-changes': hasUnsavedChanges }">
    <div class="version-status">
      <div class="version-info">
        <span class="version-label">Version:</span>
        <span class="version-name">{{ currentVersionName }}</span>
      </div>
      <div v-if="hasUnsavedChanges" class="unsaved-indicator">
        <span class="unsaved-dot">●</span>
        <span class="unsaved-text">{{ changeCount }} changes</span>
      </div>
    </div>

    <div class="version-actions">
      <button
        v-if="hasUnsavedChanges && autoSaveEnabled"
        class="auto-save-indicator"
        :class="{ active: isAutoSaving }"
        :title="autoSaveTooltip"
      >
        {{ isAutoSaving ? '↻' : '⏱' }}
      </button>
      <button
        class="quick-save"
        :disabled="!hasUnsavedChanges || isSaving"
        :title="hasUnsavedChanges ? 'Save current changes' : 'No changes to save'"
        @click="$emit('quickSave')"
      >
        {{ isSaving ? '⟳' : '💾' }}
      </button>
      <button
        class="version-menu"
        title="Version options"
        @click="showMenu = !showMenu"
      >
        ⋮
      </button>
    </div>

    <!-- Dropdown menu -->
    <div v-if="showMenu" class="version-menu-dropdown" @click.stop>
      <button @click="createVersion">
        📝 Create Version
      </button>
      <button @click="$emit('showHistory')">
        📚 View History
      </button>
      <button @click="$emit('showSettings')">
        ⚙️ Settings
      </button>
      <div class="menu-divider"></div>
      <button @click="exportVersion">
        📤 Export Current
      </button>
      <button v-if="versions.length > 1" @click="$emit('compareVersions')">
        🔄 Compare Versions
      </button>
    </div>

    <!-- Click overlay to close menu -->
    <div v-if="showMenu" class="menu-overlay" @click="showMenu = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { DocumentVersionEntry } from '../../shared/models'

interface Props {
  currentVersion?: DocumentVersionEntry
  versions: DocumentVersionEntry[]
  hasUnsavedChanges: boolean
  changeCount: number
  isSaving: boolean
  isAutoSaving: boolean
  autoSaveEnabled: boolean
  autoSaveInterval: number
  documentStatus?: 'draft' | 'review' | 'final' | 'archived'
}

interface Emits {
  (e: 'quickSave'): void
  (e: 'createVersion'): void
  (e: 'showHistory'): void
  (e: 'showSettings'): void
  (e: 'compareVersions'): void
  (e: 'exportVersion'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showMenu = ref(false)

const currentVersionName = computed(() => {
  if (!props.currentVersion) {
    // If no version but we have a document status, show that
    if (props.documentStatus && props.documentStatus !== 'draft') {
      return props.documentStatus.charAt(0).toUpperCase() + props.documentStatus.slice(1)
    }
    return 'Draft'
  }

  // Always prioritize custom alias if it exists (same logic as VersionManager)
  if (props.currentVersion.alias && props.currentVersion.alias.trim()) {
    return props.currentVersion.alias
  }

  // Fall back to formatted date/time
  const date = new Date(props.currentVersion.createdAt)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
})

const autoSaveTooltip = computed(() => {
  if (props.isAutoSaving) {
    return 'Auto-saving...'
  }
  return `Auto-save every ${props.autoSaveInterval}s`
})

function createVersion() {
  showMenu.value = false
  emit('createVersion')
}

function exportVersion() {
  showMenu.value = false
  emit('exportVersion')
}

// Close menu when clicking outside
onMounted(() => {
  document.addEventListener('click', () => {
    showMenu.value = false
  })
})

onUnmounted(() => {
  document.removeEventListener('click', () => {
    showMenu.value = false
  })
})
</script>

<style scoped>
.version-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  position: relative;
  transition: all 0.2s;
}

.version-indicator.has-changes {
  border-color: #fbbf24;
  background: #fffbeb;
}

.version-status {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.version-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
}

.version-name {
  font-size: 12px;
  color: #374151;
  font-weight: 500;
}

.unsaved-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.unsaved-dot {
  color: #f59e0b;
  font-size: 8px;
  animation: pulse 2s infinite;
}

.unsaved-text {
  font-size: 10px;
  color: #92400e;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.version-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.auto-save-indicator,
.quick-save,
.version-menu {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #6b7280;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.auto-save-indicator:hover,
.quick-save:hover,
.version-menu:hover {
  background: #e5e7eb;
  color: #374151;
}

.auto-save-indicator.active {
  color: #10b981;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.quick-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quick-save:disabled:hover {
  background: none;
  color: #6b7280;
}

.version-menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  padding: 4px 0;
  min-width: 160px;
  margin-top: 4px;
}

.version-menu-dropdown button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.1s;
}

.version-menu-dropdown button:hover {
  background: #f3f4f6;
}

.menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
}
</style>