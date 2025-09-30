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

    // Note: Command palette shortcuts are now handled by Monaco commands
    // Users can access command palette with F1 or Ctrl+Shift+P (if Monaco has focus)
  }

  return {
    setupKeyboardShortcuts
  }
}