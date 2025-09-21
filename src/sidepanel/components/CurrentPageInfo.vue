<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSidePanelStore } from '../stores/sidepanel-store'

const store = useSidePanelStore()

// Current page data
const currentPage = ref<any>(null)
const isLoading = ref(true)
const isPageSaved = ref(false)
const showShortcutForm = ref(false)
const shortcutInput = ref('')
const showTagForm = ref(false)
const tagInput = ref('')
const currentTags = ref<string[]>([])

// Computed properties
const displayUrl = computed(() => {
  if (!currentPage.value?.url) return ''
  try {
    const url = new URL(currentPage.value.url)
    return url.hostname + url.pathname
  } catch {
    return currentPage.value.url
  }
})

const hasNotes = computed(() => {
  return currentPage.value?.noteCount > 0
})

const canAddToTask = computed(() => {
  return store.cache.currentTask && !isPageSaved.value
})

const taskActionLabel = computed(() => {
  if (isPageSaved.value) return 'Saved to Task'
  if (store.cache.currentTask) return `Add to "${store.cache.currentTask.name}"`
  return 'No Active Task'
})

// Methods
const loadCurrentPageInfo = async () => {
  try {
    isLoading.value = true
    console.log('Loading current page info...')

    // Get current tab info via background script
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'GET_CURRENT_TAB_INFO' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        }
      )
    })

    console.log('Background response:', response)

    if (response && response.type === 'SUCCESS' && response.data) {
      const tabData = response.data
      console.log('Tab data:', tabData)

      // Check if this page is already saved in the database
      const savedPageResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_PAGE_BY_URL', data: { url: tabData.url } },
          (response: any) => {
            resolve(response)
          }
        )
      }) as any

      let savedPage = null
      if (savedPageResponse && savedPageResponse.type === 'SUCCESS' && savedPageResponse.data) {
        savedPage = savedPageResponse.data
        console.log('Found saved page:', savedPage)
      }

      currentPage.value = {
        url: tabData.url,
        title: tabData.title,
        favicon: tabData.favicon,
        tags: savedPage?.tags || [],
        noteCount: savedPage?.noteCount || 0,
        shortcut: savedPage?.shortcut || undefined
      }
      isPageSaved.value = !!savedPage
    } else {
      console.log('No tab data received')
      currentPage.value = null
    }
  } catch (error) {
    console.error('Failed to load current page info:', error)
    currentPage.value = null
  } finally {
    isLoading.value = false
  }
}

const addToCurrentTask = async () => {
  if (!canAddToTask.value || !currentPage.value) return

  try {
    await store.saveCurrentPage({
      task: store.cache.currentTask?.name
    })

    isPageSaved.value = true

    // Reload page info to get updated data
    await loadCurrentPageInfo()
  } catch (error) {
    console.error('Failed to add page to task:', error)
  }
}

const saveWithOptions = async () => {
  // This could open a dialog for advanced save options
  // For now, just save with current task
  await addToCurrentTask()
}

const openPage = () => {
  if (currentPage.value?.url) {
    chrome.tabs.create({ url: currentPage.value.url })
  }
}

const copyUrl = async () => {
  if (currentPage.value?.url) {
    try {
      await navigator.clipboard.writeText(currentPage.value.url)
      store.addNotification({
        type: 'success',
        message: 'URL copied to clipboard'
      })
    } catch (error) {
      store.addNotification({
        type: 'error',
        message: 'Failed to copy URL'
      })
    }
  }
}

const toggleShortcutForm = () => {
  showShortcutForm.value = !showShortcutForm.value
  if (showShortcutForm.value) {
    // Close tag form if open
    showTagForm.value = false
    // Pre-fill with existing shortcut if any
    shortcutInput.value = currentPage.value?.shortcut || ''
  }
}

const saveShortcut = async () => {
  if (!currentPage.value || !shortcutInput.value.trim()) return

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_SHORTCUT',
          data: {
            url: currentPage.value.url,
            shortcut: shortcutInput.value.trim()
          }
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        }
      )
    }) as any

    if (response && response.type === 'SUCCESS') {
      // Update current page with the new shortcut
      currentPage.value.shortcut = shortcutInput.value.trim()

      showShortcutForm.value = false
      store.addNotification({
        type: 'success',
        message: 'Shortcut saved successfully'
      })
    } else {
      throw new Error('Failed to save shortcut')
    }
  } catch (error) {
    console.error('Failed to save shortcut:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save shortcut'
    })
  }
}

