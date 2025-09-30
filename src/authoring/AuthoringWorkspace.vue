<template>
  <div class="authoring-workspace">
    <!-- Header -->
    <WorkspaceHeader
      :document="document"
      :documentLoaded="documentLoaded"
      :documentTitle="documentTitle"
      :task="task"
      :saving="saving"
      :showPreview="showPreview"
      @togglePreview="handleTogglePreview"
      @exportDocument="exportDocument"
      @saveDocument="handleSaveDocument"
      @toggleVersions="showVersions = !showVersions"
      @updateTitle="handleUpdateTitle"
    />

    <!-- Main content area -->
    <div class="workspace-main">
      <!-- Sidebar -->
      <aside v-if="showSidebar" class="workspace-sidebar">
        <div class="sidebar-header">
          <h3>References</h3>
          <button class="close-sidebar" @click="closeSidebar">×</button>
        </div>

        <!-- Document outline -->
        <CollapsibleSection
          title="Document Outline"
          icon="outline"
          :count="outlineHeadings.length"
          section-id="outline"
          :default-expanded="true"
        >
          <DocumentOutline
            :headings="outlineHeadings"
            :activeHeading="activeHeading"
            @headingClick="handleHeadingClick"
          />
        </CollapsibleSection>

        <!-- Task pages -->
        <CollapsibleSection
          v-if="task"
          title="Task Pages"
          icon="pages"
          :count="taskPages.length"
          section-id="pages"
          :default-expanded="true"
        >
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
        </CollapsibleSection>

        <!-- Task notes -->
        <CollapsibleSection
          v-if="task"
          title="Task Notes"
          icon="notes"
          :count="taskNotes.length"
          section-id="notes"
          :default-expanded="false"
        >
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
        </CollapsibleSection>
      </aside>

      <!-- Editor area -->
      <main class="editor-container" :class="{ 'drag-over': isDragOver }">
        <div class="editor-pane" :style="editorPaneStyle">
          <!-- Formatting toolbar -->
          <FormattingToolbar @formatText="handleFormatText" />

          <VueMonacoEditor
            ref="editorRef"
            v-model:value="documentContent"
            :options="editorOptions"
            :language="'markdown'"
            :theme="'vs'"
            class="monaco-editor-wrapper"
            @mount="handleEditorMount"
            @change="handleContentChange"
          />
        </div>

        <!-- Preview pane -->
        <MarkdownPreview
          v-if="showPreview"
          v-model:previewContentRef="previewContentRef"
          :renderedContent="renderedContent"
          :previewPaneStyle="previewPaneStyle"
          @close="handleTogglePreview"
          @scroll="handlePreviewScroll"
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
import type { PageEntry, NoteEntry } from '../shared/models'

// Declare chrome global for TypeScript (if not already declared)
declare global {
  interface Window {
    chrome: any
  }
}

// Components
import WorkspaceHeader from './components/WorkspaceHeader.vue'
import FormattingToolbar from './components/FormattingToolbar.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import DocumentOutline from './components/DocumentOutline.vue'
import CollapsibleSection from './components/CollapsibleSection.vue'

// Composables
import { useDocumentState } from './composables/useDocumentState'
import { usePreview } from './composables/usePreview'
import { useFormatting } from './composables/useFormatting'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'
import { useDocumentOutline } from './composables/useDocumentOutline'
import { useMonacoCommands } from './composables/useMonacoCommands'

// Use composables
const {
  document,
  documentLoaded,
  task,
  versions,
  saving,
  documentContent,
  documentTitle,
  loadDocument,
  loadTaskData,
  saveDocument: saveDocumentVersion,
  updateDocument,
  loadVersion: loadVersionComposable
} = useDocumentState()

const {
  showPreview,
  previewContentRef,
  renderedContent,
  editorPaneStyle,
  previewPaneStyle,
  togglePreview,
  updatePreview,
  debouncedPreviewUpdate,
  handlePreviewScroll
} = usePreview()

const {
  headings: outlineHeadings,
  activeHeading,
  updateHeadingsFromContent,
  scrollToHeading,
  initializeOutline
} = useDocumentOutline()

