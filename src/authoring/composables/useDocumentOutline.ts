import { ref, computed, watch, nextTick } from 'vue'

interface Heading {
  id: string
  text: string
  level: number
  element?: HTMLElement
}

export function useDocumentOutline() {
  const headings = ref<Heading[]>([])
  const activeHeading = ref<string>('')
  const previewElement = ref<HTMLElement | null>(null)

  // Extract headings from markdown content
  function extractHeadingsFromContent(content: string): Heading[] {
    const lines = content.split('\n')
    const extractedHeadings: Heading[] = []

    lines.forEach(line => {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const text = headingMatch[2].trim()
        const id = generateHeadingId(text)

        extractedHeadings.push({
          id,
          text,
          level
        })
      }
    })

    return extractedHeadings
  }

  // Extract headings from rendered HTML
  function extractHeadingsFromDOM(containerElement: HTMLElement): Heading[] {
    const headingElements = containerElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const extractedHeadings: Heading[] = []

    headingElements.forEach(element => {
      const tagName = element.tagName.toLowerCase()
      const level = parseInt(tagName.substring(1))
      const text = element.textContent?.trim() || ''
      let id = element.id

      // Generate ID if not present
      if (!id) {
        id = generateHeadingId(text)
        element.id = id
      }

      extractedHeadings.push({
        id,
        text,
        level,
        element: element as HTMLElement
      })
    })

    return extractedHeadings
  }

  // Generate a URL-friendly ID from heading text
  function generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  // Update headings from content
  function updateHeadingsFromContent(content: string) {
    headings.value = extractHeadingsFromContent(content)
  }

  // Update headings from DOM
  function updateHeadingsFromDOM() {
    if (previewElement.value) {
      headings.value = extractHeadingsFromDOM(previewElement.value)
    }
  }

  // Scroll to heading
  function scrollToHeading(headingId: string) {
    const element = document.getElementById(headingId)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
      activeHeading.value = headingId
    }
  }

  // Set up intersection observer to track active heading
  function setupIntersectionObserver() {
    if (!previewElement.value || headings.value.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0
        let activeId = ''

        entries.forEach(entry => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            activeId = entry.target.id
          }
        })

        if (activeId && maxRatio > 0.5) {
          activeHeading.value = activeId
        }
      },
      {
        root: previewElement.value,
        rootMargin: '-20% 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    )

    // Observe all heading elements
    headings.value.forEach(heading => {
      if (heading.element) {
        observer.observe(heading.element)
      }
    })

    return observer
  }

  // Initialize outline functionality
  function initializeOutline(previewContainer: HTMLElement) {
    previewElement.value = previewContainer

    nextTick(() => {
      updateHeadingsFromDOM()
      setupIntersectionObserver()
    })
  }

  // Watch for changes in headings to re-setup observer
  watch(headings, () => {
    nextTick(() => {
      setupIntersectionObserver()
    })
  }, { deep: true })

  return {
    headings: computed(() => headings.value),
    activeHeading: computed(() => activeHeading.value),
    updateHeadingsFromContent,
    updateHeadingsFromDOM,
    scrollToHeading,
    initializeOutline
  }
}