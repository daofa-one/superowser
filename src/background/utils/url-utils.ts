/**
 * URL utilities for normalizing and comparing URLs
 */

interface NormalizedUrl {
  origin: string
  path: string
  search: string
  hash: string
}

/**
 * Normalize a URL string for comparison
 * @param value - URL string to normalize
 * @returns Normalized URL components or null if invalid
 */
export function normalizeUrl(value: string): NormalizedUrl | null {
  try {
    const url = new URL(value)
    const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/'

    return {
      origin: url.origin.toLowerCase(),
      path: normalizePath(url.pathname),
      search: url.search || '',
      hash: url.hash || ''
    }
  } catch {
    return null
  }
}

/**
 * Compare two URLs for equality, handling normalization
 * @param first - First URL to compare
 * @param second - Second URL to compare
 * @returns true if URLs match after normalization
 */
export function urlsMatch(first: string, second: string): boolean {
  const a = normalizeUrl(first)
  const b = normalizeUrl(second)

  if (!a || !b) {
    return first === second
  }

  return (
    a.origin === b.origin &&
    a.path === b.path &&
    a.search === b.search &&
    a.hash === b.hash
  )
}

/**
 * Find existing tab with matching URL or create new one
 * @param targetUrl - URL to open or focus
 * @returns The found or created tab
 */
export async function focusOrOpenUrl(targetUrl: string): Promise<chrome.tabs.Tab> {
  const allTabs = await chrome.tabs.query({})
  const existingTab = allTabs.find(tab => {
    const candidateUrl = tab.url || (tab as any).pendingUrl
    if (!candidateUrl) {
      return false
    }
    return urlsMatch(candidateUrl, targetUrl)
  })

  if (existingTab && existingTab.id && existingTab.windowId) {
    await chrome.windows.update(existingTab.windowId, { focused: true })
    await chrome.tabs.update(existingTab.id, { active: true })
    return existingTab
  }

  return chrome.tabs.create({
    url: targetUrl,
    active: true
  })
}
