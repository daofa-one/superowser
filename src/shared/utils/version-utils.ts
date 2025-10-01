// Version Management Utilities

import type {
  DocumentVersionEntry,
  VersionDiff,
  VersionComparisonResult,
  VersionAnalytics
} from '../models'

/**
 * Generate SHA-256 hash for content deduplication
 */
export async function generateContentHash(content: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)

    // Use global crypto in service workers, or fallback to a simple hash
    const cryptoSubtle = globalThis.crypto?.subtle || crypto?.subtle
    if (cryptoSubtle) {
      const hashBuffer = await cryptoSubtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } else {
      // Fallback to a simple hash for environments without crypto.subtle
      return generateSimpleHash(content)
    }
  } catch (error) {
    console.warn('[version-utils] Failed to generate SHA-256 hash, using fallback:', error)
    return generateSimpleHash(content)
  }
}

/**
 * Simple hash function fallback for environments without crypto.subtle
 */
function generateSimpleHash(content: string): string {
  let hash = 0
  if (content.length === 0) return hash.toString(16)

  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Calculate content statistics
 */
export function calculateContentStats(content: string): {
  size: number
  characterCount: number
  wordCount: number
  lineCount: number
} {
  const lines = content.split('\n')
  const words = content.trim().split(/\s+/).filter(word => word.length > 0)

  // Calculate size in bytes (UTF-8 encoding)
  let size: number
  try {
    // Try using Blob if available (browser context)
    if (typeof Blob !== 'undefined') {
      size = new Blob([content]).size
    } else {
      // Fallback for service workers: calculate UTF-8 byte length
      size = new TextEncoder().encode(content).length
    }
  } catch (error) {
    // Final fallback: approximate size (not accurate for non-ASCII)
    size = content.length
  }

  return {
    size,
    characterCount: content.length,
    wordCount: words.length,
    lineCount: lines.length
  }
}

/**
 * Generate semantic version number
 */
export function generateSemanticVersion(
  existingVersions: DocumentVersionEntry[],
  isMajor: boolean = false,
  isMinor: boolean = false
): string {
  if (existingVersions.length === 0) {
    return '1.0.0'
  }

  // Find the latest version
  const latestVersion = existingVersions
    .map(v => v.metadata?.version)
    .filter(v => v && v.match(/^\d+\.\d+\.\d+$/))
    .sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.split('.').map(Number)
      const [bMajor, bMinor, bPatch] = b.split('.').map(Number)

      if (aMajor !== bMajor) return bMajor - aMajor
      if (aMinor !== bMinor) return bMinor - aMinor
      return bPatch - aPatch
    })[0] || '1.0.0'

  const [major, minor, patch] = latestVersion.split('.').map(Number)

  if (isMajor) {
    return `${major + 1}.0.0`
  } else if (isMinor) {
    return `${major}.${minor + 1}.0`
  } else {
    return `${major}.${minor}.${patch + 1}`
  }
}

/**
 * Detect significant changes between content versions
 */
export function detectSignificantChange(
  oldContent: string,
  newContent: string,
  threshold: number = 0.3
): boolean {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const diff = calculateSimpleDiff(oldLines, newLines)
  const totalLines = Math.max(oldLines.length, newLines.length)

  if (totalLines === 0) return false

  const changeRatio = (diff.linesAdded + diff.linesRemoved + diff.linesModified) / totalLines
  return changeRatio >= threshold
}

/**
 * Calculate simple line-based diff
 */
export function calculateSimpleDiff(oldLines: string[], newLines: string[]): {
  linesAdded: number
  linesRemoved: number
  linesModified: number
} {
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  let linesAdded = 0
  let linesRemoved = 0
  let linesModified = 0

  // Count added lines
  for (const line of newLines) {
    if (!oldSet.has(line)) {
      linesAdded++
    }
  }

  // Count removed lines
  for (const line of oldLines) {
    if (!newSet.has(line)) {
      linesRemoved++
    }
  }

  // Modified lines are estimated as the minimum of adds/removes
  linesModified = Math.min(linesAdded, linesRemoved)
  linesAdded -= linesModified
  linesRemoved -= linesModified

  return { linesAdded, linesRemoved, linesModified }
}

/**
 * Generate detailed diff between two content versions
 */
export function generateVersionDiff(oldContent: string, newContent: string): VersionDiff {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const added: string[] = []
  const removed: string[] = []
  const modified: Array<{ line: number; oldContent: string; newContent: string }> = []

  // Track line changes
  const maxLines = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine === undefined && newLine !== undefined) {
      added.push(newLine)
    } else if (oldLine !== undefined && newLine === undefined) {
      removed.push(oldLine)
    } else if (oldLine !== newLine) {
      modified.push({
        line: i + 1,
        oldContent: oldLine,
        newContent: newLine
      })
    }
  }

  const summary = {
    linesAdded: added.length,
    linesRemoved: removed.length,
    linesModified: modified.length
  }

  return { added, removed, modified, summary }
}

