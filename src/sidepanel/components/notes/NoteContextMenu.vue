<script setup lang="ts">
import type { NoteEntry } from '../../../shared/models'
import { useSidePanelStore } from '../../stores/sidepanel-store'

interface Props {
  note: NoteEntry
  position: { x: number; y: number }
  availableActions: ('edit' | 'removeFromPage' | 'removeFromTask' | 'delete')[]
  allowDelete?: boolean
}

interface Emits {
  (e: 'action', action: string): void
  (e: 'update'): void
  (e: 'delete'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  allowDelete: true
})

const emit = defineEmits<Emits>()
const store = useSidePanelStore()

const handleEditClick = () => {
  emit('action', 'edit')
  emit('close')
}

const handleRemoveFromPage = async () => {
  try {
    const response = await store.sendMessage({
      type: 'UPDATE_NOTE',
      data: {
        id: props.note.id,
        pageId: null
      }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: 'Note removed from page'
      })
      emit('update')
    } else {
      throw new Error('Failed to remove note from page')
    }
  } catch (error) {
    console.error('Failed to remove note from page:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to remove note from page'
    })
  }
  emit('close')
}

const handleRemoveFromTask = async (taskName: string) => {
  try {
    const updatedTasks = props.note.tasks.filter(task => task !== taskName)

    const response = await store.sendMessage({
      type: 'UPDATE_NOTE',
      data: {
        id: props.note.id,
        tasks: updatedTasks
      }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: `Note removed from task "${taskName}"`
      })
      emit('update')
    } else {
      throw new Error('Failed to remove note from task')
    }
  } catch (error) {
    console.error('Failed to remove note from task:', error)
    store.addNotification({
      type: 'error',
      message: `Failed to remove note from task "${taskName}"`
    })
  }
  emit('close')
}

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
    emit('close')
    return
  }

  try {
    const response = await store.sendMessage({
      type: 'DELETE_NOTE',
      data: { id: props.note.id }
    })

    if (response?.type === 'SUCCESS') {
      store.addNotification({
        type: 'success',
        message: 'Note deleted'
      })
      emit('delete')
    } else {
      throw new Error('Failed to delete note')
    }
  } catch (error) {
    console.error('Failed to delete note:', error)
    store.addNotification({
      type: 'error',
      message: 'Failed to delete note'
    })
  }
  emit('close')
}

const shouldShowAction = (action: string) => {
  return props.availableActions.includes(action as any)
}

const shouldShowRemoveFromPage = () => {
  return shouldShowAction('removeFromPage') && props.note.pageId
}

const shouldShowRemoveFromTask = () => {
  return shouldShowAction('removeFromTask') && props.note.tasks && props.note.tasks.length > 0
}

const shouldShowSeparator = () => {
  return shouldShowAction('edit') || shouldShowRemoveFromPage() || shouldShowRemoveFromTask()
}
</script>

<template>
  <div
    class="note-context-menu"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @click.stop
  >
    <!-- Edit note option -->
    <button
      v-if="shouldShowAction('edit')"
      class="menu-item"
      @click="handleEditClick"
    >
      ✏️ Edit note
    </button>

    <!-- Separator -->
    <div
      v-if="shouldShowAction('edit') && (shouldShowRemoveFromPage() || shouldShowRemoveFromTask())"
      class="menu-separator"
    ></div>

    <!-- Remove from page option -->
    <button
      v-if="shouldShowRemoveFromPage()"
      class="menu-item"
      @click="handleRemoveFromPage"
    >
      🔗 Remove from page
    </button>

    <!-- Remove from task options -->
    <template v-if="shouldShowRemoveFromTask()">
      <button
        v-for="task in note.tasks"
        :key="task"
        class="menu-item"
        @click="handleRemoveFromTask(task)"
      >
        📁 Remove from &{{ task }}
      </button>
    </template>

    <!-- Separator -->
    <div
      v-if="shouldShowSeparator() && shouldShowAction('delete') && allowDelete"
      class="menu-separator"
    ></div>

    <!-- Delete note option -->
    <button
      v-if="shouldShowAction('delete') && allowDelete"
      class="menu-item menu-item-danger"
      @click="handleDelete"
    >
      🗑️ Delete note
    </button>
  </div>
</template>

<style scoped>
.note-context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: 9999;
  min-width: 160px;
  padding: 4px 0;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #333;
}

.menu-item:hover {
  background-color: #f5f5f5;
}

.menu-item-danger {
  color: #dc3545;
}

.menu-item-danger:hover {
  background-color: #fff5f5;
}

.menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
}
</style>