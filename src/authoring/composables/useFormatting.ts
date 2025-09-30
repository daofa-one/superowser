import * as monaco from 'monaco-editor'

export function useFormatting(editor: any) {
  // Formatting functions
  function formatText(format: string) {
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model || !selection) return

    const selectedText = model.getValueInRange(selection)
    const hasSelection = selectedText.length > 0
    const startOffset = model.getOffsetAt(selection.getStartPosition())

    let insertText = ''
    let selectionStartDelta = 0
    let selectionEndDelta = 0

    const applyWrapper = (prefix: string, suffix: string, placeholder = '') => {
      const inner = hasSelection ? selectedText : placeholder
      insertText = `${prefix}${inner}${suffix}`
      if (hasSelection || placeholder) {
        selectionStartDelta = prefix.length
        selectionEndDelta = prefix.length + inner.length
      } else {
        selectionStartDelta = prefix.length
        selectionEndDelta = prefix.length
      }
    }

    switch (format) {
      case 'bold':
        applyWrapper('**', '**')
        break
      case 'italic':
        applyWrapper('*', '*')
        break
      case 'strikethrough':
        applyWrapper('~~', '~~')
        break
      case 'h1': {
        const prefix = '# '
        insertText = `${prefix}${selectedText}`
        if (hasSelection) {
          selectionStartDelta = prefix.length
          selectionEndDelta = prefix.length + selectedText.length
        } else {
          insertText = prefix
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'h2': {
        const prefix = '## '
        insertText = `${prefix}${selectedText}`
        if (hasSelection) {
          selectionStartDelta = prefix.length
          selectionEndDelta = prefix.length + selectedText.length
        } else {
          insertText = prefix
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'h3': {
        const prefix = '### '
        insertText = `${prefix}${selectedText}`
        if (hasSelection) {
          selectionStartDelta = prefix.length
          selectionEndDelta = prefix.length + selectedText.length
        } else {
          insertText = prefix
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'ul': {
        if (hasSelection) {
          const formatted = selectedText
            .split('\n')
            .map(line => (line.startsWith('- ') ? line : `- ${line}`))
            .join('\n')
          insertText = formatted
          selectionStartDelta = 0
          selectionEndDelta = insertText.length
        } else {
          insertText = '- '
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'ol': {
        if (hasSelection) {
          const formatted = selectedText
            .split('\n')
            .map((line, index) => `${index + 1}. ${line}`)
            .join('\n')
          insertText = formatted
          selectionStartDelta = 0
          selectionEndDelta = insertText.length
        } else {
          insertText = '1. '
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'checkbox': {
        if (hasSelection) {
          const formatted = selectedText
            .split('\n')
            .map(line => (line.startsWith('- [') ? line : `- [ ] ${line}`))
            .join('\n')
          insertText = formatted
          selectionStartDelta = 0
          selectionEndDelta = insertText.length
        } else {
          insertText = '- [ ] '
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'link': {
        const textPlaceholder = hasSelection ? selectedText : 'link text'
        const urlPlaceholder = 'https://'
        insertText = `[${textPlaceholder}](${urlPlaceholder})`
        if (hasSelection) {
          selectionStartDelta = textPlaceholder.length + 3
          selectionEndDelta = selectionStartDelta + urlPlaceholder.length
        } else {
          selectionStartDelta = 1
          selectionEndDelta = 1 + textPlaceholder.length
        }
        break
      }
      case 'code': {
        const containsNewline = hasSelection && selectedText.includes('\n')
        if (hasSelection && !containsNewline) {
          applyWrapper('`', '`')
        } else {
          const innerContent = hasSelection ? selectedText : ''
          const tripleBacktick = '```'
          insertText = `${tripleBacktick}\n${innerContent}\n${tripleBacktick}`
          selectionStartDelta = tripleBacktick.length + 1
          selectionEndDelta = selectionStartDelta + innerContent.length
        }
        break
      }
      case 'quote': {
        if (hasSelection) {
          insertText = selectedText
            .split('\n')
            .map(line => (line.startsWith('>') ? line : `> ${line}`))
            .join('\n')
          selectionStartDelta = 0
          selectionEndDelta = insertText.length
        } else {
          const prefix = '> '
          insertText = prefix
          selectionStartDelta = insertText.length
          selectionEndDelta = insertText.length
        }
        break
      }
      case 'mermaid': {
        const diagramTemplate = selectedText || `flowchart TD\n    A[Start] --> B[End]`
        const header = '```mermaid\n'
        const footer = '\n```'
        insertText = `${header}${diagramTemplate}${footer}`
        selectionStartDelta = header.length
        selectionEndDelta = header.length + diagramTemplate.length
        break
      }
      default:
        return
    }

    // Replace the selected text
    model.pushEditOperations([], [{
      range: selection,
      text: insertText
    }], () => null)

    const newSelectionStart = model.getPositionAt(startOffset + selectionStartDelta)
    const newSelectionEnd = model.getPositionAt(startOffset + selectionEndDelta)

    editor.setSelection(new monaco.Selection(
      newSelectionStart.lineNumber,
      newSelectionStart.column,
      newSelectionEnd.lineNumber,
      newSelectionEnd.column
    ))

    editor.focus()
  }

  return {
    formatText
  }
}
