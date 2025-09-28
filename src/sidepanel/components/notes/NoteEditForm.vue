<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { NoteEntry, NoteCategory } from '../../../shared/models'
import { useSidePanelStore } from '../../stores/sidepanel-store'

interface Props {
  note: NoteEntry
}

interface Emits {
  (e: 'save'): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useSidePanelStore()

const NOTE_CATEGORY_OPTIONS: Array<{ value: NoteCategory; label: string }> = [
  { value: 'note', label: 'General note' },
  { value: 'plan', label: 'Plan / blueprint' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'highlight', label: 'Highlight' }
]

// Form state
const editNoteContent = ref('')
const editNoteComment = ref('')
const editIncludePageAssociation = ref(true)
const editSelectedNoteTasks = ref<string[]>([])
const editNoteTaskInput = ref('')
const associatedPage = ref<{ id: string; title: string; url: string } | null>(null)
const editNoteCategory = ref<NoteCategory>('note')

// Task management
const availableTasks = ref<string[]>([])
const editFilteredTasks = ref<string[]>([])
const showEditTaskSuggestions = ref(false)

// Initialize form with note data
onMounted(async () => {
  editNoteContent.value = props.note.content
  editNoteComment.value = props.note.comment || ''
  editIncludePageAssociation.value = !!props.note.pageId
  editSelectedNoteTasks.value = [...(props.note.tasks || [])]
  editNoteCategory.value = (props.note.category ?? 'note') as NoteCategory

  // Load associated page if exists
  if (props.note.pageId) {
    await loadAssociatedPage(props.note.pageId)
  }

  // Load available tasks
  await loadAvailableTasks()
  filterEditTasks()
})

const loadAssociatedPage = async (pageId: string) => {
  try {
    const response = await store.sendMessage({
      type: 'GET_PAGE',
      data: { id: pageId }
    })
    if (response && response.type === 'SUCCESS' && response.data) {
      associatedPage.value = {
        id: response.data.id,
        title: response.data.title,
        url: response.data.url
      }
    }
  } catch (error) {
    console.warn('Failed to load associated page:', error)
  }
}

const loadAvailableTasks = async () => {
  try {
    const response = await store.sendMessage({ type: 'GET_TASKS' })
    if (response && response.type === 'SUCCESS' && response.data) {
      availableTasks.value = response.data.map((task: any) => task.name)
    }
  } catch (error) {
    console.error('Failed to load tasks:', error)
  }
}

const normalizeTaskName = (name: string) => name.trim()

const addEditNoteTask = (taskName: string) => {
  const normalized = normalizeTaskName(taskName)
  if (!normalized) return

  if (!editSelectedNoteTasks.value.includes(normalized)) {
    editSelectedNoteTasks.value.push(normalized)
  }
  editNoteTaskInput.value = ''
  showEditTaskSuggestions.value = false
}

const removeEditNoteTask = (taskName: string) => {
  editSelectedNoteTasks.value = editSelectedNoteTasks.value.filter(task => task !== taskName)
}

const resetEditNoteTasks = () => {
  // Use page tasks if available - this would need to be passed from parent
  editSelectedNoteTasks.value = []
  editNoteTaskInput.value = ''
}

const clearEditNoteTasks = () => {
  editSelectedNoteTasks.value = []
  editNoteTaskInput.value = ''
}

const filterEditTasks = () => {
  const query = editNoteTaskInput.value.toLowerCase()
  if (!query) {
    editFilteredTasks.value = availableTasks.value.filter(task => !editSelectedNoteTasks.value.includes(task))
  } else {
    editFilteredTasks.value = availableTasks.value.filter(task =>
      task.toLowerCase().includes(query) && !editSelectedNoteTasks.value.includes(task)
    )
  }
  showEditTaskSuggestions.value = (editFilteredTasks.value.length > 0 || editNoteTaskInput.value.length > 0) && editNoteTaskInput.value.length > 0
}

const onEditTaskInputChange = () => {
  filterEditTasks()
}

const onEditTaskInputFocus = () => {
  filterEditTasks()
  showEditTaskSuggestions.value = editFilteredTasks.value.length > 0
}

const onEditTaskInputBlur = () => {
  setTimeout(() => {
    showEditTaskSuggestions.value = false
  }, 200)
}

const selectEditTask = (taskName: string) => {
  addEditNoteTask(taskName)
}

const saveEditedNote = async () => {
  const content = editNoteContent.value.trim()
  if (!content) {
    store.addNotification({
      type: 'error',
      message: 'Note content cannot be empty'
    })
    return
  }

  try {
    const updates: any = { content }

    // Handle comment
    const comment = editNoteComment.value.trim()
    if (comment) {
      updates.comment = comment
    } else {
      updates.comment = null
    }

    // Handle page association
    if (editIncludePageAssociation.value) {
      // Keep existing pageId or set to current page
      updates.pageId = props.note.pageId
    } else {
      updates.pageId = null
    }

    // Handle task associations
    updates.tasks = editSelectedNoteTasks.value

    updates.category = editNoteCategory.value

    const response = await store.sendMessage({
      type: 'UPDATE_NOTE',
      data: {
        id: props.note.id,
        ...updates
      }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: 'Note updated successfully'
      })
      emit('save')
    } else {
      throw new Error('Failed to update note')
    }
  } catch (error) {
    console.error('Failed to update note:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to update note'
    })
  }
}

const cancelEdit = () => {
  emit('cancel')
}
</script>

