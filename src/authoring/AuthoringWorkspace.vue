<template>
  <div class="authoring-workspace">
    <!-- Header -->
    <header class="workspace-header">
      <div class="header-left">
        <template v-if="documentLoaded">
          <h1 class="document-title">{{ documentTitle }}</h1>
        </template>
        <span class="loading-text" v-else>Loading...</span>
        <span class="task-badge" v-if="task">[{{ task.name }}]</span>
      </div>
      <div class="header-right">
        <button class="export-btn" @click="exportDocument" :disabled="!documentLoaded || !document" title="Export document">
          Export
        </button>
        <button class="save-btn" @click="saveDocument" :disabled="saving || !documentLoaded || !document">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button class="versions-btn" @click="showVersions = !showVersions" :disabled="!documentLoaded || !document">
          Versions
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <div class="workspace-main">
      <!-- Sidebar -->
      <aside class="workspace-sidebar" v-if="showSidebar">
        <div class="sidebar-header">
          <h3>References</h3>
          <button @click="closeSidebar" class="close-sidebar">×</button>
        </div>

        <!-- Task pages -->
        <section class="sidebar-section" v-if="task">
          <h4>Task Pages</h4>
          <div class="reference-list">
            <div
              v-for="page in taskPages"
              :key="page.id"
              class="reference-item"
              draggable="true"
              @dragstart="startDrag(page, 'page', $event)"
            >
              <img :src="page.favicon" v-if="page.favicon" class="favicon" />
              <div class="reference-content">
                <div class="reference-title">{{ page.title }}</div>
                <div class="reference-url">{{ page.url }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Task notes -->
        <section class="sidebar-section" v-if="task">
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
          @mount="handleEditorMount"
          @change="handleContentChange"
          class="monaco-editor-wrapper"
        />
      </main>

      <!-- Version panel -->
      <aside class="version-panel" v-if="showVersions">
        <div class="panel-header">
          <h3>Version History</h3>
          <button @click="showVersions = false" class="close-panel">×</button>
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
            <div class="version-summary" v-if="version.summary">{{ version.summary }}</div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Floating sidebar toggle -->
    <button class="sidebar-toggle" @click="openSidebar" v-if="!showSidebar">
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
</script>
