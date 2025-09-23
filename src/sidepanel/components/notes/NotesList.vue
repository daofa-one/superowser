<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NoteEntry } from '../../../shared/models'
import NoteItem from './NoteItem.vue'
import NoteContextMenu from './NoteContextMenu.vue'

interface Props {
  notes: NoteEntry[]
  showPageAssociation?: boolean
  showTaskAssociation?: boolean
  allowEdit?: boolean
  allowDelete?: boolean
  contextMenuActions?: ('edit' | 'removeFromPage' | 'removeFromTask' | 'delete')[]
}

interface Emits {
  (e: 'note-updated'): void
  (e: 'note-deleted'): void
  (e: 'note-edited', noteId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  showPageAssociation: true,
  showTaskAssociation: true,
  allowEdit: true,
  allowDelete: true,
  contextMenuActions: () => ['edit', 'removeFromPage', 'removeFromTask', 'delete']
})

const emit = defineEmits<Emits>()

// Context menu state
const showNoteMenu = ref(false)
const selectedNoteId = ref<string | null>(null)
const selectedNote = ref<NoteEntry | null>(null)
const noteMenuPosition = ref({ x: 0, y: 0 })

// Edit state
const editingNoteId = ref<string | null>(null)

const formatDateTime = (value?: Date | string) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

const showNoteContextMenu = (event: MouseEvent, noteId: string) => {
  event.preventDefault()
  event.stopPropagation()

  // Find the full note object
  const note = props.notes.find(n => n.id === noteId)
  if (!note) return

  selectedNoteId.value = noteId
  selectedNote.value = note

  // Position relative to the viewport
  const x = Math.min(event.clientX, window.innerWidth - 180) // Prevent overflow
  const y = Math.min(event.clientY, window.innerHeight - 100) // Prevent overflow

  noteMenuPosition.value = { x, y }
  showNoteMenu.value = true
}

const hideNoteMenu = () => {
  showNoteMenu.value = false
  selectedNoteId.value = null
  selectedNote.value = null
}

const startEditingNote = (noteId: string) => {
  editingNoteId.value = noteId
  hideNoteMenu()
  emit('note-edited', noteId)
}

const stopEditingNote = () => {
  editingNoteId.value = null
}

const handleNoteUpdate = () => {
  emit('note-updated')
  stopEditingNote()
}

const handleNoteDelete = () => {
  emit('note-deleted')
  hideNoteMenu()
}

// Handle context menu actions
const handleContextMenuAction = (action: string) => {
  if (!selectedNote.value) return

  switch (action) {
    case 'edit':
      startEditingNote(selectedNote.value.id)
      break
    case 'removeFromPage':
    case 'removeFromTask':
    case 'delete':
      // These will be handled by the context menu component
      break
  }
}

// Click outside to hide menu
const handleDocumentClick = () => {
  hideNoteMenu()
}

// Lifecycle
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="notes-list-container">
    <!-- Notes Header -->
    <div v-if="notes.length > 0" class="notes-header">
      <h4>Saved Notes</h4>
      <span class="notes-count">{{ notes.length }}</span>
    </div>

    <!-- Notes List -->
    <ul v-if="notes.length > 0" class="notes-list">
      <NoteItem
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :is-editing="editingNoteId === note.id"
        :show-page-association="showPageAssociation"
        :show-task-association="showTaskAssociation"
        :allow-edit="allowEdit"
        @contextmenu="showNoteContextMenu($event, note.id)"
        @click="hideNoteMenu"
        @edit-complete="handleNoteUpdate"
        @edit-cancel="stopEditingNote"
      />
    </ul>

    <!-- Empty State -->
    <div v-else class="notes-empty">
      <div class="empty-icon">📝</div>
      <div class="empty-message">No notes yet</div>
    </div>

    <!-- Context Menu -->
    <NoteContextMenu
      v-if="showNoteMenu && selectedNote"
      :note="selectedNote"
      :position="noteMenuPosition"
      :available-actions="contextMenuActions"
      :allow-delete="allowDelete"
      @action="handleContextMenuAction"
      @update="handleNoteUpdate"
      @delete="handleNoteDelete"
      @close="hideNoteMenu"
    />
  </div>
</template>

<style scoped>
.notes-list-container {
  margin-top: 16px;
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  border-bottom: none;
}

.notes-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.notes-count {
  font-size: 12px;
  color: #666;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 2px 8px;
}

.notes-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.notes-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
}
</style>