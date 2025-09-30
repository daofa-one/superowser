import { ref, computed, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'

export function usePreview() {
  // State
  const showPreview = ref(false)
  const previewContentRef = ref<HTMLElement>()
  const renderedContent = ref('')
  const isScrollSyncing = ref(false)
  const mermaidLoaded = ref(false)
  let mermaidInstance: any = null
  let previewScrollListener: ((ratio: number) => void) | null = null
  let previewSyncTimeout: number | null = null

  // Initialize markdown renderer
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false
  }).use(anchor, {
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      renderAttrs: () => ({ 'aria-hidden': 'true' })
    })
  })

  md.disable('smartquotes')

  // Computed styles for split panes
  const editorPaneStyle = computed(() => ({
    width: showPreview.value ? '50%' : '100%',
    borderRight: showPreview.value ? '1px solid #e2e8f0' : 'none'
  }))

  const previewPaneStyle = computed(() => ({
    width: '50%'
  }))

  // Mermaid functions
  async function loadMermaid() {
    if (mermaidLoaded.value) return

    try {
      // Dynamic import for lazy loading
      const mermaid = await import('mermaid')
      mermaidInstance = mermaid.default

      // Configure Mermaid
      mermaidInstance.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: 'arial',
        fontSize: 14
      })

      mermaidLoaded.value = true
    } catch (error) {
      console.error('Failed to load Mermaid:', error)
    }
  }

  async function renderMermaidDiagrams(htmlContent: string, markdownContent: string): Promise<string> {
    if (!mermaidInstance) return htmlContent

    // Find all mermaid code blocks in the markdown
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g
    let match
    let processedContent = htmlContent
    let diagramIndex = 0

    while ((match = mermaidRegex.exec(markdownContent)) !== null) {
      const diagramCode = match[1].trim()
      const diagramId = `mermaid-diagram-${diagramIndex++}`

      // Replace the code block with a mermaid container
      const codeBlockPattern = new RegExp(`<pre><code class="language-mermaid">[\\s\\S]*?</code></pre>`)
      const mermaidContainer = `
        <div class="mermaid-container">
          <div id="${diagramId}" class="mermaid-diagram" data-diagram="${encodeURIComponent(diagramCode)}">
            Loading diagram...
          </div>
          <div class="mermaid-controls">
            <button class="mermaid-export-btn" onclick="exportMermaidDiagram('${diagramId}')" title="Export as SVG">
              📥 Export SVG
            </button>
          </div>
        </div>
      `
      processedContent = processedContent.replace(codeBlockPattern, mermaidContainer)
    }

    return processedContent
  }

  function renderMermaidInDOM() {
    if (!mermaidInstance || !previewContentRef.value) return

    const mermaidElements = previewContentRef.value.querySelectorAll('.mermaid-diagram')

    mermaidElements.forEach(async (element: any) => {
      const diagramCode = decodeURIComponent(element.dataset.diagram)
      const diagramId = element.id

      try {
        const { svg } = await mermaidInstance.render(diagramId + '-svg', diagramCode)
        element.innerHTML = svg
      } catch (error) {
        console.error('Failed to render Mermaid diagram:', error)
        element.innerHTML = '<p style="color: red;">Error rendering diagram</p>'
      }
    })
  }

  // Preview functionality
  function togglePreview() {
    showPreview.value = !showPreview.value
    return showPreview.value
  }

  async function updatePreview(content: string) {
    if (!showPreview.value) return

    try {
      // First, render basic markdown
      let htmlContent = md.render(content || '')

      // Check if there are Mermaid diagrams and load library if needed
      const hasMermaid = /```mermaid\n([\s\S]*?)\n```/g.test(content)

      if (hasMermaid) {
        await loadMermaid()
        htmlContent = await renderMermaidDiagrams(htmlContent, content)
      }

      renderedContent.value = htmlContent

      // Render Mermaid diagrams after content is updated
      if (hasMermaid && mermaidInstance) {
        nextTick(() => {
          renderMermaidInDOM()
        })
      }
    } catch (error) {
      console.error('Failed to render markdown:', error)
      renderedContent.value = '<p>Error rendering markdown</p>'
    }
  }

  let previewUpdateTimeout: number | null = null
  function debouncedPreviewUpdate(content: string) {
    if (previewUpdateTimeout) {
      clearTimeout(previewUpdateTimeout)
    }
    previewUpdateTimeout = window.setTimeout(() => {
      updatePreview(content)
    }, 300) // 300ms debounce
  }

  function handlePreviewScroll() {
    if (!previewContentRef.value || isScrollSyncing.value) return

    const element = previewContentRef.value
    const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 1)
    const ratio = element.scrollTop / maxScroll

    if (previewScrollListener) {
      previewScrollListener(Math.min(Math.max(ratio, 0), 1))
    }
  }

  function setPreviewScrollRatio(ratio: number) {
    if (!previewContentRef.value) return

    const element = previewContentRef.value
    const clampedRatio = Math.min(Math.max(ratio, 0), 1)
    const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 1)
    const targetTop = maxScroll * clampedRatio

    if (Math.abs(element.scrollTop - targetTop) < 1) {
      return
    }

    isScrollSyncing.value = true
    element.scrollTo({ top: targetTop, behavior: 'smooth' })

    if (previewSyncTimeout) {
      window.clearTimeout(previewSyncTimeout)
    }
    previewSyncTimeout = window.setTimeout(() => {
      isScrollSyncing.value = false
    }, 120)
  }

  function registerPreviewScrollHandler(listener: (ratio: number) => void) {
    previewScrollListener = listener
  }

  // Global function for export (accessible from HTML)
  ;(window as any).exportMermaidDiagram = function(diagramId: string) {
    const element = document.getElementById(diagramId)
    if (!element) return

    const svgElement = element.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = `${diagramId}.svg`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(svgUrl)
  }

  return {
    // State
    showPreview,
    previewContentRef,
    renderedContent,
    isScrollSyncing,

    // Computed
    editorPaneStyle,
    previewPaneStyle,

    // Methods
    togglePreview,
    updatePreview,
    debouncedPreviewUpdate,
    handlePreviewScroll,
    setPreviewScrollRatio,
    registerPreviewScrollHandler
  }
}
