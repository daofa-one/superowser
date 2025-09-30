<template>
  <div class="authoring-workspace">
    <!-- Header -->
    <header class="workspace-header">
      <div class="header-left">
        <template v-if="documentLoaded">
          <div class="title-container">
            <h1
              v-if="!isEditingTitle"
              class="document-title"
              @click="startEditTitle"
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
              @blur="saveTitle"
              @keydown.enter="saveTitle"
              @keydown.escape="cancelEditTitle"
            />
            <!-- <button
              v-if="!isEditingTitle"
              class="edit-title-btn"
              @click="startEditTitle"
              title="Edit title"
            >
              ✏️
            </button> -->
          </div>
        </template>
        <span v-else class="loading-text">Loading...</span>
        <span v-if="task" class="task-badge">[{{ task.name }}]</span>
      </div>
      <div class="header-right">
        <button class="export-btn" :disabled="!documentLoaded || !document" title="Export document" @click="exportDocument">
          Export
        </button>
        <button class="save-btn" :disabled="saving || !documentLoaded || !document" @click="saveDocument">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button class="versions-btn" :disabled="!documentLoaded || !document" @click="showVersions = !showVersions">
          Versions
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <div class="workspace-main">
      <!-- Sidebar -->
      <aside v-if="showSidebar" class="workspace-sidebar">
        <div class="sidebar-header">
          <h3>References</h3>
          <button class="close-sidebar" @click="closeSidebar">×</button>
        </div>

        <!-- Task pages -->
        <section v-if="task" class="sidebar-section">
          <h4>Task Pages</h4>
          <div class="reference-list">
            <div
              v-for="page in taskPages"
              :key="page.id"
              class="reference-item"
              draggable="true"
              @dragstart="startDrag(page, 'page', $event)"
            >
              <img v-if="page.favicon" :src="page.favicon" class="favicon" />
              <div class="reference-content">
                <div class="reference-title">{{ page.title }}</div>
                <div class="reference-url">{{ page.url }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Task notes -->
        <section v-if="task" class="sidebar-section">
          <h4>Task Notes</h4>
          <div class="reference-list">
            <div
              v-for="note in taskNotes"
              :key="note.id"
              class="reference-item"
              draggable="true"
              @dragstart="startDrag(note, 'note', $event)"
            >
              <div class="reference-content">
                <div class="reference-title">{{ note.content.slice(0, 50) }}...</div>
                <div class="reference-meta">{{ note.category }}</div>
              </div>
            </div>
          </div>
        </section>
      </aside>

      <!-- Editor area -->
      <main class="editor-container" :class="{ 'drag-over': isDragOver }">
        <VueMonacoEditor
          ref="editorRef"
          v-model:value="editorContent"
          :options="editorOptions"
          :language="'markdown'"
          :theme="'vs'"
          class="monaco-editor-wrapper"
          @mount="handleEditorMount"
          @change="handleContentChange"
        />
      </main>

      <!-- Version panel -->
      <aside v-if="showVersions" class="version-panel">
        <div class="panel-header">
          <h3>Version History</h3>
          <button class="close-panel" @click="showVersions = false">×</button>
        </div>
        <div class="version-list">
          <div
            v-for="version in versions"
            :key="version.id"
            class="version-item"
            :class="{ active: version.id === document?.activeVersionId }"
            @click="loadVersion(version)"
          >
            <div class="version-meta">
              <span class="version-date">{{ formatDate(version.createdAt) }}</span>
              <span class="version-author">{{ version.createdBy }}</span>
            </div>
            <div v-if="version.summary" class="version-summary">{{ version.summary }}</div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Floating sidebar toggle -->
    <button v-if="!showSidebar" class="sidebar-toggle" @click="openSidebar">
      📚
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import { DocumentEntry, DocumentVersionEntry, TaskEntry, PageEntry, NoteEntry } from '../shared/models'

// State
const document = ref<DocumentEntry | null>(null)
const documentLoaded = ref(false)
const task = ref<TaskEntry | null>(null)
const versions = ref<DocumentVersionEntry[]>([])
const taskPages = ref<PageEntry[]>([])
const taskNotes = ref<NoteEntry[]>([])
const showSidebar = ref(true)
const showVersions = ref(false)
const saving = ref(false)
const isDragOver = ref(false)

// Title editing
const isEditingTitle = ref(false)
const editTitleValue = ref('')
const titleInputRef = ref<HTMLInputElement>()

// Monaco editor
const editorRef = ref()
const editorContent = ref('')
let editor: any = null
let layoutRaf: number | null = null

// Editor options
const documentTitle = computed(() => document.value?.title?.trim() || 'Untitled Draft')

const editorOptions = computed(() => ({
  wordWrap: 'on' as const,
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  readOnly: false,
  // Disable all language features that require workers
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: 'off' as const,
  tabCompletion: 'off' as const,
  wordBasedSuggestions: 'off' as const,
  parameterHints: { enabled: false },
  codeLens: false,
  colorDecorators: false,
  lightbulb: { enabled: false },
  hover: { enabled: false },
  links: false,
  // Disable folding and other features
  folding: false,
  foldingHighlight: false,
  showFoldingControls: 'never' as const,
  // Disable semantic tokens
  'semanticHighlighting.enabled': false
}))

// URL parameters
const urlParams = new URLSearchParams(window.location.search)
const documentId = urlParams.get('documentId')
const initialTaskId = urlParams.get('taskId')

onMounted(async () => {
  await loadDocument()
  await loadTaskData(document.value?.taskId ?? initialTaskId)
})

onUnmounted(() => {
  // Vue Monaco Editor handles cleanup automatically
  if (layoutRaf) {
    cancelAnimationFrame(layoutRaf)
    layoutRaf = null
  }
})

function handleEditorMount(editorInstance: any) {
  editor = editorInstance

  try {
    if (monaco.languages) {
      // Completely disable TypeScript language service
      monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        allowNonTsExtensions: true
      })

      monaco.languages.typescript?.javascriptDefaults?.setCompilerOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        allowNonTsExtensions: true
      })

      // Disable other language services completely
      monaco.languages.css?.cssDefaults?.setOptions({
        validate: false,
        lint: { validProperties: [] }
      })
      monaco.languages.html?.htmlDefaults?.setOptions({
        validate: false,
        suggest: { html5: false, angular1: false, ionic: false }
      })
      monaco.languages.json?.jsonDefaults?.setDiagnosticsOptions({
        validate: false,
        enableSchemaRequest: false,
        allowComments: true,
        schemaValidation: 'ignore',
        schemaRequest: 'ignore'
      })
    }

  } catch (error) {
    console.warn('Failed to configure Monaco language services:', error)
  }

  // Set up drop zone for the editor
  const editorDomNode = editor.getDomNode()
  if (editorDomNode) {
    editorDomNode.addEventListener('dragover', handleDragOver)
    editorDomNode.addEventListener('drop', handleDrop)
    editorDomNode.addEventListener('dragleave', handleDragLeave)
  }

  scheduleEditorLayout()
}

