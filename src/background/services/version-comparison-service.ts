// Version Comparison Service

import type {
  DocumentVersionEntry,
  VersionComparisonResult,
  VersionDiff,
  VersionBranchInfo
} from '../../shared/models'

import {
  generateVersionDiff,
  compareVersions,
  calculateSimilarity
} from '../../shared/utils/version-utils'

export class VersionComparisonService {
  /**
   * Compare two versions and return detailed comparison result
   */
  async compareVersions(
    sourceVersionId: string,
    targetVersionId: string,
    versionService: any
  ): Promise<VersionComparisonResult> {
    const sourceVersion = await versionService.getById(sourceVersionId)
    const targetVersion = await versionService.getById(targetVersionId)

    if (!sourceVersion || !targetVersion) {
      throw new Error('One or both versions not found')
    }

    if (sourceVersion.documentId !== targetVersion.documentId) {
      throw new Error('Versions belong to different documents')
    }

    return compareVersions(sourceVersion, targetVersion)
  }

  /**
   * Generate diff between two content strings
   */
  generateDiff(oldContent: string, newContent: string): VersionDiff {
    return generateVersionDiff(oldContent, newContent)
  }

  /**
   * Calculate similarity score between two versions
   */
  async calculateVersionSimilarity(
    version1Id: string,
    version2Id: string,
    versionService: any
  ): Promise<number> {
    const version1 = await versionService.getById(version1Id)
    const version2 = await versionService.getById(version2Id)

    if (!version1 || !version2) {
      throw new Error('One or both versions not found')
    }

    return calculateSimilarity(version1, version2)
  }

