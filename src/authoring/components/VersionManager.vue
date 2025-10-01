<template>
  <div class="version-manager">
    <!-- Header with controls -->
    <div class="version-header">
      <div class="header-left">
        <h3>Version History</h3>
        <span v-if="versions.length" class="version-count">{{ versions.length }} versions</span>
      </div>
      <div class="header-controls">
        <button
          v-if="!showSettings"
          class="settings-btn"
          title="Version Settings"
          @click="showSettings = true"
        >
          ⚙️
        </button>
        <button
          class="close-btn"
          title="Close"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-header">
        <h4>Version Settings</h4>
        <button class="close-settings" @click="showSettings = false">Done</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <label class="setting-toggle">
            <input
              v-model="settings.autoSave.enabled"
              type="checkbox"
              @change="updateSettings"
            />
            <span>Auto-save versions</span>
          </label>
          <div v-if="settings.autoSave.enabled" class="sub-settings">
            <div class="setting-item">
              <label>Save interval:</label>
              <select v-model.number="settings.autoSave.interval" @change="updateSettings">
                <option :value="30">30 seconds</option>
                <option :value="60">1 minute</option>
                <option :value="300">5 minutes</option>
                <option :value="600">10 minutes</option>
              </select>
            </div>
            <div class="setting-item">
              <label>Min changes:</label>
              <input
                v-model.number="settings.autoSave.minChanges"
                type="number"
                min="1"
                max="1000"
                @input="updateSettings"
              />
            </div>
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-toggle">
            <input
              v-model="settings.cleanup.enabled"
              type="checkbox"
              @change="updateSettings"
            />
            <span>Auto-cleanup old versions</span>
          </label>
          <div v-if="settings.cleanup.enabled" class="sub-settings">
            <div class="setting-item">
              <label>Keep versions:</label>
              <select v-model.number="settings.cleanup.keepVersions" @change="updateSettings">
                <option :value="10">Last 10</option>
                <option :value="25">Last 25</option>
                <option :value="50">Last 50</option>
                <option :value="100">Last 100</option>
              </select>
            </div>
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-item">
            <label>Version naming:</label>
            <select v-model="settings.ui.versionNaming" @change="updateSettings">
              <option value="timestamp">Timestamp</option>
              <option value="sequential">Sequential (v1, v2, v3...)</option>
              <option value="semantic">Semantic (major.minor.patch)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Version List -->
    <div v-else class="version-content">
      <!-- Quick Actions -->
      <div class="quick-actions">
        <button
          class="action-btn primary"
          :disabled="!canCreateVersion"
          @click="createVersion"
        >
          + Create Version
        </button>
        <button
          v-if="versions.length > 1"
          class="action-btn"
          @click="showComparison = !showComparison"
        >
          {{ showComparison ? 'Hide' : 'Compare' }}
        </button>
      </div>

      <!-- Version Comparison -->
      <div v-if="showComparison && versions.length > 1" class="comparison-panel">
        <div class="comparison-selectors">
          <select v-model="compareFrom" class="compare-select">
            <option value="">From version...</option>
            <option v-for="version in versions" :key="version.id" :value="version.id">
              {{ formatVersionName(version) }}
            </option>
          </select>
          <select v-model="compareTo" class="compare-select">
            <option value="">To version...</option>
            <option v-for="version in versions" :key="version.id" :value="version.id">
              {{ formatVersionName(version) }}
            </option>
          </select>
        </div>
        <div v-if="compareFrom && compareTo && compareFrom !== compareTo" class="comparison-result">
          <div class="comparison-header">
            <div class="comparison-versions">
              <span class="from-version">{{ formatVersionName(fromVersionData!) }}</span>
              <span class="arrow">→</span>
              <span class="to-version">{{ formatVersionName(toVersionData!) }}</span>
            </div>
            <div class="diff-stats">
              <span class="stat added">+{{ diffStats.added }} lines</span>
              <span class="stat removed">-{{ diffStats.removed }} lines</span>
              <span class="stat modified" v-if="diffStats.modified > 0">~{{ diffStats.modified }} modified</span>
            </div>
          </div>
          <div class="comparison-summary">
            <div class="size-comparison">
              <span>Size: {{ formatSize((fromVersionData?.size || 0)) }} → {{ formatSize((toVersionData?.size || 0)) }}</span>
              <span class="size-change" :class="{
                positive: (toVersionData?.size || 0) > (fromVersionData?.size || 0),
                negative: (toVersionData?.size || 0) < (fromVersionData?.size || 0)
              }">
                {{ formatSizeChange(fromVersionData?.size || 0, toVersionData?.size || 0) }}
              </span>
            </div>
            <div class="time-comparison">
              <span>{{ formatTime(fromVersionData!.createdAt, 'short') }} → {{ formatTime(toVersionData!.createdAt, 'short') }}</span>
            </div>
          </div>
          <div class="comparison-actions">
            <button class="action-btn primary" @click="showDiffInEditor">
              📄 View Diff in Editor
            </button>
          </div>
        </div>
      </div>

      <!-- Version List -->
      <div class="version-list">
        <div
          v-for="version in sortedVersions"
          :key="version.id"
          class="version-item"
          :class="{
            active: version.id === props.activeVersionId,
            selected: selectedVersions.includes(version.id)
          }"
          @click="selectVersion(version)"
        >
          <div class="version-item-header">
            <div class="version-main">
              <div class="version-meta">
                <div class="version-name">{{ formatVersionName(version) }}</div>
                <div class="version-time">{{ formatTime(version.createdAt) }}</div>
              </div>
              <div v-if="version.summary" class="version-summary">{{ version.summary }}</div>
              <div class="version-details">
                <span class="version-size">{{ formatSize(version.contentHash?.length || 0) }}</span>
                <span v-if="version.tags?.length" class="version-tags">
                  <span v-for="tag in version.tags" :key="tag" class="tag">{{ tag }}</span>
                </span>
              </div>
            </div>

            <div class="version-actions">
              <button
                class="action-icon"
                title="Load this version"
                @click.stop="loadVersion(version)"
              >
                📄
              </button>
              <button
                class="action-icon"
                title="More actions"
                @click.stop="toggleVersionMenu(version.id)"
              >
                ⋮
              </button>
            </div>
          </div>

          <!-- Inline context menu -->
          <div
            v-if="contextMenu.visible && contextMenu.versionId === version.id"
            class="version-context-menu"
            @click.stop
          >
            <button @click="loadVersion(version)">📄 Load Version</button>
            <button @click="duplicateVersion(version)">📋 Duplicate</button>
            <button @click="tagVersion(version)">🏷️ Edit Tags</button>
            <button @click="renameVersion(version)">✏️ Rename</button>
            <button
              class="danger"
              :disabled="version.id === props.activeVersionId"
              @click="deleteVersion(version)"
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        <div v-if="!versions.length" class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-title">No versions yet</div>
          <div class="empty-description">
            Create your first version to start tracking document history
          </div>
          <button class="action-btn primary" @click="createVersion">
            Create First Version
          </button>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal-overlay" @click="showTagModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Edit Tags</h3>
          <button class="close-btn" @click="showTagModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="version-info">
            <strong>Version:</strong> {{ formatVersionName(selectedVersion!) }}
            <br>
            <strong>Created:</strong> {{ formatTime(selectedVersion!.createdAt) }}
          </div>
          <div class="form-group">
            <label for="tags-input">Tags (comma-separated):</label>
            <input
              id="tags-input"
              v-model="editingTags"
              type="text"
              placeholder="e.g., draft, review, milestone"
              @keydown.enter="saveTags"
            >
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showTagModal = false">Cancel</button>
          <button class="action-btn primary" @click="saveTags">Save Tags</button>
        </div>
      </div>
    </div>

    <!-- Rename Modal -->
    <div v-if="showRenameModal" class="modal-overlay" @click="showRenameModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Rename Version</h3>
          <button class="close-btn" @click="showRenameModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="version-info">
            <strong>Created:</strong> {{ formatTime(selectedVersion!.createdAt) }}
            <br>
            <strong>Size:</strong> {{ formatSize(selectedVersion!.size || 0) }}
          </div>
          <div class="form-group">
            <label for="alias-input">Version Name:</label>
            <input
              id="alias-input"
              v-model="editingAlias"
              type="text"
              placeholder="Enter custom name for this version"
              @keydown.enter="saveAlias"
            >
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showRenameModal = false">Cancel</button>
          <button class="action-btn primary" @click="saveAlias">Save Name</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { DocumentVersionEntry } from '../../shared/models'