function handleContentChange() {
  // Auto-save after changes (debounced)
  debouncedSave()
}

function scheduleEditorLayout() {
  if (!editor) return
  if (layoutRaf) {
    cancelAnimationFrame(layoutRaf)
  }
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = null
    if (editor) {
      editor.layout()
    }
  })
}

watch(showSidebar, (newValue) => {
  if (newValue) {
    nextTick(() => {
      scheduleEditorLayout()
    })
  }
})

function isSuccessResponse(response: any): response is { type: 'SUCCESS'; data: any } {
  return response && response.type === 'SUCCESS'
}

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

      // Load active version content
      if (document.value?.activeVersionId) {
        const activeVersion = versions.value.find(v => v.id === document.value?.activeVersionId)
        if (activeVersion) {
          editorContent.value = activeVersion.content
        }
      } else {
        editorContent.value = response.data.versions?.[0]?.content || ''
      }
    }
  } catch (error) {
    console.error('Failed to load document:', error)
  } finally {
    documentLoaded.value = true
  }
}

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

    // Load task pages
    const pagesResponse = await chrome.runtime.sendMessage({
      type: 'GET_TASK_PAGES',
      data: { taskId: targetTaskId }
    })

    if (isSuccessResponse(pagesResponse)) {
      taskPages.value = pagesResponse.data || []
    }

    // Load task notes
    const notesResponse = await chrome.runtime.sendMessage({
      type: 'GET_TASK_NOTES',
      data: { taskId: targetTaskId }
    })

    if (isSuccessResponse(notesResponse)) {
      taskNotes.value = notesResponse.data || []
    }
  } catch (error) {
    console.error('Failed to load task data:', error)
  }
}

