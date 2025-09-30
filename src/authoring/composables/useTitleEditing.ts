import { ref, nextTick } from 'vue'

export function useTitleEditing(updateDocument: (updates: any) => Promise<boolean>) {
  // State
  const isEditingTitle = ref(false)
  const editTitleValue = ref('')
  const titleInputRef = ref<HTMLInputElement>()

  // Functions
  function startEditTitle(currentTitle: string) {
    isEditingTitle.value = true
    editTitleValue.value = currentTitle || ''

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

  async function saveTitle(currentTitle: string) {
    if (!editTitleValue.value.trim()) {
      cancelEditTitle()
      return
    }

    const newTitle = editTitleValue.value.trim()

    // Don't save if title hasn't changed
    if (newTitle === currentTitle) {
      cancelEditTitle()
      return
    }

    try {
      const success = await updateDocument({ title: newTitle })

      if (success) {
        isEditingTitle.value = false
        editTitleValue.value = ''
        return newTitle
      } else {
        console.error('Failed to update document title')
      }
    } catch (error) {
      console.error('Failed to update document title:', error)
    }

    return null
  }

  return {
    // State
    isEditingTitle,
    editTitleValue,
    titleInputRef,

    // Methods
    startEditTitle,
    cancelEditTitle,
    saveTitle
  }
}