interface Props {
  versions: DocumentVersionEntry[]
  activeVersionId?: string
  documentId?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'loadVersion', version: DocumentVersionEntry): void
  (e: 'createVersion'): void
  (e: 'deleteVersion', version: DocumentVersionEntry): void
  (e: 'duplicateVersion', version: DocumentVersionEntry): void
  (e: 'showDiff', data: { fromVersion: DocumentVersionEntry; toVersion: DocumentVersionEntry }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Component state
const showSettings = ref(false)
const showTagModal = ref(false)
const showRenameModal = ref(false)
const selectedVersion = ref<DocumentVersionEntry | null>(null)
const editingTags = ref('')
const editingAlias = ref('')
const showComparison = ref(false)
const selectedVersions = ref<string[]>([])
const compareFrom = ref('')
const compareTo = ref('')

// Settings (would normally come from storage)
const settings = ref({
  autoSave: {
    enabled: true,
    interval: 300 as number, // 5 minutes
    minChanges: 50 as number
  },
  cleanup: {
    enabled: false,
    keepVersions: 25 as number
  },
  ui: {
    versionNaming: 'timestamp' as 'timestamp' | 'sequential' | 'semantic'
  }
})

// Context menu
const contextMenu = ref({
  visible: false,
  versionId: null as string | null
})

// Computed properties
const sortedVersions = computed(() => {
  return [...props.versions].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

const canCreateVersion = computed(() => {
  return props.documentId != null
})

const fromVersionData = computed(() => {
  return props.versions.find(v => v.id === compareFrom.value)
})

const toVersionData = computed(() => {
  return props.versions.find(v => v.id === compareTo.value)
})

const diffStats = computed(() => {
  if (!compareFrom.value || !compareTo.value || compareFrom.value === compareTo.value) {
    return {
      added: 0,
      removed: 0,
      modified: 0
    }
  }

  const fromVersion = props.versions.find(v => v.id === compareFrom.value)
  const toVersion = props.versions.find(v => v.id === compareTo.value)

  if (!fromVersion || !toVersion) {
    return {
      added: 0,
      removed: 0,
      modified: 0
    }
  }

  // Use proper line-by-line diff calculation
  const fromLines = (fromVersion.content || '').split('\n')
  const toLines = (toVersion.content || '').split('\n')

  // Simple LCS-based diff algorithm
  const maxLines = Math.max(fromLines.length, toLines.length)
  let added = 0
  let removed = 0
  let modified = 0

  // For a more accurate diff, we'll use a simplified algorithm
  // that tracks actual line changes by position
  const minLines = Math.min(fromLines.length, toLines.length)

  // Check for modified lines (same position, different content)
  for (let i = 0; i < minLines; i++) {
    if (fromLines[i] !== toLines[i]) {
      modified++
    }
  }

  // Count added lines (when to-version is longer)
  if (toLines.length > fromLines.length) {
    added = toLines.length - fromLines.length
  }

  // Count removed lines (when from-version is longer)
  if (fromLines.length > toLines.length) {
    removed = fromLines.length - toLines.length
  }

  return {
    added,
    removed,
    modified
  }
})

// Methods
function selectVersion(version: DocumentVersionEntry) {
  emit('loadVersion', version)
}

function createVersion() {
  emit('createVersion')
}

function loadVersion(version: DocumentVersionEntry) {
  if (version.id === props.activeVersionId) {
    alert('This version is already loaded.')
    closeContextMenu()
    return
  }

  if (confirm(`Load this version?\n\nVersion: ${formatVersionName(version)}\nCreated: ${formatTime(version.createdAt)}\n\nThis will replace the current document content.`)) {
    emit('loadVersion', version)
  }
  closeContextMenu()
}

function deleteVersion(version: DocumentVersionEntry) {
  // Show confirmation dialog before deleting
  if (confirm(`Are you sure you want to delete this version?\n\nVersion: ${formatVersionName(version)}\nCreated: ${formatTime(version.createdAt)}\n\nThis action cannot be undone.`)) {
    emit('deleteVersion', version)
    closeContextMenu()
  }
}

function duplicateVersion(version: DocumentVersionEntry) {
  // Create a duplicate version with the same content
  if (confirm(`Create a duplicate of this version?\n\nVersion: ${formatVersionName(version)}\nCreated: ${formatTime(version.createdAt)}\n\nThis will create a new version with the same content.`)) {
    // First load the version content, then create a new version
    emit('loadVersion', version)
    // We should ideally wait for the load to complete, then create version
    // For now, just emit createVersion which will use current content
    setTimeout(() => {
      emit('createVersion')
    }, 100)
  }
  closeContextMenu()
}

function tagVersion(version: DocumentVersionEntry) {
  selectedVersion.value = version
  editingTags.value = version.tags?.join(', ') || ''
  showTagModal.value = true
  closeContextMenu()
}

function renameVersion(version: DocumentVersionEntry) {
  selectedVersion.value = version
  editingAlias.value = version.alias || ''
  showRenameModal.value = true
  closeContextMenu()
}

async function saveTags() {
  if (!selectedVersion.value) return

  try {
    const tags = editingTags.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_DOCUMENT_VERSION',
      data: {
        versionId: selectedVersion.value.id,
        updates: { tags }
      }
    })

    if (response?.type === 'SUCCESS') {
      // Update the local version data
      selectedVersion.value.tags = tags
      showTagModal.value = false
      // Emit event to refresh version list
      emit('loadVersion', selectedVersion.value) // This will trigger a refresh
    } else {
      throw new Error(response?.error || 'Failed to update tags')
    }
  } catch (error) {
    console.error('Failed to save tags:', error)
    alert(`Failed to save tags: ${(error as Error)?.message || 'Unknown error'}`)
  }
}

async function saveAlias() {
  if (!selectedVersion.value) return

  try {
    const alias = editingAlias.value.trim()

    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_DOCUMENT_VERSION',
      data: {
        versionId: selectedVersion.value.id,
        updates: { alias: alias || undefined }
      }
    })

    if (response?.type === 'SUCCESS') {
      // Update the local version data
      selectedVersion.value.alias = alias || undefined
      showRenameModal.value = false
      // Emit event to refresh version list
      emit('loadVersion', selectedVersion.value) // This will trigger a refresh
    } else {
      throw new Error(response?.error || 'Failed to update version name')
    }
  } catch (error) {
    console.error('Failed to save version name:', error)
    alert(`Failed to save version name: ${(error as Error)?.message || 'Unknown error'}`)
  }
}

