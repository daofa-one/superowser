import { ref } from 'vue'
import * as monaco from 'monaco-editor'

export function useFormatting(editor: any) {
  // Formatting functions
  function formatText(format: string) {
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model || !selection) return

    const selectedText = model.getValueInRange(selection)
    let formattedText = ''
    let cursorOffset = 0

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        cursorOffset = selectedText ? 0 : 1
        break
      case 'strikethrough':
        formattedText = `~~${selectedText}~~`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'h1':
        formattedText = `# ${selectedText}`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'h2':
        formattedText = `## ${selectedText}`
        cursorOffset = selectedText ? 0 : 3
        break
      case 'h3':
        formattedText = `### ${selectedText}`
        cursorOffset = selectedText ? 0 : 4
        break
      case 'ul':
        formattedText = `- ${selectedText}`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'ol':
        formattedText = `1. ${selectedText}`
        cursorOffset = selectedText ? 0 : 3
        break
      case 'checkbox':
        formattedText = `- [ ] ${selectedText}`
        cursorOffset = selectedText ? 0 : 6
        break
      case 'link':
        if (selectedText) {
          formattedText = `[${selectedText}](url)`
          cursorOffset = -4
        } else {
          formattedText = '[text](url)'
          cursorOffset = -9
        }
        break
      case 'code':
        if (selectedText.includes('\n')) {
          formattedText = `\`\`\`\n${selectedText}\n\`\`\``
          cursorOffset = selectedText ? 0 : 4
        } else {
          formattedText = `\`${selectedText}\``
          cursorOffset = selectedText ? 0 : 1
        }
        break
      case 'quote':
        formattedText = `> ${selectedText}`
        cursorOffset = selectedText ? 0 : 2
        break
      case 'mermaid':
        if (selectedText) {
          formattedText = `\`\`\`mermaid\n${selectedText}\n\`\`\``
          cursorOffset = 0
        } else {
          formattedText = `\`\`\`mermaid\nflowchart TD\n    A[Start] --> B[End]\n\`\`\``
          cursorOffset = -26 // Position cursor after "flowchart TD\n    "
        }
        break
      default:
        return
    }

    // Replace the selected text
    model.pushEditOperations([], [{
      range: selection,
      text: formattedText
    }], () => null)

    // Update cursor position
    if (cursorOffset !== 0) {
      const newPosition = {
        lineNumber: selection.endLineNumber,
        column: selection.endColumn + formattedText.length + cursorOffset
      }
      editor.setPosition(newPosition)
    }

    // Focus back to editor
    editor.focus()
  }

  return {
    formatText
  }
}