<template>
  <div class="note-edit-form">
    <div class="edit-form-group">
      <label for="edit-note-content">Note Content *</label>
      <textarea
        id="edit-note-content"
        v-model="editNoteContent"
        rows="4"
        placeholder="Edit note content"
        class="edit-note-textarea"
        @keyup.escape="cancelEdit"
      ></textarea>
    </div>

    <div class="edit-form-group">
      <label for="edit-note-comment">Comment (optional)</label>
      <input
        id="edit-note-comment"
        v-model="editNoteComment"
        type="text"
        placeholder="Edit comment"
        class="edit-note-comment-input"
        @keyup.escape="cancelEdit"
      />
    </div>

    <div class="edit-form-group">
      <label for="edit-note-category">Note type</label>
      <select
        id="edit-note-category"
        v-model="editNoteCategory"
        class="edit-note-category-select"
      >
        <option v-for="option in NOTE_CATEGORY_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="edit-form-group association-group">
      <label>Link to page</label>
      <div class="association-row">
        <label class="association-toggle">
          <input
            v-model="editIncludePageAssociation"
            type="checkbox"
          />
          <span v-if="associatedPage">Keep page association</span>
          <span v-else>Include current page</span>
        </label>
        <span v-if="editIncludePageAssociation && associatedPage" class="association-chip page-chip">
          <div class="page-info">
            <div class="page-title">{{ associatedPage.title }}</div>
            <div class="page-url">{{ associatedPage.url }}</div>
          </div>
          <button type="button" @click="editIncludePageAssociation = false">×</button>
        </span>
        <span v-else-if="editIncludePageAssociation && !associatedPage" class="association-chip">
          Current page
          <button type="button" @click="editIncludePageAssociation = false">×</button>
        </span>
        <span v-else class="association-hint">Note will not be linked to any page.</span>
      </div>
    </div>

    <div class="edit-form-group association-group">
      <label>Link to tasks</label>
      <div class="association-row">
        <div v-if="editSelectedNoteTasks.length" class="association-chips">
          <span v-for="task in editSelectedNoteTasks" :key="task" class="association-chip">
            &{{ task }}
            <button type="button" @click="removeEditNoteTask(task)">×</button>
          </span>
        </div>
        <span v-else class="association-hint">No tasks linked</span>
      </div>
      <div class="task-chip-actions">
        <button type="button" class="btn btn-secondary btn-small" @click="resetEditNoteTasks">
          Use page tasks
        </button>
        <button type="button" class="btn btn-secondary btn-small" @click="clearEditNoteTasks">
          Clear tasks
        </button>
        <div class="task-input-wrapper">
          <input
            v-model="editNoteTaskInput"
            type="text"
            placeholder="Type to search tasks or create new"
            class="note-task-input"
            autocomplete="off"
            @input="onEditTaskInputChange"
            @focus="onEditTaskInputFocus"
            @blur="onEditTaskInputBlur"
            @keyup.enter.prevent="editNoteTaskInput && addEditNoteTask(editNoteTaskInput)"
          />

          <!-- Task Suggestions Dropdown -->
          <div v-if="showEditTaskSuggestions" class="task-suggestions">
            <div
              v-for="task in editFilteredTasks"
              :key="task"
              class="task-suggestion-item"
              @mousedown="selectEditTask(task)"
            >
              📁 {{ task }}
            </div>
            <div
              v-if="editNoteTaskInput && !editFilteredTasks.includes(editNoteTaskInput) && !editSelectedNoteTasks.includes(editNoteTaskInput)"
              class="task-suggestion-item create-new"
              @mousedown="selectEditTask(editNoteTaskInput)"
            >
              ➕ Create new task: "{{ editNoteTaskInput }}"
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="edit-form-actions">
      <button class="btn btn-primary btn-small" :disabled="!editNoteContent.trim()" @click="saveEditedNote">
        Save
      </button>
      <button class="btn btn-secondary btn-small" @click="cancelEdit">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.note-edit-form {
  padding: 8px;
  width: 100%;
}

.edit-form-group {
  margin-bottom: 12px;
}

.edit-form-group:last-child {
  margin-bottom: 0;
}

.edit-form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #555;
  margin-bottom: 4px;
}

.edit-note-textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.edit-note-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.edit-note-comment-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.edit-note-comment-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.edit-note-category-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  background: #fff;
  transition: border-color 0.2s;
}

.edit-note-category-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.association-group {
  margin-top: 16px;
}

.association-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.association-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #1f2937;
}

.association-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e0f2fe;
  color: #0c4a6e;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}

.association-chip.page-chip {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  max-width: 280px;
}

.page-info {
  flex: 1;
  min-width: 0;
}

.page-title {
  font-weight: 500;
  font-size: 12px;
  color: #0c4a6e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-url {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.association-chip button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}

.association-hint {
  font-size: 12px;
  color: #64748b;
}

.association-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.task-chip-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.task-chip-actions .task-input-wrapper {
  flex: 1;
  min-width: 100%;
  margin-top: 8px;
  position: relative;
}

.note-task-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.note-task-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.task-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
}

.task-suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.task-suggestion-item:hover {
  background-color: #f5f5f5;
}

.task-suggestion-item:last-child {
  border-bottom: none;
}

.task-suggestion-item.create-new {
  background-color: #e8f5e8;
  color: #2e7d32;
  font-style: italic;
}

.task-suggestion-item.create-new:hover {
  background-color: #c8e6c9;
}

.edit-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  min-height: 28px;
}
</style>
