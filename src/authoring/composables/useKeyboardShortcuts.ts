import * as monaco from 'monaco-editor'

export function useKeyboardShortcuts(
  editor: any,
  formatText: (format: string) => void,
  togglePreview: () => void
) {
  function setupKeyboardShortcuts() {
    if (!editor) return

    // Ctrl+B for bold
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      formatText('bold')
    })

    // Ctrl+I for italic
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      formatText('italic')
    })

    // Ctrl+K for link
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      formatText('link')
    })

    // Ctrl+Shift+P for preview toggle
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      togglePreview()
    })
  }

  return {
    setupKeyboardShortcuts
  }
}