const cancelShortcut = () => {
  showShortcutForm.value = false
  shortcutInput.value = ''
}

const toggleTagForm = () => {
  showTagForm.value = !showTagForm.value
  if (showTagForm.value) {
    // Close shortcut form if open
    showShortcutForm.value = false
    // Pre-fill with existing tags if any
    currentTags.value = [...(currentPage.value?.tags || [])]
    tagInput.value = ''
  }
}

const addTag = () => {
  const tag = tagInput.value.trim()
  if (tag && !currentTags.value.includes(tag)) {
    currentTags.value.push(tag)
    tagInput.value = ''
  }
}

const removeTag = (index: number) => {
  currentTags.value.splice(index, 1)
}

const saveTags = async () => {
  if (!currentPage.value) return

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_TAGS',
          data: {
            url: currentPage.value.url,
            tags: currentTags.value
          }
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        }
      )
    }) as any

    if (response && response.type === 'SUCCESS') {
      // Update current page with the new tags
      currentPage.value.tags = [...currentTags.value]

      showTagForm.value = false
      store.addNotification({
        type: 'success',
        message: 'Tags saved successfully'
      })
    } else {
      throw new Error('Failed to save tags')
    }
  } catch (error) {
    console.error('Failed to save tags:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to save tags'
    })
  }
}

const cancelTags = () => {
  showTagForm.value = false
  tagInput.value = ''
  currentTags.value = []
}

// Listen for tab changes from background script
const onTabChange = (message: any, _sender: any, _sendResponse: any) => {
  if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
    console.log('Tab change detected, reloading page info...')
    loadCurrentPageInfo()
  }
  return false // Indicate we don't need to send a response
}

// Lifecycle
onMounted(() => {
  loadCurrentPageInfo()

  // Listen for tab changes
  chrome.runtime.onMessage.addListener(onTabChange)
})

// Cleanup listener when component unmounts
onUnmounted(() => {
  if (chrome.runtime.onMessage.hasListener(onTabChange)) {
    chrome.runtime.onMessage.removeListener(onTabChange)
  }
})
</script>

<template>
  <section class="current-page-info">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading page info...</span>
    </div>

    <!-- Content -->
    <div v-else-if="currentPage" class="page-content">
      <!-- Top Section: Icon + URL -->
      <div class="top-section">
        <div class="page-icon">
          <img
            v-if="currentPage.favicon"
            :src="currentPage.favicon"
            alt="Page favicon"
            @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
          />
          <div v-else class="default-icon">🌐</div>
        </div>

        <div class="page-url">
          <div class="url-display" :title="currentPage.url">
            {{ displayUrl }}
          </div>
          <div v-if="currentPage.title" class="page-title">
            {{ currentPage.title }}
          </div>
        </div>
      </div>

      <!-- Middle Section: Tags and Notes -->
      <div class="middle-section">
        <div class="tags-container">
          <div v-if="currentPage.tags && currentPage.tags.length > 0" class="tags">
            <span v-for="tag in currentPage.tags" :key="tag" class="tag">
              #{{ tag }}
            </span>
          </div>
          <div v-else class="no-tags">
            No tags
          </div>
        </div>

        <div class="notes-container">
          <div v-if="hasNotes" class="notes-indicator">
            📝 {{ currentPage.noteCount || 0 }} note(s)
          </div>
          <div v-if="currentPage.shortcut" class="shortcut">
            @{{ currentPage.shortcut }}
          </div>
        </div>
      </div>

      <!-- Action Section: Buttons -->
      <div class="action-section">
        <div class="primary-actions">
          <button
            v-if="canAddToTask"
            @click="addToCurrentTask"
            class="btn btn-primary"
            :disabled="store.ui.isLoading"
          >
            {{ taskActionLabel }}
          </button>

          <button
            v-else-if="isPageSaved"
            class="btn btn-success"
            disabled
          >
            ✓ {{ taskActionLabel }}
          </button>

          <button
            v-else
            @click="saveWithOptions"
            class="btn btn-secondary"
          >
            Save Page
          </button>
        </div>

        <div class="secondary-actions">
          <button @click="toggleShortcutForm" class="btn btn-icon" title="Set shortcut">
            @
          </button>
          <button @click="toggleTagForm" class="btn btn-icon" title="Manage tags">
            #
          </button>
          <button @click="copyUrl" class="btn btn-icon" title="Copy URL">
            📋
          </button>
          <button @click="openPage" class="btn btn-icon" title="Open in new tab">
            🔗
          </button>
        </div>
      </div>

      <!-- Shortcut Form Section -->
      <div v-if="showShortcutForm" class="shortcut-form-section">
        <div class="form-header">
          <h4>Set Shortcut</h4>
        </div>

        <div class="form-content">
          <div class="input-group">
            <label for="shortcut-input">Shortcut:</label>
            <input
              id="shortcut-input"
              v-model="shortcutInput"
              type="text"
              placeholder="Enter shortcut (e.g., @docs)"
              class="shortcut-input"
              @keyup.enter="saveShortcut"
              @keyup.escape="cancelShortcut"
            />
          </div>

          <div class="input-group">
            <label>URL:</label>
            <input
              :value="currentPage.url"
              type="text"
              readonly
              class="url-input"
            />
          </div>
        </div>

        <div class="form-actions">
          <button @click="saveShortcut" class="btn btn-primary" :disabled="!shortcutInput.trim()">
            Save
          </button>
          <button @click="cancelShortcut" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <!-- Tag Form Section -->
      <div v-if="showTagForm" class="tag-form-section">
        <div class="form-header">
          <h4>Manage Tags</h4>
        </div>

        <div class="form-content">
          <div class="input-group">
            <label for="tag-input">Add Tag:</label>
            <div class="tag-input-wrapper">
              <input
                id="tag-input"
                v-model="tagInput"
                type="text"
                placeholder="Enter tag and press Enter"
                class="tag-input"
                @keyup.enter="addTag"
                @keyup.escape="cancelTags"
              />
              <button @click="addTag" class="btn btn-add-tag" :disabled="!tagInput.trim()">
                Add
              </button>
            </div>
          </div>

          <div v-if="currentTags.length > 0" class="current-tags">
            <label>Current Tags:</label>
            <div class="tags-list">
              <span
                v-for="(tag, index) in currentTags"
                :key="tag"
                class="tag-item"
              >
                {{ tag }}
                <button @click="removeTag(index)" class="tag-remove">×</button>
              </span>
            </div>
          </div>
          <div v-else class="no-tags-message">
            No tags yet. Add your first tag above.
          </div>
        </div>

        <div class="form-actions">
          <button @click="saveTags" class="btn btn-primary">
            Save Tags
          </button>
          <button @click="cancelTags" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- No Page State -->
    <div v-else class="no-page-state">
      <div class="empty-icon">🌍</div>
      <div class="empty-message">No active page</div>
    </div>
  </section>
