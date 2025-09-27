// Analytics service for tracking user interactions and search patterns

export interface AccessRecord {
  id: string
  type: 'page' | 'note' | 'task'
  timestamp: Date
  source: 'omnibox' | 'sidepanel' | 'direct' | 'shortcut'
  query?: string
  context?: {
    activeTask?: string
    currentUrl?: string
    sessionId?: string
  }
}

export interface UsageStats {
  totalAccesses: number
  lastAccess: Date
  firstAccess: Date
  accessFrequency: number // accesses per day
  averageInterval: number // average days between accesses
  sources: Record<string, number> // source breakdown
  recentQueries: string[] // recent search queries that led to this item
}

export interface ContextStats {
  activeTask?: string
  recentTags: string[]
  recentPages: string[]
  sessionStartTime: Date
  currentUrl?: string
}

export class AnalyticsService {
  private accessHistory: AccessRecord[] = []
  private usageStats: Map<string, UsageStats> = new Map()
  private contextStats: ContextStats = {
    recentTags: [],
    recentPages: [],
    sessionStartTime: new Date()
  }
  private readonly MAX_HISTORY = 10000 // Keep last 10k access records
  private readonly MAX_RECENT_QUERIES = 5
  private readonly MAX_RECENT_TAGS = 10
  private readonly MAX_RECENT_PAGES = 20

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Record an access to a page, note, or task
   */
  recordAccess(record: Omit<AccessRecord, 'timestamp'>): void {
    const fullRecord: AccessRecord = {
      ...record,
      timestamp: new Date()
    }

    // Add to history
    this.accessHistory.push(fullRecord)

    // Trim history if too large
    if (this.accessHistory.length > this.MAX_HISTORY) {
      this.accessHistory = this.accessHistory.slice(-this.MAX_HISTORY)
    }

    // Update usage stats
    this.updateUsageStats(fullRecord)

    // Update context
    this.updateContext(fullRecord)

    // Persist to storage
    this.saveToStorage()
  }

  /**
   * Get usage statistics for a specific item
   */
  getUsageStats(id: string, type: 'page' | 'note' | 'task'): UsageStats | null {
    const key = `${type}:${id}`
    return this.usageStats.get(key) || null
  }

  /**
   * Calculate priority score for search results
   */
  calculatePriorityScore(
    item: { id: string; type: 'page' | 'note' | 'task'; tags?: string[]; tasks?: string[] },
    fuseScore: number,
    context?: {
      activeTask?: string
      recentTags?: string[]
      query?: string
    }
  ): number {
    const usage = this.getUsageStats(item.id, item.type)

    // Base Fuse.js score (0-1, where 0 is perfect match)
    const relevanceScore = 1 - (fuseScore || 0.5)

    // Recency factor (exponential decay)
    const recencyFactor = this.calculateRecencyFactor(usage?.lastAccess)

    // Frequency factor (logarithmic scale)
    const frequencyFactor = this.calculateFrequencyFactor(usage?.totalAccesses || 0)

    // Context factor (task relevance, tag overlap, etc.)
    const contextFactor = this.calculateContextFactor(item, context)

    // Combined priority score
    const priorityScore = relevanceScore * recencyFactor * frequencyFactor * contextFactor

    return Math.max(0, Math.min(10, priorityScore)) // Clamp to 0-10 range
  }

  /**
   * Get current context for search personalization
   */
  getCurrentContext(): ContextStats {
    return { ...this.contextStats }
  }

  /**
   * Update active task context
   */
  setActiveTask(taskName?: string): void {
    this.contextStats.activeTask = taskName
    this.saveToStorage()
  }

  /**
   * Clear old analytics data (for privacy)
   */
  clearOldData(daysToKeep = 90): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Filter access history
    this.accessHistory = this.accessHistory.filter(
      record => record.timestamp >= cutoffDate
    )

    // Rebuild usage stats from remaining history
    this.usageStats.clear()
    this.accessHistory.forEach(record => this.updateUsageStats(record))