function closeSidebar() {
  showSidebar.value = false
}

async function openSidebar() {
  if (showSidebar.value) {
    return
  }

  showSidebar.value = true
  await nextTick()

  // Always reload task data when reopening sidebar to ensure fresh data
  const targetTaskId = document.value?.taskId ?? initialTaskId
  if (targetTaskId) {
    try {
      await loadTaskData(targetTaskId)
    } catch (error) {
      console.error('Failed to load task data when reopening sidebar:', error)
    }
  }

  scheduleEditorLayout()
}

async function saveDocument() {
  if (!document.value || saving.value) return

  saving.value = true
  try {
    const content = editorContent.value

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_DOCUMENT_VERSION',
      data: {
        documentId: document.value.id,
        content,
        createdBy: 'user'
      }
    })

    if (isSuccessResponse(response)) {
      // Refresh versions
      await loadDocument()
      await loadTaskData(document.value?.taskId ?? initialTaskId)
    }
  } catch (error) {
    console.error('Failed to save document:', error)
  } finally {
    saving.value = false
  }
}

function exportDocument() {
  if (!document.value) return

  const content = editorContent.value
  const title = documentTitle.value
  const taskName = task.value?.name

  // Create filename with task and document info
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `${taskName ? `[${taskName}] ` : ''}${title}_${timestamp}.md`

  // Create markdown content with metadata header
  const exportContent = `# ${title}

${taskName ? `**Task:** ${taskName}\n` : ''}**Exported:** ${new Date().toLocaleString()}
${document.value.activeVersionId ? `**Version:** ${document.value.activeVersionId}\n` : ''}
---

${content}`

  // Create and download the file
  const blob = new Blob([exportContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)

  // Clean up the URL object
  URL.revokeObjectURL(url)
}

let saveTimeout: number | null = null
function debouncedSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = window.setTimeout(() => {
    saveDocument()
  }, 2000) // Auto-save after 2 seconds of inactivity
}

async function loadVersion(version: DocumentVersionEntry) {
  editorContent.value = version.content

  // Update active version
  if (document.value) {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_DOCUMENT',
        data: {
          documentId: document.value.id,
          updates: { activeVersionId: version.id }
        }
      })

      document.value.activeVersionId = version.id
    } catch (error) {
      console.error('Failed to update active version:', error)
    }
  }
}

function startDrag(item: PageEntry | NoteEntry, type: 'page' | 'note', event: DragEvent) {
  if (!event.dataTransfer) return

  // Store drag data for drop handling
  const dragData = {
    type,
    item
  }

  // Store data in dataTransfer for drop handling
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.effectAllowed = 'copy'
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  isDragOver.value = true
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false

  if (!editor || !event.dataTransfer) return

  try {
    const data = event.dataTransfer.getData('application/json')
    if (!data) return

    const dragData = JSON.parse(data)
    insertCitation(dragData)
  } catch (error) {
    console.error('Failed to handle drop:', error)
  }
}

function handleDragLeave(event: DragEvent) {
  // Only reset if we're leaving the editor container entirely
  if (!event.currentTarget || !event.relatedTarget) {
    isDragOver.value = false
    return
  }

  const target = event.currentTarget as HTMLElement
  const related = event.relatedTarget as HTMLElement
  if (!target.contains(related)) {
    isDragOver.value = false
  }
}