function toggleVersionMenu(versionId: string) {
  if (contextMenu.value.visible && contextMenu.value.versionId === versionId) {
    closeContextMenu()
  } else {
    contextMenu.value = {
      visible: true,
      versionId
    }
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.versionId = null
}

function showDiffInEditor() {
  if (!fromVersionData.value || !toVersionData.value) {
    return
  }

  emit('showDiff', {
    fromVersion: fromVersionData.value,
    toVersion: toVersionData.value
  })
}

function formatVersionName(version: DocumentVersionEntry): string {
  // Always prioritize custom alias if it exists
  if (version.alias && version.alias.trim()) {
    return version.alias
  }

  // Fall back to configured naming scheme
  if (settings.value.ui.versionNaming === 'sequential') {
    const index = sortedVersions.value.findIndex(v => v.id === version.id)
    return `v${sortedVersions.value.length - index}`
  } else if (settings.value.ui.versionNaming === 'semantic') {
    return version.semanticVersion || 'v1.0.0'
  } else {
    return formatTime(version.createdAt, 'short')
  }
}

function formatTime(date: Date | string, format: 'short' | 'long' = 'long'): string {
  const d = new Date(date)
  if (format === 'short') {
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  return d.toLocaleDateString() + ' at ' + d.toLocaleTimeString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return Math.round(bytes / (1024 * 1024)) + ' MB'
}

function formatSizeChange(fromSize: number, toSize: number): string {
  const diff = toSize - fromSize
  if (diff === 0) return '(no change)'

  const sign = diff > 0 ? '+' : ''
  if (Math.abs(diff) < 1024) {
    return `(${sign}${diff} B)`
  } else if (Math.abs(diff) < 1024 * 1024) {
    return `(${sign}${Math.round(diff / 1024)} KB)`
  } else {
    return `(${sign}${Math.round(diff / (1024 * 1024))} MB)`
  }
}

async function updateSettings() {
  // Map component structure back to backend structure and save
  try {
    const backendSettings = {
      autoSave: {
        enabled: settings.value.autoSave.enabled,
        interval: settings.value.autoSave.interval * 1000, // Convert seconds to ms
        contentThreshold: settings.value.autoSave.minChanges
      },
      storage: {
        autoCleanup: {
          enabled: settings.value.cleanup.enabled,
          keepCount: settings.value.cleanup.keepVersions
        },
        maxVersionsPerDocument: settings.value.cleanup.keepVersions
      },
      ui: {
        versionNaming: settings.value.ui.versionNaming
      }
    }

    console.log('[VersionManager] Updating settings:', backendSettings)

    await chrome.runtime.sendMessage({
      type: 'UPDATE_VERSION_MANAGEMENT_SETTINGS',
      data: backendSettings
    })
  } catch (error) {
    console.error('Failed to update version settings:', error)
  }
}

// Load settings on mount
onMounted(async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_USER_SETTINGS'
    })

    let versionManagement = null
    if (response?.type === 'SUCCESS' && response.data?.versionManagement) {
      versionManagement = response.data.versionManagement
    } else if (response?.versionManagement) {
      versionManagement = response.versionManagement
    }

    if (versionManagement) {
      // Map the backend structure to the component's expected structure
      settings.value = {
        autoSave: {
          enabled: versionManagement.autoSave?.enabled ?? settings.value.autoSave.enabled,
          interval: Math.floor((versionManagement.autoSave?.interval ?? 300000) / 1000), // Convert ms to seconds
          minChanges: versionManagement.autoSave?.contentThreshold ?? settings.value.autoSave.minChanges
        },
        cleanup: {
          enabled: versionManagement.storage?.autoCleanup?.enabled ?? settings.value.cleanup.enabled,
          keepVersions: versionManagement.storage?.autoCleanup?.keepCount ??
                       versionManagement.storage?.maxVersionsPerDocument ??
                       settings.value.cleanup.keepVersions
        },
        ui: {
          versionNaming: versionManagement.ui?.versionNaming ?? settings.value.ui.versionNaming
        }
      }
      console.log('[VersionManager] Loaded settings:', settings.value)
    }
  } catch (error) {
    console.error('Failed to load version settings:', error)
  }
})