    this.saveToStorage()
  }

  /**
   * Get search insights for debugging
   */
  getSearchInsights(): {
    totalRecords: number
    uniqueItems: number
    topSources: Array<{ source: string; count: number }>
    recentActivity: AccessRecord[]
    contextStats: ContextStats
  } {
    const sourceCounts = new Map<string, number>()

    this.accessHistory.forEach(record => {
      sourceCounts.set(record.source, (sourceCounts.get(record.source) || 0) + 1)
    })

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalRecords: this.accessHistory.length,
      uniqueItems: this.usageStats.size,
      topSources,
      recentActivity: this.accessHistory.slice(-10),
      contextStats: this.contextStats
    }
  }

  private updateUsageStats(record: AccessRecord): void {
    const key = `${record.type}:${record.id}`
    const existing = this.usageStats.get(key)

    if (existing) {
      // Update existing stats
      const totalAccesses = existing.totalAccesses + 1
      const daysSinceFirst = Math.max(1,
        (record.timestamp.getTime() - existing.firstAccess.getTime()) / (1000 * 60 * 60 * 24)
      )

      const updated: UsageStats = {
        ...existing,
        totalAccesses,
        lastAccess: record.timestamp,
        accessFrequency: totalAccesses / daysSinceFirst,
        averageInterval: daysSinceFirst / totalAccesses,
        sources: {
          ...existing.sources,
          [record.source]: (existing.sources[record.source] || 0) + 1
        }
      }

      // Update recent queries
      if (record.query && !updated.recentQueries.includes(record.query)) {
        updated.recentQueries = [record.query, ...updated.recentQueries]
          .slice(0, this.MAX_RECENT_QUERIES)
      }

      this.usageStats.set(key, updated)
    } else {
      // Create new stats
      const newStats: UsageStats = {
        totalAccesses: 1,
        lastAccess: record.timestamp,
        firstAccess: record.timestamp,
        accessFrequency: 1,
        averageInterval: 0,
        sources: { [record.source]: 1 },
        recentQueries: record.query ? [record.query] : []
      }

      this.usageStats.set(key, newStats)
    }
  }

  private updateContext(record: AccessRecord): void {
    // Update recent pages
    if (record.type === 'page') {
      this.contextStats.recentPages = [record.id, ...this.contextStats.recentPages]
        .slice(0, this.MAX_RECENT_PAGES)
    }

    // Update active task from context
    if (record.context?.activeTask) {
      this.contextStats.activeTask = record.context.activeTask
    }

    // Update current URL
    if (record.context?.currentUrl) {
      this.contextStats.currentUrl = record.context.currentUrl
    }
  }

  private calculateRecencyFactor(lastAccess?: Date): number {
    if (!lastAccess) return 0.1 // Default low score for never accessed

    const now = new Date()
    const daysSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24)

    // Exponential decay: 1.0 for today, 0.8 for yesterday, 0.5 for week ago, 0.1 for month ago
    if (daysSinceAccess < 1) return 1.0
    if (daysSinceAccess < 7) return 0.8 * Math.exp(-daysSinceAccess * 0.2)
    if (daysSinceAccess < 30) return 0.5 * Math.exp(-daysSinceAccess * 0.1)
    return 0.1 * Math.exp(-daysSinceAccess * 0.05)
  }

  private calculateFrequencyFactor(accessCount: number): number {
    if (accessCount <= 0) return 0.5 // Default score for never accessed

    // Logarithmic scale: log2(accesses + 1), capped at reasonable maximum
    return Math.min(3.0, Math.log2(accessCount + 1) / 2)
  }

  private calculateContextFactor(
    item: { id: string; type: 'page' | 'note' | 'task'; tags?: string[]; tasks?: string[] },
    context?: {
      activeTask?: string
      recentTags?: string[]
      query?: string
    }
  ): number {
    let factor = 1.0

    // Active task relevance boost
    if (context?.activeTask && item.tasks?.includes(context.activeTask)) {
      factor *= 1.5
    }

    // Recent tags overlap boost
    if (context?.recentTags && item.tags) {
      const overlap = item.tags.filter(tag => context.recentTags!.includes(tag)).length
      factor *= (1 + overlap * 0.2)
    }

    // Current task context boost
    if (this.contextStats.activeTask && item.tasks?.includes(this.contextStats.activeTask)) {
      factor *= 1.3
    }

    // Recent page context boost
    if (item.type === 'page' && this.contextStats.recentPages.includes(item.id)) {
      const position = this.contextStats.recentPages.indexOf(item.id)
      factor *= (1 + (20 - position) * 0.02) // Boost based on recency
    }

    return factor
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['analyticsHistory', 'analyticsStats', 'analyticsContext'])

      if (result.analyticsHistory) {
        this.accessHistory = result.analyticsHistory.map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp)
        }))
      }

      if (result.analyticsStats) {
        this.usageStats = new Map(result.analyticsStats.map(([key, stats]: [string, any]) => [
          key,
          {
            ...stats,
            lastAccess: new Date(stats.lastAccess),
            firstAccess: new Date(stats.firstAccess)
          }
        ]))
      }

      if (result.analyticsContext) {
        this.contextStats = {
          ...result.analyticsContext,
          sessionStartTime: new Date(result.analyticsContext.sessionStartTime)
        }
      }
    } catch (error) {
      console.warn('Failed to load analytics data:', error)
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.local.set({
        analyticsHistory: this.accessHistory,
        analyticsStats: Array.from(this.usageStats.entries()),
        analyticsContext: this.contextStats
      })
    } catch (error) {
      console.warn('Failed to save analytics data:', error)
    }
  }
}