// Local state
const taskPages = ref<PageEntry[]>([])
const taskNotes = ref<NoteEntry[]>([])
const showSidebar = ref(true)
const showVersions = ref(false)
const isDragOver = ref(false)

// Monaco editor
const editorRef = ref()
let editor: any = null
let layoutRaf: number | null = null

// Initialize formatting, keyboard shortcuts, and commands once editor is mounted
let formatText: (format: string) => void
let setupKeyboardShortcuts: () => void
let registerCustomCommands: () => void

const editorOptions = computed(() => ({
  wordWrap: 'on' as const,
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  readOnly: false,
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
  folding: false,
  foldingHighlight: false,
  showFoldingControls: 'never' as const,
  'semanticHighlighting.enabled': false
}))

onMounted(async () => {
  await loadDocument()
  await loadTaskData(document.value?.taskId)
  await loadTaskPages()
  await loadTaskNotes()

  // Initialize outline from loaded content
  nextTick(() => {
    updateHeadingsFromContent(documentContent.value)
  })
})

onUnmounted(() => {
  if (layoutRaf) {
    cancelAnimationFrame(layoutRaf)
    layoutRaf = null
  }
})

function handleEditorMount(editorInstance: any) {
  editor = editorInstance

  // Initialize composable functions now that editor is available
  const formatting = useFormatting(editor)
  formatText = formatting.formatText

  const keyboardShortcuts = useKeyboardShortcuts(editor, formatText, togglePreview)
  setupKeyboardShortcuts = keyboardShortcuts.setupKeyboardShortcuts

  const monacoCommands = useMonacoCommands(
    editor,
    formatText,
    togglePreview,
    handleSaveDocument,
    exportDocument,
    handleToggleOutline,
    scheduleEditorLayout
  )
  registerCustomCommands = monacoCommands.registerCustomCommands

  try {
    if (monaco.languages) {
      // Disable language services for performance
      monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        allowNonTsExtensions: true
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

  // Set up keyboard shortcuts for formatting
  setupKeyboardShortcuts()

  // Register custom commands for command palette
  registerCustomCommands()

  scheduleEditorLayout()
}

function handleContentChange() {
  // Auto-save after changes (debounced)
  debouncedSave()
  // Update preview (debounced)
  debouncedPreviewUpdate(documentContent.value)
  // Update outline from content
  updateHeadingsFromContent(documentContent.value)
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

// Component event handlers
function handleTogglePreview() {
  const isNowShowing = togglePreview()
  if (isNowShowing) {
    updatePreview(documentContent.value)
  }
  nextTick(() => {
    scheduleEditorLayout()
  })
}

function handleFormatText(format: string) {
  if (formatText) {
    formatText(format)
  }
}

async function handleSaveDocument() {
  await saveDocumentVersion(documentContent.value)
}

async function handleUpdateTitle(newTitle: string) {
  await updateDocument({ title: newTitle })
}

function handleHeadingClick(headingId: string) {
  if (showPreview.value) {
    // Scroll to heading in preview if preview is open
    scrollToHeading(headingId)
  } else {
    // Could potentially scroll to heading in editor here
    // For now, just opening preview would be sufficient
    console.log('Navigate to heading:', headingId)
  }
}

// Sidebar functions
function closeSidebar() {
  showSidebar.value = false
}

async function openSidebar() {
  if (showSidebar.value) return

  showSidebar.value = true
  await nextTick()

  const targetTaskId = document.value?.taskId
  if (targetTaskId) {
    try {
      await loadTaskData(targetTaskId)
      await loadTaskPages()
      await loadTaskNotes()
    } catch (error) {
      console.error('Failed to load task data when reopening sidebar:', error)
    }
  }

  scheduleEditorLayout()
}

// Task data loading
async function loadTaskPages() {
  if (!task.value?.id) return

  try {
    const response = await window.chrome.runtime.sendMessage({
      type: 'GET_TASK_PAGES',
      data: { taskId: task.value.id }
    })

    if (response?.type === 'SUCCESS') {
      taskPages.value = response.data || []
    }
  } catch (error) {
    console.error('Failed to load task pages:', error)
  }
}

async function loadTaskNotes() {
  if (!task.value?.id) return

  try {
    const response = await window.chrome.runtime.sendMessage({
      type: 'GET_TASK_NOTES',
      data: { taskId: task.value.id }
    })

    if (response?.type === 'SUCCESS') {
      taskNotes.value = response.data || []
    }
  } catch (error) {
    console.error('Failed to load task notes:', error)
  }
}

// Version handling
async function loadVersion(version: any) {
  const content = await loadVersionComposable(version)
  if (content) {
    documentContent.value = content
  }
}

// Auto-save
let saveTimeout: number | null = null
function debouncedSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = window.setTimeout(() => {
    handleSaveDocument()
  }, 2000)
}

// Export functionality
function exportDocument() {
  if (!document.value) return

  const content = documentContent.value
  const title = documentTitle.value
  const taskName = task.value?.name

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `${taskName ? `[${taskName}] ` : ''}${title}_${timestamp}.md`

  const exportContent = `# ${title}

${taskName ? `**Task:** ${taskName}\n` : ''}**Exported:** ${new Date().toLocaleString()}
${document.value.activeVersionId ? `**Version:** ${document.value.activeVersionId}\n` : ''}
---

${content}`

  const blob = new Blob([exportContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// Drag and drop functionality
function startDrag(item: PageEntry | NoteEntry, type: 'page' | 'note', event: DragEvent) {
  if (!event.dataTransfer) return

  const dragData = { type, item }
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
    citation = `[${page.title}](${page.url})`
    if (page.shortcut) {
      citation += ` [@${page.shortcut}]`
    }
  } else if (dragData.type === 'note') {
    const note = dragData.item as NoteEntry
    const preview = note.content.slice(0, 100).replace(/\n/g, ' ')
    citation = `> ${preview}${note.content.length > 100 ? '...' : ''}\n> \n> *— Note from ${note.category}*`

    if (note.tasks && note.tasks.length > 0) {
      citation += ` (${note.tasks.join(', ')})`
    }
  }

  if (citation) {
    const model = editor.getModel()
    if (model) {
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }

      const lineContent = model.getLineContent(position.lineNumber)
      const prefix = lineContent.slice(0, position.column - 1)
      const needsNewline = prefix.trim().length > 0
      const fullCitation = needsNewline ? `\n\n${citation}\n\n` : `${citation}\n\n`

      model.pushEditOperations([], [{
        range,
        text: fullCitation
      }], () => null)

      const lines = fullCitation.split('\n')
      const newPosition = {
        lineNumber: position.lineNumber + lines.length - 1,
        column: lines[lines.length - 1].length + 1
      }
      editor.setPosition(newPosition)
    }
  }
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}


function handleToggleOutline() {
  // Toggle the outline section
  const outlineSection = window.document.querySelector('[section-id="outline"]')
  if (outlineSection) {
    const button = outlineSection.querySelector('button')
    if (button) {
      button.click()
    }
  }
}

// Watchers for layout updates
watch(showSidebar, () => {
  nextTick(() => {
    scheduleEditorLayout()
  })
})

watch(showPreview, () => {
  nextTick(() => {
    scheduleEditorLayout()
  })
})

// Watch for editor content changes to update preview and outline
watch(documentContent, () => {
  if (showPreview.value) {
    debouncedPreviewUpdate(documentContent.value)
  }
  updateHeadingsFromContent(documentContent.value)
})

// Initialize outline for scroll functionality when preview is available
watch(previewContentRef, (newRef) => {
  if (newRef && showPreview.value) {
    nextTick(() => {
      initializeOutline(newRef)
    })
  }
})
</script>

<style scoped>
.authoring-workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.workspace-sidebar {
  width: 340px;
  background: #f7fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}

.workspace-sidebar > * + * {
  margin-top: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  margin-bottom: 0;
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
  display: flex;
  overflow: hidden;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: width 0.3s ease;
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