function insertCitation(dragData: { type: 'page' | 'note', item: PageEntry | NoteEntry }) {
  if (!editor) return

  const position = editor.getPosition()
  if (!position) return

  let citation = ''

  if (dragData.type === 'page') {
    const page = dragData.item as PageEntry
    // Create a markdown link citation
    citation = `[${page.title}](${page.url})`

    // If there's a shortcut, include it in the citation
    if (page.shortcut) {
      citation += ` [@${page.shortcut}]`
    }
  } else if (dragData.type === 'note') {
    const note = dragData.item as NoteEntry
    // Create a note citation with preview
    const preview = note.content.slice(0, 100).replace(/\n/g, ' ')
    citation = `> ${preview}${note.content.length > 100 ? '...' : ''}\n> \n> *— Note from ${note.category}*`

    // Add task context if available
    if (note.tasks && note.tasks.length > 0) {
      citation += ` (${note.tasks.join(', ')})`
    }
  }

  if (citation) {
    // Insert the citation at the current cursor position
    if (editor) {
      const position = editor.getPosition()
      if (position) {
        const model = editor.getModel()
        if (model) {
          const range = {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }

          // Add some spacing if not at beginning of line
          const lineContent = model.getLineContent(position.lineNumber)
          const prefix = lineContent.slice(0, position.column - 1)
          const needsNewline = prefix.trim().length > 0
          const fullCitation = needsNewline ? `\n\n${citation}\n\n` : `${citation}\n\n`

          model.pushEditOperations([], [{
            range,
            text: fullCitation
          }], () => null)

          // Move cursor to end of inserted text
          const lines = fullCitation.split('\n')
          const newPosition = {
            lineNumber: position.lineNumber + lines.length - 1,
            column: lines[lines.length - 1].length + 1
          }
          editor.setPosition(newPosition)
        }
      }
    } else {
      // Fallback: append to end of content
      const currentContent = editorContent.value
      const needsNewline = currentContent.trim().length > 0
      const fullCitation = needsNewline ? `\n\n${citation}\n\n` : `${citation}\n\n`
      editorContent.value += fullCitation
    }
  }
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

// Title editing functions
function startEditTitle() {
  if (!document.value) return

  isEditingTitle.value = true
  editTitleValue.value = document.value.title || ''

  nextTick(() => {
    if (titleInputRef.value) {
      titleInputRef.value.focus()
      titleInputRef.value.select()
    }
  })
}

function cancelEditTitle() {
  isEditingTitle.value = false
  editTitleValue.value = ''
}

async function saveTitle() {
  if (!document.value || !editTitleValue.value.trim()) {
    cancelEditTitle()
    return
  }

  const newTitle = editTitleValue.value.trim()

  // Don't save if title hasn't changed
  if (newTitle === document.value.title) {
    cancelEditTitle()
    return
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_DOCUMENT',
      data: {
        documentId: document.value.id,
        updates: { title: newTitle }
      }
    })

    if (isSuccessResponse(response)) {
      // Update local document state
      document.value.title = newTitle
    } else {
      console.error('Failed to update document title:', response)
    }
  } catch (error) {
    console.error('Failed to update document title:', error)
  }

  isEditingTitle.value = false
  editTitleValue.value = ''
}
</script>

<style scoped>
.authoring-workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

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
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
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

.edit-title-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
  flex-shrink: 0;
}

.edit-title-btn:hover {
  background-color: #e2e8f0;
  opacity: 1;
}

.loading-text {
  font-size: 16px;
  color: #718096;
  font-style: italic;
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
.versions-btn {
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
.versions-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.workspace-sidebar {
  width: 320px;
  background: #f7fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.close-sidebar {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #718096;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-sidebar:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.sidebar-section {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.reference-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.reference-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s;
}

.reference-item:hover {
  border-color: #cbd5e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.reference-item:active {
  cursor: grabbing;
}

.favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.reference-content {
  flex: 1;
  min-width: 0;
}

.reference-title {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference-url,
.reference-meta {
  font-size: 11px;
  color: #718096;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-container {
  flex: 1;
  min-width: 0;
  position: relative;
}

.editor-container.drag-over::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(59, 130, 246, 0.1);
  border: 2px dashed #3b82f6;
  border-radius: 8px;
  pointer-events: none;
  z-index: 10;
}

.monaco-editor-wrapper {
  height: 100%;
}

.version-panel {
  width: 300px;
  background: #f7fafc;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.close-panel {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #718096;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-panel:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.version-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.version-item {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.version-item:hover {
  border-color: #cbd5e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.version-item.active {
  border-color: #3182ce;
  background: #ebf8ff;
}

.version-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.version-date {
  font-size: 12px;
  color: #4a5568;
  font-weight: 500;
}

.version-author {
  font-size: 11px;
  color: #718096;
}

.version-summary {
  font-size: 12px;
  color: #2d3748;
  line-height: 1.4;
}

.sidebar-toggle {
  position: fixed;
  left: 16px;
  bottom: 20px;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 24px;
  background: #3182ce;
  color: white;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
  transition: all 0.2s;
  z-index: 100;
}

.sidebar-toggle:hover {
  background: #2c5aa0;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(49, 130, 206, 0.4);
}
</style>