</template>

<style scoped>
.current-page-info {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
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

/* Top Section */
.top-section {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.page-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}

.page-icon img {
  width: 16px;
  height: 16px;
}

.default-icon {
  font-size: 16px;
}

.page-url {
  flex: 1;
  min-width: 0;
}

.url-display {
  font-size: 13px;
  color: #007bff;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-title {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
  font-weight: normal;
  line-height: 1.3;
  max-height: 1.3em; /* 1 line max */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Middle Section */
.middle-section {
  margin-bottom: 12px;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.tags-container {
  margin-bottom: 8px;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  background: #f0f8ff;
  color: #0066cc;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e0f0ff;
}

.no-tags {
  font-size: 12px;
  color: #999;
  font-style: italic;
}

.notes-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notes-indicator {
  font-size: 12px;
  color: #666;
}

.shortcut {
  font-size: 12px;
  background: #f8f9fa;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* Action Section */
.action-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.primary-actions {
  flex: 1;
}

.secondary-actions {
  display: flex;
  gap: 4px;
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
  min-height: 32px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 6px;
  background: #f8f9fa;
  color: #495057;
  font-size: 14px;
}

.btn-icon:hover:not(:disabled) {
  background: #e9ecef;
}

/* Shortcut Form Section */
.shortcut-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.form-header {
  margin-bottom: 12px;
}

.form-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-content {
  margin-bottom: 16px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 4px;
}

.shortcut-input,
.url-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.shortcut-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.url-input {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-actions .btn {
  min-width: 70px;
}

/* Tag Form Section */
.tag-form-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.tag-input-wrapper {
  display: flex;
  gap: 8px;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.tag-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.btn-add-tag {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add-tag:hover:not(:disabled) {
  background: #0056b3;
}

.btn-add-tag:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.current-tags {
  margin-top: 16px;
}

.current-tags label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 13px;
  border: 1px solid #bbdefb;
}

.tag-remove {
  background: none;
  border: none;
  color: #1976d2;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.no-tags-message {
  margin-top: 12px;
  font-size: 13px;
  color: #999;
  font-style: italic;
}

/* No Page State */
.no-page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
}
</style>