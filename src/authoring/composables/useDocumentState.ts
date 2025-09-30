import { ref, computed } from 'vue'
import type { DocumentEntry, DocumentVersionEntry, TaskEntry } from '../../shared/models'

export function useDocumentState() {
  // State
  const document = ref<DocumentEntry | null>(null)
  const documentLoaded = ref(false)
  const task = ref<TaskEntry | null>(null)
  const versions = ref<DocumentVersionEntry[]>([])
  const saving = ref(false)
  const documentContent = ref('')

  // URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const documentId = urlParams.get('documentId')
  const initialTaskId = urlParams.get('taskId')

  // Computed
  const documentTitle = computed(() => document.value?.title?.trim() || 'Untitled Draft')

  // Helper function for API responses
  function isSuccessResponse(response: any): response is { type: 'SUCCESS'; data: any } {
    return response && response.type === 'SUCCESS'
  }

  // Get active version content
  function getActiveVersionContent(): string {
    if (!document.value || !versions.value.length) return ''

    const activeVersionId = document.value.activeVersionId
    if (activeVersionId) {
      const activeVersion = versions.value.find(v => v.id === activeVersionId)
      if (activeVersion) {
        return activeVersion.content
      }
    }

    // Fallback to the most recent version
    const latestVersion = versions.value.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

    return latestVersion?.content || ''
  }

  // Load document and versions
  async function loadDocument() {
    if (!documentId) return

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOCUMENT',
        data: { documentId }
      })

      if (isSuccessResponse(response) && response.data?.document) {
        document.value = response.data.document
        versions.value = response.data.versions || []

        // Set the document content from the active version
        documentContent.value = getActiveVersionContent()

        return {
          document: response.data.document,
          versions: response.data.versions || [],
          content: documentContent.value
        }
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    } finally {
      documentLoaded.value = true
    }

    return null
  }

  // Load task data
  async function loadTaskData(taskId?: string | null) {
    const targetTaskId = taskId ?? document.value?.taskId ?? initialTaskId
    if (!targetTaskId) return

    try {
      // Load task info
      const taskResponse = await chrome.runtime.sendMessage({
        type: 'GET_TASK',
        data: { taskId: targetTaskId }
      })

      if (isSuccessResponse(taskResponse)) {
        task.value = taskResponse.data
      }

      return task.value
    } catch (error) {
      console.error('Failed to load task data:', error)
      return null
    }
  }

  // Save document version
  async function saveDocument(content: string) {
    if (!document.value || saving.value) return false

    saving.value = true
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_DOCUMENT_VERSION',
        data: {
          documentId: document.value.id,
          content,
          createdBy: 'user'
        }
      })

      if (isSuccessResponse(response)) {
        // Refresh document data
        await loadDocument()
        await loadTaskData(document.value?.taskId ?? initialTaskId)
        return true
      }
    } catch (error) {
      console.error('Failed to save document:', error)
    } finally {
      saving.value = false
    }

    return false
  }

  // Update document metadata
  async function updateDocument(updates: Partial<DocumentEntry>) {
    if (!document.value) return false

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_DOCUMENT',
        data: {
          documentId: document.value.id,
          updates
        }
      })

      if (isSuccessResponse(response)) {
        // Update local state
        Object.assign(document.value, updates)
        return true
      }
    } catch (error) {
      console.error('Failed to update document:', error)
    }

    return false
  }

  // Load specific version
  async function loadVersion(version: DocumentVersionEntry) {
    if (!document.value) return false

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_DOCUMENT',
        data: {
          documentId: document.value.id,
          updates: { activeVersionId: version.id }
        }
      })

      document.value.activeVersionId = version.id
      return version.content
    } catch (error) {
      console.error('Failed to update active version:', error)
      return false
    }
  }

  return {
    // State
    document,
    documentLoaded,
    task,
    versions,
    saving,
    documentContent,
    documentId,
    initialTaskId,

    // Computed
    documentTitle,

    // Methods
    loadDocument,
    loadTaskData,
    saveDocument,
    updateDocument,
    loadVersion
  }
}