// Click outside handler for closing context menus
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})
</script>

<style scoped>
.version-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7fafc;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.header-left h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.version-count {
  font-size: 12px;
  color: #718096;
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 10px;
}

.header-controls {
  display: flex;
  gap: 4px;
}

.settings-btn,
.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #718096;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.settings-btn:hover,
.close-btn:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.settings-panel {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.settings-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.close-settings {
  background: #3182ce;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.settings-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #2d3748;
  cursor: pointer;
}

.setting-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.sub-settings {
  margin-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.setting-item label {
  min-width: 80px;
  color: #4a5568;
}

.setting-item select,
.setting-item input {
  padding: 4px 8px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 12px;
}

.version-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.quick-actions {
  padding: 16px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
}

.action-btn {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.action-btn.primary {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
}

.action-btn.primary:hover {
  background: #2c5aa0;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.comparison-panel {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.comparison-selectors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.compare-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  min-width: 0; /* Allow shrinking */
}

.comparison-result {
  background: #f7fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-top: 12px;
}

.comparison-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.comparison-versions {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2d3748;
}

.from-version {
  color: #e53e3e;
}

.to-version {
  color: #38a169;
}

.arrow {
  color: #718096;
  font-size: 14px;
}

.diff-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.comparison-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #4a5568;
}

.size-comparison {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-change {
  font-weight: 500;
}

.size-change.positive {
  color: #38a169;
}

.size-change.negative {
  color: #e53e3e;
}

.time-comparison {
  color: #718096;
}

.comparison-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.stat {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
}

.stat.added {
  color: #22c55e;
  background: #dcfce7;
}

.stat.removed {
  color: #ef4444;
  background: #fee2e2;
}

.stat.modified {
  color: #f59e0b;
  background: #fef3c7;
}

.version-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.version-item {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.version-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.version-item:hover {
  border-color: #cbd5e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.version-item.active {
  border-color: #3182ce;
  background: #ebf8ff;
}

.version-item.selected {
  border-color: #10b981;
  background: #ecfdf5;
}

.version-main {
  flex: 1;
  min-width: 0;
}

.version-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.version-name {
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
}

.version-time {
  font-size: 11px;
  color: #718096;
}

.version-summary {
  font-size: 12px;
  color: #4a5568;
  line-height: 1.4;
  margin-bottom: 6px;
}

.version-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-size {
  font-size: 11px;
  color: #718096;
}

.version-tags {
  display: flex;
  gap: 4px;
}

.tag {
  font-size: 10px;
  background: #e2e8f0;
  color: #4a5568;
  padding: 2px 6px;
  border-radius: 8px;
}

.version-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-icon {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #718096;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.action-icon:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  height: 100%;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 13px;
  color: #718096;
  margin-bottom: 20px;
  max-width: 200px;
  line-height: 1.4;
}

.version-context-menu {
  margin-top: 8px;
  padding: 8px 0;
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.version-context-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  color: #2d3748;
  cursor: pointer;
  transition: background 0.1s;
}

.version-context-menu button:hover {
  background: #e2e8f0;
}

.version-context-menu button.danger {
  color: #e53e3e;
}

.version-context-menu button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.modal-header .close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #718096;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.modal-header .close-btn:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.modal-body {
  padding: 20px;
}

.version-info {
  background: #f7fafc;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #4a5568;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #2d3748;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.action-btn.secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.action-btn.secondary:hover {
  background: #cbd5e0;
}

.action-btn.primary {
  background: #3182ce;
  color: white;
}

.action-btn.primary:hover {
  background: #2c5aa0;
}
</style>