  /**
   * Find similar versions to a given version
   */
  async findSimilarVersions(
    versionId: string,
    versionService: any,
    threshold: number = 0.7
  ): Promise<Array<{ version: DocumentVersionEntry; similarity: number }>> {
    const targetVersion = await versionService.getById(versionId)
    if (!targetVersion) {
      throw new Error('Version not found')
    }

    const allVersions = await versionService.getByDocument(targetVersion.documentId)
    const similarities: Array<{ version: DocumentVersionEntry; similarity: number }> = []

    for (const version of allVersions) {
      if (version.id === versionId) continue

      const similarity = calculateSimilarity(targetVersion, version)
      if (similarity >= threshold) {
        similarities.push({ version, similarity })
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity)
  }

  /**
   * Generate branch information for a document
   */
  async generateBranchInfo(
    documentId: string,
    versionService: any
  ): Promise<VersionBranchInfo[]> {
    const allVersions = await versionService.getByDocument(documentId)
    const branches: { [branchName: string]: DocumentVersionEntry[] } = {}

    // Group versions by branch
    for (const version of allVersions) {
      const branchName = version.metadata?.branchName || 'main'
      if (!branches[branchName]) {
        branches[branchName] = []
      }
      branches[branchName].push(version)
    }

    // Convert to branch info
    const branchInfos: VersionBranchInfo[] = []

    for (const [branchName, versions] of Object.entries(branches)) {
      const sortedVersions = versions.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      const baseVersionId = sortedVersions[0]?.id
      const headVersionId = sortedVersions[sortedVersions.length - 1]?.id

      branchInfos.push({
        branchName,
        baseVersionId,
        headVersionId,
        versions: sortedVersions,
        isActive: branchName === 'main', // Main branch is active by default
        description: branchName === 'main' ? 'Main development branch' : undefined
      })
    }

    return branchInfos.sort((a, b) => {
      if (a.branchName === 'main') return -1
      if (b.branchName === 'main') return 1
      return a.branchName.localeCompare(b.branchName)
    })
  }

  /**
   * Merge two versions (simplified merge)
   */
  async mergeVersions(
    baseVersionId: string,
    sourceVersionId: string,
    targetVersionId: string,
    versionService: any,
    resolveConflicts: (conflicts: any[]) => string = () => ''
  ): Promise<{
    mergedContent: string
    conflicts: any[]
    hasConflicts: boolean
  }> {
    const baseVersion = await versionService.getById(baseVersionId)
    const sourceVersion = await versionService.getById(sourceVersionId)
    const targetVersion = await versionService.getById(targetVersionId)

    if (!baseVersion || !sourceVersion || !targetVersion) {
      throw new Error('One or more versions not found')
    }

    // Simple 3-way merge simulation
    const baseDiff = this.generateDiff(baseVersion.content, sourceVersion.content)
    const targetDiff = this.generateDiff(baseVersion.content, targetVersion.content)

    const conflicts: any[] = []
    let mergedContent = baseVersion.content

    // Detect conflicts (overlapping changes)
    const sourceChanges = new Set(baseDiff.modified.map(m => m.line))
    const targetChanges = new Set(targetDiff.modified.map(m => m.line))
    const conflictLines = [...sourceChanges].filter(line => targetChanges.has(line))

    if (conflictLines.length > 0) {
      conflicts.push({
        type: 'content_conflict',
        lines: conflictLines,
        sourceContent: sourceVersion.content,
        targetContent: targetVersion.content
      })
    }

    const hasConflicts = conflicts.length > 0

    if (hasConflicts) {
      mergedContent = resolveConflicts(conflicts)
    } else {
      // Simple merge: apply non-conflicting changes
      mergedContent = targetVersion.content // Simplified: prefer target version
    }

    return {
      mergedContent,
      conflicts,
      hasConflicts
    }
  }

  /**
   * Create a version timeline for visualization
   */
  async createVersionTimeline(
    documentId: string,
    versionService: any
  ): Promise<Array<{
    version: DocumentVersionEntry
    relationships: {
      parent?: string
      children: string[]
      branch: string
    }
    position: {
      x: number
      y: number
    }
  }>> {
    const allVersions = await versionService.getByDocument(documentId)
    const timeline: any[] = []

    // Sort versions by creation time
    const sortedVersions = allVersions.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Build parent-child relationships
    const childrenMap: { [parentId: string]: string[] } = {}
    for (const version of sortedVersions) {
      if (version.parentVersionId) {
        if (!childrenMap[version.parentVersionId]) {
          childrenMap[version.parentVersionId] = []
        }
        childrenMap[version.parentVersionId].push(version.id)
      }
    }

    // Position versions in timeline
    let yPosition = 0
    const branchPositions: { [branch: string]: number } = {}

    for (const version of sortedVersions) {
      const branchName = version.metadata?.branchName || 'main'

      if (!branchPositions[branchName]) {
        branchPositions[branchName] = Object.keys(branchPositions).length * 100
      }

      timeline.push({
        version,
        relationships: {
          parent: version.parentVersionId,
          children: childrenMap[version.id] || [],
          branch: branchName
        },
        position: {
          x: yPosition * 120, // Horizontal timeline
          y: branchPositions[branchName] // Vertical branch separation
        }
      })

      yPosition++
    }

    return timeline
  }

  /**
   * Calculate version metrics for analytics
   */
  async calculateVersionMetrics(
    documentId: string,
    versionService: any
  ): Promise<{
    totalVersions: number
    averageTimeBetweenVersions: number // milliseconds
    mostActiveHour: number
    versionsByDay: { [date: string]: number }
    contentGrowthTrend: Array<{ date: Date; size: number }>
  }> {
    const allVersions = await versionService.getByDocument(documentId)

    if (allVersions.length === 0) {
      throw new Error('No versions found for document')
    }

    const sortedVersions = allVersions.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Calculate average time between versions
    let totalTimeDiff = 0
    for (let i = 1; i < sortedVersions.length; i++) {
      const timeDiff = new Date(sortedVersions[i].createdAt).getTime() -
                      new Date(sortedVersions[i - 1].createdAt).getTime()
      totalTimeDiff += timeDiff
    }
    const averageTimeBetweenVersions = sortedVersions.length > 1
      ? totalTimeDiff / (sortedVersions.length - 1)
      : 0

    // Find most active hour
    const hourCounts: { [hour: number]: number } = {}
    for (const version of allVersions) {
      const hour = new Date(version.createdAt).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    }
    const mostActiveHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]
      ? parseInt(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0][0])
      : 0

    // Versions by day
    const versionsByDay: { [date: string]: number } = {}
    for (const version of allVersions) {
      const date = new Date(version.createdAt).toISOString().split('T')[0]
      versionsByDay[date] = (versionsByDay[date] || 0) + 1
    }

    // Content growth trend
    const contentGrowthTrend = sortedVersions.map(version => ({
      date: new Date(version.createdAt),
      size: version.size
    }))

    return {
      totalVersions: allVersions.length,
      averageTimeBetweenVersions,
      mostActiveHour,
      versionsByDay,
      contentGrowthTrend
    }
  }
}