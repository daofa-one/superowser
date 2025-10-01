<script setup lang="ts">
import { useSidePanelStore } from '../stores/sidepanel-store'
import type { DocumentEntry, TaskEntry } from '../../shared/models'

interface Props {
  documents: DocumentEntry[]
  currentTask: TaskEntry | null
}

interface Emits {
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useSidePanelStore()

const openDocument = async (document: DocumentEntry) => {
  try {
    const response = await store.sendMessage({
      type: 'OPEN_AUTHORING_WORKSPACE',
      data: {
        documentId: document.id,
        taskId: document.taskId
      }
    })

    if (response?.type === 'ERROR') {
      throw new Error(response.error?.message || 'Failed to open document')
    }
  } catch (error) {
    console.error('Failed to open document:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to open authoring workspace'
    })
  }
}

const editDocument = async (document: DocumentEntry) => {
  // For now, editing just opens the document in authoring workspace
  // Could be enhanced to show inline editing or metadata editing
  await openDocument(document)
}

const deleteDocument = async (document: DocumentEntry) => {
  if (!confirm(`Delete "${document.title}" permanently? This cannot be undone.`)) {
    return
  }

  try {
    await store.sendMessage({
      type: 'DELETE_DOCUMENT',
      data: { documentId: document.id }
    })


    emit('refresh')

    store.addNotification({
      type: 'success',
      message: `Deleted "${document.title}" permanently`
    })
  } catch (error) {
    console.error('Failed to delete document:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to delete document'
    })
  }
}


const createNewDocument = async () => {
  if (!props.currentTask) {
    store.addNotification({
      type: 'error',
      message: 'No active task selected'
    })
    return
  }

  try {
    const response = await store.sendMessage({
      type: 'CREATE_DOCUMENT',
      data: {
        title: `New Document - ${props.currentTask.name}`,
        taskId: props.currentTask.id,
        status: 'draft',
        initialContent: `# New Document\n\nStart writing your content here...`
      }
    }) as { type: string; data?: { document: DocumentEntry; version?: unknown } }

    if (response?.type === 'SUCCESS' && response.data?.document) {
      // Refresh the documents list first
      emit('refresh')

      // Small delay to ensure document is fully committed
      await new Promise(resolve => setTimeout(resolve, 100))

      // Open the newly created document in authoring workspace
      await openDocument(response.data.document)

      store.addNotification({
        type: 'success',
        message: 'New document created and opened'
      })
    } else {
      throw new Error('Failed to create document')
    }
  } catch (error) {
    console.error('Failed to create new document:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to create new document'
    })
  }
}
</script>

<template>
  <section v-if="documents.length > 0 || currentTask" class="documents-section">
    <div class="section-header">
      <h4 class="section-title">📝 Documents</h4>
      <button
        v-if="currentTask"
        class="btn-new-document"
        title="Create new document for this task"
        @click="createNewDocument"
      >
        <svg viewBox="0 0 24 24" class="new-doc-icon">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" fill="currentColor"/>
          <path d="M11,15H13V12H16V10H13V7H11V10H8V12H11V15Z" fill="currentColor"/>
        </svg>
        New
      </button>
    </div>

    <div v-if="documents.length > 0" class="documents-list">
      <ul class="document-list">
        <li
          v-for="document in documents"
          :key="document.id"
          class="document-row"
        >
          <div class="document-icon">
            <div class="document-type-icon">📄</div>
          </div>

          <div class="document-main" @click="openDocument(document)">
            <div class="document-title" :title="document.title">
              {{ document.title }}
            </div>
            <div class="document-meta">
              <span class="document-status" :class="`status-${document.status}`">
                {{ document.status }}
              </span>
              <span class="document-date">
                {{ new Date(document.updatedAt).toLocaleDateString() }}
              </span>
            </div>

            <div class="document-actions">
              <button
                class="btn btn-icon btn-edit"
                title="Edit document"
                @click.stop="editDocument(document)"
              >
                ✏️
              </button>
              <button
                class="btn btn-icon btn-delete"
                title="Delete document"
                @click.stop="deleteDocument(document)"
              >
                🗑️
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div v-else-if="currentTask" class="empty-documents">
      <div class="empty-icon">📄</div>
      <div class="empty-message">No documents yet</div>
      <div class="empty-hint">Create your first document for this task</div>
    </div>
  </section>
</template>

<style scoped>
.documents-section {
  margin: 12px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-new-document {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  padding: 5px 10px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  line-height: 1;
}

.btn-new-document:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.new-doc-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.documents-list {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.document-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.document-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  transition: background-color 0.2s;
  cursor: pointer;
  position: relative;
}

.document-row:hover {
  background-color: #f8fafc;
}

.document-row:last-child {
  border-bottom: none;
}

.document-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.document-type-icon {
  font-size: 16px;
}

.document-main {
  min-width: 0;
  position: relative;
  padding-right: 60px; /* Space for overlaid actions */
}

.document-main:hover .document-title {
  color: #0056b3;
}

.document-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.3;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.document-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: capitalize;
}

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

.document-date {
  font-size: 11px;
  color: #64748b;
}

.document-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 2px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.document-row:hover .document-actions,
.document-row:focus-within .document-actions {
  opacity: 1;
}

.btn {
  border: none;
  border-radius: 4px;
  padding: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon {
  background: #f8f9fa;
  color: #495057;
}

.btn-icon:hover {
  background: #e9ecef;
}

.btn-edit {
  background: #e1f5fe;
  color: #0277bd;
}

.btn-edit:hover {
  background: #b3e5fc;
  color: #01579b;
}

.btn-delete {
  background: #f8d7da;
  color: #721c24;
}

.btn-delete:hover {
  background: #f5c6cb;
  color: #5a1a1d;
}

.empty-documents {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  text-align: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafafa;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.8;
}
</style>