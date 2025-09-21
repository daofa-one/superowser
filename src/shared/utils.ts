// Content missing for src/shared/utils.ts
export function formatUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return hostname
  } catch {
    return url
  }
}

export function fuzzyMatchScore(term: string, query: string): number | null {
  const normalizedTerm = term.trim().toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return null
  }

  if (normalizedTerm === normalizedQuery) {
    return Number.MAX_SAFE_INTEGER
  }

  let score = 0
  let searchIndex = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1
  let consecutiveMatches = 0

  for (const char of normalizedQuery) {
    const matchIndex = normalizedTerm.indexOf(char, searchIndex)
    if (matchIndex === -1) {
      return null
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = matchIndex
    }
    lastMatchIndex = matchIndex

    if (matchIndex === searchIndex) {
      consecutiveMatches += 1
      score += 2 + consecutiveMatches
    } else {
      consecutiveMatches = 0
      score += 1
    }

    if (matchIndex === 0) {
      score += 5
    } else if (normalizedTerm[matchIndex - 1] === ' ' || normalizedTerm[matchIndex - 1] === '-') {
      score += 3
    }

    searchIndex = matchIndex + 1
  }

  if (normalizedTerm.startsWith(normalizedQuery)) {
    score += 5
  }

  if (firstMatchIndex !== -1 && lastMatchIndex !== -1) {
    const span = lastMatchIndex - firstMatchIndex + 1
    const density = normalizedQuery.length / span
    score += density * 4
    score += Math.max(0, 4 - firstMatchIndex)
  }

  return score
}

export function escapeForXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
