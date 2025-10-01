import * as monaco from 'monaco-editor'

export function useMonacoCommands(
  editor: any,
  formatText: (format: string) => void,
  togglePreview: () => void,
  saveDocument: () => void,
  exportDocument: () => void,
  handleToggleOutline: () => void,
  scheduleEditorLayout: () => void
) {
  function registerCustomCommands() {
    if (!editor) return

    // Save Document
    editor.addAction({
      id: 'authoring.saveDocument',
      label: 'Save Document',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: () => {
        saveDocument()
      }
    })

    // Export Document
    editor.addAction({
      id: 'authoring.exportDocument',
      label: 'Export Document',
      keybindings: [],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      run: () => {
        exportDocument()
      }
    })

    // Toggle Preview
    editor.addAction({
      id: 'authoring.togglePreview',
      label: 'Toggle Preview',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      contextMenuGroupId: 'view',
      contextMenuOrder: 1.1,
      run: () => {
        togglePreview()
        setTimeout(() => scheduleEditorLayout(), 100)
      }
    })

    // Toggle Outline
    editor.addAction({
      id: 'authoring.toggleOutline',
      label: 'Toggle Document Outline',
      keybindings: [],
      contextMenuGroupId: 'view',
      contextMenuOrder: 1.2,
      run: () => {
        handleToggleOutline()
      }
    })

    // Go to Line (built-in command, but let's ensure it's available)
    editor.addAction({
      id: 'authoring.gotoLine',
      label: 'Go to Line...',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.1,
      run: () => {
        editor.trigger('', 'editor.action.gotoLine', null)
      }
    })

    // Insert Heading 1
    editor.addAction({
      id: 'authoring.insertHeading1',
      label: 'Insert Heading 1',
      keybindings: [],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.1,
      run: () => {
        insertHeading(1)
      }
    })

    // Insert Heading 2
    editor.addAction({
      id: 'authoring.insertHeading2',
      label: 'Insert Heading 2',
      keybindings: [],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.2,
      run: () => {
        insertHeading(2)
      }
    })

    // Insert Heading 3
    editor.addAction({
      id: 'authoring.insertHeading3',
      label: 'Insert Heading 3',
      keybindings: [],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.3,
      run: () => {
        insertHeading(3)
      }
    })

    // Insert Link
    editor.addAction({
      id: 'authoring.insertLink',
      label: 'Insert Link',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.4,
      run: () => {
        insertLink()
      }
    })

    // Insert Image
    editor.addAction({
      id: 'authoring.insertImage',
      label: 'Insert Image',
      keybindings: [],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.5,
      run: () => {
        insertImage()
      }
    })

    // Insert Table
    editor.addAction({
      id: 'authoring.insertTable',
      label: 'Insert Table',
      keybindings: [],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.6,
      run: () => {
        insertTable()
      }
    })

    // Insert Code Block
    editor.addAction({
      id: 'authoring.insertCodeBlock',
      label: 'Insert Code Block',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
      contextMenuGroupId: 'insert',
      contextMenuOrder: 2.7,
      run: () => {
        insertCodeBlock()
      }
    })

    // Format Bold
    editor.addAction({
      id: 'authoring.formatBold',
      label: 'Format Bold',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
      contextMenuGroupId: 'format',
      contextMenuOrder: 3.1,
      run: () => {
        formatText('bold')
      }
    })

    // Format Italic
    editor.addAction({
      id: 'authoring.formatItalic',
      label: 'Format Italic',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      contextMenuGroupId: 'format',
      contextMenuOrder: 3.2,
      run: () => {
        formatText('italic')
      }
    })

    // Format Code
    editor.addAction({
      id: 'authoring.formatCode',
      label: 'Format Inline Code',
      keybindings: [],
      contextMenuGroupId: 'format',
      contextMenuOrder: 3.3,
      run: () => {
        formatText('code')
      }
    })
  }

  function insertHeading(level: number) {
    if (!editor) return

    const position = editor.getPosition()
    if (!position) return

    const model = editor.getModel()
    if (!model) return

    const lineContent = model.getLineContent(position.lineNumber)
    const prefix = '#'.repeat(level)
    const headingText = `${prefix} Heading ${level}`

    // If line is empty, insert heading directly
    if (lineContent.trim() === '') {
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: lineContent.length + 1
      }
      model.pushEditOperations([], [{
        range,
        text: headingText
      }], () => null)

      // Position cursor at end of heading text
      editor.setPosition({
        lineNumber: position.lineNumber,
        column: headingText.length + 1
      })
    } else {
      // Insert heading on new line
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }
      model.pushEditOperations([], [{
        range,
        text: `\n${headingText}\n`
      }], () => null)

      // Position cursor at end of heading text
      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: headingText.length + 1
      })
    }

    editor.focus()
  }

  function insertLink() {
    if (!editor) return

    const position = editor.getPosition()
    if (!position) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return

    let linkText = 'Link text'
    const linkUrl = 'https://example.com'

    // If there's selected text, use it as link text
    if (selection && !selection.isEmpty()) {
      linkText = model.getValueInRange(selection)
    }

    const linkMarkdown = `[${linkText}](${linkUrl})`

    const range = selection || {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    model.pushEditOperations([], [{
      range,
      text: linkMarkdown
    }], () => null)

    // Select the URL part for easy editing
    const urlStart = position.column + linkText.length + 3 // "[text](".length
    editor.setSelection({
      startLineNumber: position.lineNumber,
      startColumn: urlStart,
      endLineNumber: position.lineNumber,
      endColumn: urlStart + linkUrl.length
    })

    editor.focus()
  }

  function insertImage() {
    if (!editor) return

    const position = editor.getPosition()
    if (!position) return

    const model = editor.getModel()
    if (!model) return

    const imageMarkdown = '![Alt text](image-url.jpg)'

    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    model.pushEditOperations([], [{
      range,
      text: imageMarkdown
    }], () => null)

    // Select the URL part for easy editing
    const urlStart = position.column + 12 // "![Alt text](".length
    editor.setSelection({
      startLineNumber: position.lineNumber,
      startColumn: urlStart,
      endLineNumber: position.lineNumber,
      endColumn: urlStart + 13 // "image-url.jpg".length
    })

    editor.focus()
  }

  function insertTable() {
    if (!editor) return

    const position = editor.getPosition()
    if (!position) return

    const model = editor.getModel()
    if (!model) return

    const tableMarkdown = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`

    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    model.pushEditOperations([], [{
      range,
      text: `\n${tableMarkdown}\n`
    }], () => null)

    // Position cursor at first header cell
    editor.setPosition({
      lineNumber: position.lineNumber + 1,
      column: 3 // Start of "Header 1"
    })

    editor.focus()
  }

  function insertCodeBlock() {
    if (!editor) return

    const position = editor.getPosition()
    if (!position) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return

    let codeText = 'code here'

    // If there's selected text, use it as code content
    if (selection && !selection.isEmpty()) {
      codeText = model.getValueInRange(selection)
    }

    const codeMarkdown = `\`\`\`javascript
${codeText}
\`\`\``

    const range = selection || {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    model.pushEditOperations([], [{
      range,
      text: `\n${codeMarkdown}\n`
    }], () => null)

    // Position cursor inside the code block
    editor.setPosition({
      lineNumber: position.lineNumber + 2,
      column: codeText.length + 1
    })

    editor.focus()
  }

  return {
    registerCustomCommands
  }
}