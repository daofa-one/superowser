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
    const latestVersion = [...versions.value].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

    return latestVersion?.content || ''
  }

  // Load document and versions
  async function loadDocument() {
    if (!documentId) {
      console.log('[useDocumentState] No documentId provided for loading')
      return
    }

    console.log('[useDocumentState] Loading document:', documentId)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOCUMENT',
        data: { documentId, versionLimit: 200 }
      })

      console.log('[useDocumentState] Load response:', response)

      if (isSuccessResponse(response) && response.data?.document) {
        document.value = response.data.document
        const rawVersions = response.data.versions || []
        console.log('[useDocumentState] Raw versions from DB:', rawVersions.length, rawVersions.map(v => ({id: v.id, createdAt: v.createdAt})))

        const sortedVersions = rawVersions.slice().sort((a: DocumentVersionEntry, b: DocumentVersionEntry) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        versions.value = sortedVersions
        console.log('[useDocumentState] Sorted versions:', sortedVersions.length, sortedVersions.map(v => ({id: v.id, createdAt: v.createdAt})))

        // Set the document content from the active version
        const activeContent = getActiveVersionContent()
        documentContent.value = activeContent
        console.log('[useDocumentState] Active version content length:', activeContent.length, 'active version ID:', document.value.activeVersionId)

        return {
          document: response.data.document,
          versions: response.data.versions || [],
          content: documentContent.value
        }
      } else {
        console.error('[useDocumentState] Failed to load document - invalid response:', response)
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
    if (!document.value || saving.value) {
      console.log('[useDocumentState] Save skipped - no document or already saving')
      return false
    }

    console.log('[useDocumentState] Starting save for document:', document.value.id, 'content length:', content.length)
    saving.value = true
    try {
      const messageData = {
        documentId: document.value.id,
        content,
        createdBy: 'user' as const
      }
      console.log('[useDocumentState] Sending message data:', messageData)

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_DOCUMENT_VERSION',
        data: messageData
      })

      console.log('[useDocumentState] Raw response from background:', response)
      console.log('[useDocumentState] Response type:', typeof response, 'Response keys:', response ? Object.keys(response) : 'null')

      if (isSuccessResponse(response)) {
        console.log('[useDocumentState] Save successful, processing response...')
        const savedVersion = response.data as DocumentVersionEntry
        const savedVersionId = savedVersion.id
        const savedCreatedAt = savedVersion.createdAt instanceof Date
          ? savedVersion.createdAt
          : new Date(savedVersion.createdAt)

        console.log('[useDocumentState] Saved version:', savedVersionId, 'at:', savedCreatedAt)

        // Update editor content immediately with the saved text
        documentContent.value = content

        // Update local document metadata
        if (document.value) {
          document.value.activeVersionId = savedVersionId
          document.value.updatedAt = savedCreatedAt
        }

        // Merge the saved version into the local list, sorted most-recent first
        const filtered = versions.value.filter(version => version.id !== savedVersionId)
        versions.value = [
          {
            ...savedVersion,
            createdAt: savedCreatedAt
          },
          ...filtered
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        console.log('[useDocumentState] Local state updated, versions count:', versions.value.length)
        return true
      } else {
        console.error('[useDocumentState] Save failed - non-success response:', JSON.stringify(response, null, 2))
        console.error('[useDocumentState] Response type:', response?.type)
        console.error('[useDocumentState] Response error:', response?.error)

        // Show user-friendly error message
        const errorMessage = response?.error?.message || response?.error || 'Unknown error occurred while saving'
        alert(`Failed to save document: ${errorMessage}`)
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