/**
 * Calculate similarity score between two versions (0-1)
 */
export function calculateSimilarity(version1: DocumentVersionEntry, version2: DocumentVersionEntry): number {
  const content1 = version1.content
  const content2 = version2.content

  if (content1 === content2) return 1.0
  if (content1.length === 0 && content2.length === 0) return 1.0
  if (content1.length === 0 || content2.length === 0) return 0.0

  // Use Jaccard similarity on word sets
  const words1 = new Set(content1.toLowerCase().split(/\s+/))
  const words2 = new Set(content2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Compare two versions and generate comparison result
 */
export function compareVersions(
  sourceVersion: DocumentVersionEntry,
  targetVersion: DocumentVersionEntry
): VersionComparisonResult {
  const diff = generateVersionDiff(sourceVersion.content, targetVersion.content)
  const similarity = calculateSimilarity(sourceVersion, targetVersion)

  // Simple conflict detection (overlapping changes)
  const hasConflicts = diff.modified.length > 0 &&
    (sourceVersion.createdAt.getTime() - targetVersion.createdAt.getTime()) < 60000 // within 1 minute

  return {
    sourceVersion,
    targetVersion,
    diff,
    similarity,
    hasConflicts
  }
}

/**
 * Generate analytics for document versions
 */
export function generateVersionAnalytics(versions: DocumentVersionEntry[]): VersionAnalytics {
  if (versions.length === 0) {
    throw new Error('No versions provided for analytics')
  }

  const documentId = versions[0].documentId
  const totalVersions = versions.length

  const sizes = versions.map(v => v.size)
  const storageUsed = sizes.reduce((sum, size) => sum + size, 0)
  const averageVersionSize = storageUsed / totalVersions

  const dates = versions.map(v => v.createdAt).sort((a, b) => a.getTime() - b.getTime())
  const oldestVersion = dates[0]
  const newestVersion = dates[dates.length - 1]

  const autoSavedCount = versions.filter(v => v.metadata?.isAutoSaved).length
  const milestoneCount = versions.filter(v => v.metadata?.isMilestone).length

  const branches = new Set(versions.map(v => v.metadata?.branchName).filter(Boolean))
  const branchCount = branches.size

  const uniqueHashes = new Set(versions.map(v => v.contentHash))
  const uniqueContentVersions = uniqueHashes.size

  // Calculate compression ratio if available
  const compressedVersions = versions.filter(v => v.settings?.compressionEnabled)
  const compressionRatio = compressedVersions.length > 0
    ? compressedVersions.reduce((sum, v) => sum + (v.size / (v.metadata?.characterCount || 1)), 0) / compressedVersions.length
    : undefined

  return {
    documentId,
    totalVersions,
    storageUsed,
    averageVersionSize,
    oldestVersion,
    newestVersion,
    autoSavedCount,
    milestoneCount,
    branchCount,
    uniqueContentVersions,
    compressionRatio
  }
}

/**
 * Generate auto-tags based on content and context
 */
export function generateAutoTags(
  content: string,
  previousVersion?: DocumentVersionEntry,
  customPatterns: string[] = []
): string[] {
  const tags: string[] = []
  const contentLower = content.toLowerCase()

  // Milestone detection
  if (contentLower.includes('final') || contentLower.includes('complete') ||
      contentLower.includes('finished') || contentLower.includes('done')) {
    tags.push('milestone')
  }

  // Draft detection
  if (contentLower.includes('draft') || contentLower.includes('wip') ||
      contentLower.includes('work in progress')) {
    tags.push('draft')
  }

  // Review detection
  if (contentLower.includes('review') || contentLower.includes('feedback') ||
      contentLower.includes('comments')) {
    tags.push('review')
  }

  // Breaking change detection
  if (previousVersion && detectSignificantChange(previousVersion.content, content, 0.5)) {
    tags.push('major-change')
  }

  // Custom pattern matching
  for (const pattern of customPatterns) {
    try {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(content)) {
        tags.push(`custom:${pattern.substring(0, 20)}`)
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return [...new Set(tags)] // Remove duplicates
}

/**
 * Create version metadata
 */
export function createVersionMetadata(
  content: string,
  options: {
    isAutoSaved?: boolean
    isMilestone?: boolean
    branchName?: string
    editingDuration?: number
    platform?: string
  } = {}
): DocumentVersionEntry['metadata'] {
  const stats = calculateContentStats(content)

  return {
    isAutoSaved: options.isAutoSaved || false,
    isMilestone: options.isMilestone || false,
    isArchived: false,
    branchName: options.branchName,
    editingDuration: options.editingDuration,
    characterCount: stats.characterCount,
    wordCount: stats.wordCount,
    version: '1.0.0', // Will be updated by generateSemanticVersion
    platform: options.platform || 'web'
  }
}