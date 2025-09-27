// ML service for predictive search and behavioral pattern recognition

export interface ContentFeatures {
  id: string
  type: 'page' | 'note' | 'task'

  // Text features
  titleVector: number[]
  contentVector: number[]
  tagVector: number[]

  // Behavioral features
  accessCount: number
  lastAccess: Date
  averageSessionLength: number

  // Temporal features
  preferredTimeSlots: number[] // 24-hour slots
  preferredDayOfWeek: number[] // 0-6 for Sun-Sat

  // Context features
  coOccurringTasks: string[]
  relatedItems: string[]
}

export interface BehavioralPattern {
  id: string
  name: string
  confidence: number

  // Pattern characteristics
  triggerConditions: {
    timeOfDay?: [number, number] // [start, end] hours
    dayOfWeek?: number[]
    activeTask?: string
    recentTags?: string[]
    queryPattern?: string
  }

  // Predicted actions
  predictedItems: Array<{
    id: string
    type: 'page' | 'note' | 'task'
    probability: number
    reasoning: string
  }>

  // Pattern metadata
  occurrences: number
  lastSeen: Date
  accuracy: number // Historical prediction accuracy
}

export interface PredictiveContext {
  currentTime: Date
  dayOfWeek: number
  hourOfDay: number
  activeTask?: string
  recentQueries: string[]
  recentAccesses: string[]
  sessionDuration: number
}

export class MLService {
  private contentFeatures: Map<string, ContentFeatures> = new Map()
  private behavioralPatterns: Map<string, BehavioralPattern> = new Map()
  private queryEmbeddings: Map<string, number[]> = new Map()

  // Simple vocabulary for text vectorization
  private vocabulary: Map<string, number> = new Map()
  private vocabularySize = 1000 // Limit vocabulary size for performance

  // Pattern recognition thresholds
  private readonly MIN_PATTERN_OCCURRENCES = 3
  private readonly MIN_PATTERN_CONFIDENCE = 0.6
  private readonly VECTOR_DIMENSIONS = 100

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Extract and update features for content items
   */
  async updateContentFeatures(
    item: { id: string; type: 'page' | 'note' | 'task'; title?: string; content?: string; tags?: string[] },
    accessInfo?: { sessionLength?: number; timeOfDay?: number; dayOfWeek?: number }
  ): Promise<void> {
    const key = `${item.type}:${item.id}`
    const existing = this.contentFeatures.get(key)

    // Extract text features
    const titleVector = this.textToVector(item.title || '')
    const contentVector = this.textToVector(item.content || '')
    const tagVector = this.textToVector((item.tags || []).join(' '))

    // Update or create features
    const features: ContentFeatures = {
      id: item.id,
      type: item.type,
      titleVector,
      contentVector,
      tagVector,
      accessCount: (existing?.accessCount || 0) + 1,
      lastAccess: new Date(),
      averageSessionLength: this.updateAverage(
        existing?.averageSessionLength || 0,
        accessInfo?.sessionLength || 0,
        existing?.accessCount || 0
      ),
      preferredTimeSlots: this.updateTemporalPattern(
        existing?.preferredTimeSlots || new Array(24).fill(0),
        accessInfo?.timeOfDay || new Date().getHours()
      ),
      preferredDayOfWeek: this.updateTemporalPattern(
        existing?.preferredDayOfWeek || new Array(7).fill(0),
        accessInfo?.dayOfWeek || new Date().getDay()
      ),
      coOccurringTasks: existing?.coOccurringTasks || [],
      relatedItems: existing?.relatedItems || []
    }

    this.contentFeatures.set(key, features)
    this.saveToStorage()
  }

  /**
   * Analyze behavioral patterns and create/update pattern recognition
   */
  async analyzeBehavioralPatterns(accessSequence: Array<{
    id: string
    type: 'page' | 'note' | 'task'
    timestamp: Date
    query?: string
    context?: PredictiveContext
  }>): Promise<void> {
    // Group accesses by time windows (30-minute windows)
    const timeWindows = this.groupByTimeWindows(accessSequence, 30)

    for (const window of timeWindows) {
      if (window.length < 2) continue // Need at least 2 items for a pattern

      // Extract pattern features
      const pattern = this.extractPattern(window)
      if (pattern && pattern.confidence >= this.MIN_PATTERN_CONFIDENCE) {
        await this.updateBehavioralPattern(pattern)
      }
    }
  }

  /**
   * Generate predictive suggestions based on current context
   */
  async getPredictiveSuggestions(context: PredictiveContext, limit = 5): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>> {
    const suggestions: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      confidence: number
      reasoning: string
      predictedAction: 'access' | 'search' | 'create'
    }> = []

    // 1. Pattern-based predictions
    const patternSuggestions = await this.getPatternBasedSuggestions(context)
    suggestions.push(...patternSuggestions)

    // 2. Temporal pattern predictions
    const temporalSuggestions = await this.getTemporalSuggestions(context)
    suggestions.push(...temporalSuggestions)

    // 3. Content similarity predictions
    const similaritySuggestions = await this.getSimilarityBasedSuggestions(context)
    suggestions.push(...similaritySuggestions)

    // 4. Task continuation predictions
    const taskSuggestions = await this.getTaskContinuationSuggestions(context)
    suggestions.push(...taskSuggestions)

    // Deduplicate and rank by confidence
    const uniqueSuggestions = this.deduplicateAndRank(suggestions)

    return uniqueSuggestions.slice(0, limit)
  }

  /**
   * Learn from user feedback to improve predictions
   */
  async learnFromFeedback(
    suggestion: { id: string; type: 'page' | 'note' | 'task' },
    context: PredictiveContext,
    outcome: 'accepted' | 'rejected' | 'modified'
  ): Promise<void> {
    // Update pattern accuracy based on feedback
    const relevantPatterns = this.findRelevantPatterns(context)

    for (const pattern of relevantPatterns) {
      const predicted = pattern.predictedItems.find(
        item => item.id === suggestion.id && item.type === suggestion.type
      )

      if (predicted) {
        // Update accuracy based on outcome
        const success = outcome === 'accepted' ? 1 : 0
        pattern.accuracy = this.updateAverage(pattern.accuracy, success, pattern.occurrences)

        // Adjust confidence based on feedback
        if (outcome === 'accepted') {
          predicted.probability = Math.min(1.0, predicted.probability * 1.1)
        } else {
          predicted.probability = Math.max(0.1, predicted.probability * 0.9)
        }
      }
    }

    await this.saveToStorage()
  }

  /**
   * Analyze content semantic similarity
   */
  calculateContentSimilarity(
    item1: { id: string; type: 'page' | 'note' | 'task' },
    item2: { id: string; type: 'page' | 'note' | 'task' }
  ): number {
    const features1 = this.contentFeatures.get(`${item1.type}:${item1.id}`)
    const features2 = this.contentFeatures.get(`${item2.type}:${item2.id}`)

    if (!features1 || !features2) return 0

    // Calculate weighted similarity across different feature vectors
    const titleSim = this.cosineSimilarity(features1.titleVector, features2.titleVector)
    const contentSim = this.cosineSimilarity(features1.contentVector, features2.contentVector)
    const tagSim = this.cosineSimilarity(features1.tagVector, features2.tagVector)

    // Weighted combination (title is most important for search)
    return (titleSim * 0.5) + (contentSim * 0.3) + (tagSim * 0.2)
  }

  /**
   * Get ML-enhanced search rankings
   */
  async enhanceSearchResults(
    query: string,
    baseResults: Array<{ id: string; type: 'page' | 'note' | 'task'; score: number }>,
    context: PredictiveContext
  ): Promise<Array<{ id: string; type: 'page' | 'note' | 'task'; score: number; mlBoost: number }>> {
    const queryVector = this.textToVector(query)
    this.queryEmbeddings.set(query, queryVector)

    return baseResults.map(result => {
      const features = this.contentFeatures.get(`${result.type}:${result.id}`)

      let mlBoost = 0

      if (features) {
        // Content semantic similarity boost
        const semanticSim = (
          this.cosineSimilarity(queryVector, features.titleVector) * 0.4 +
          this.cosineSimilarity(queryVector, features.contentVector) * 0.3 +
          this.cosineSimilarity(queryVector, features.tagVector) * 0.3
        )
        mlBoost += semanticSim * 0.3

        // Temporal pattern boost
        const timeBoost = this.getTemporalBoost(features, context)
        mlBoost += timeBoost * 0.2

        // Behavioral pattern boost
        const patternBoost = this.getBehavioralBoost(result, context)
        mlBoost += patternBoost * 0.3

        // Personal preference boost
        const personalBoost = Math.min(1.0, features.accessCount / 10) // Normalize access count
        mlBoost += personalBoost * 0.2
      }

      return {
        ...result,
        score: result.score + mlBoost,
        mlBoost
      }
    }).sort((a, b) => b.score - a.score)
  }

  // Private helper methods

  private textToVector(text: string): number[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)

    // Update vocabulary with new words
    for (const word of words) {
      if (!this.vocabulary.has(word) && this.vocabulary.size < this.vocabularySize) {
        this.vocabulary.set(word, this.vocabulary.size)
      }
    }

    // Create TF-IDF-like vector
    const vector = new Array(this.VECTOR_DIMENSIONS).fill(0)
    const wordCounts = new Map<string, number>()

    // Count word frequencies
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    }

    // Fill vector based on vocabulary indices
    for (const [word, count] of wordCounts) {
      const index = this.vocabulary.get(word)
      if (index !== undefined && index < this.VECTOR_DIMENSIONS) {
        vector[index] = count / words.length // Term frequency
      }
    }

    return vector
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    if (norm1 === 0 || norm2 === 0) return 0
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    if (count === 0) return newValue
    return (currentAvg * count + newValue) / (count + 1)
  }

  private updateTemporalPattern(pattern: number[], timeSlot: number): number[] {
    const updated = [...pattern]
    if (timeSlot >= 0 && timeSlot < pattern.length) {
      updated[timeSlot] += 1
    }
    return updated
  }

  private groupByTimeWindows(
    sequence: Array<{ timestamp: Date; [key: string]: any }>,
    windowMinutes: number
  ): Array<Array<{ timestamp: Date; [key: string]: any }>> {
    const windows: Array<Array<{ timestamp: Date; [key: string]: any }>> = []
    const sorted = sequence.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    let currentWindow: Array<{ timestamp: Date; [key: string]: any }> = []
    let windowStart: Date | null = null

    for (const item of sorted) {
      if (!windowStart || item.timestamp.getTime() - windowStart.getTime() > windowMinutes * 60 * 1000) {
        if (currentWindow.length > 0) {
          windows.push(currentWindow)
        }
        currentWindow = [item]
        windowStart = item.timestamp
      } else {
        currentWindow.push(item)
      }
    }

    if (currentWindow.length > 0) {
      windows.push(currentWindow)
    }

    return windows
  }

  private extractPattern(window: Array<{
    id: string
    type: 'page' | 'note' | 'task'
    timestamp: Date
    query?: string
    context?: PredictiveContext
  }>): BehavioralPattern | null {
    if (window.length < 2) return null

    const firstItem = window[0]
    const context = firstItem.context

    if (!context) return null

    // Create pattern ID based on context
    const patternId = this.createPatternId(context)
    const existing = this.behavioralPatterns.get(patternId)

    // Extract predicted items from the sequence
    const predictedItems = window.slice(1).map((item, index) => ({
      id: item.id,
      type: item.type,
      probability: 1.0 - (index * 0.1), // Decreasing probability for later items
      reasoning: `Often accessed after ${window[0].type}:${window[0].id}`
    }))

    const pattern: BehavioralPattern = {
      id: patternId,
      name: `Pattern for ${context.activeTask || 'general usage'}`,
      confidence: this.calculatePatternConfidence(window),
      triggerConditions: {
        timeOfDay: [context.hourOfDay - 1, context.hourOfDay + 1],
        dayOfWeek: [context.dayOfWeek],
        activeTask: context.activeTask,
        recentTags: [], // Could be extracted from context
        queryPattern: firstItem.query
      },
      predictedItems,
      occurrences: (existing?.occurrences || 0) + 1,
      lastSeen: new Date(),
      accuracy: existing?.accuracy || 0.5
    }

    return pattern
  }

  private createPatternId(context: PredictiveContext): string {
    const parts = [
      `h${context.hourOfDay}`,
      `d${context.dayOfWeek}`,
      context.activeTask ? `t${context.activeTask}` : 'general'
    ]
    return parts.join('_')
  }

  private calculatePatternConfidence(window: Array<any>): number {
    // Simple confidence based on window size and timing consistency
    const baseConfidence = Math.min(0.9, window.length / 5)

    // Check timing consistency
    const intervals = []
    for (let i = 1; i < window.length; i++) {
      intervals.push(window[i].timestamp.getTime() - window[i-1].timestamp.getTime())
    }

    if (intervals.length > 1) {
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
      const consistency = 1 - Math.min(1, variance / (avgInterval * avgInterval))
      return baseConfidence * (0.5 + consistency * 0.5)
    }

    return baseConfidence
  }

  private async updateBehavioralPattern(pattern: BehavioralPattern): Promise<void> {
    const existing = this.behavioralPatterns.get(pattern.id)

    if (existing) {
      // Merge with existing pattern
      existing.occurrences = pattern.occurrences
      existing.lastSeen = pattern.lastSeen
      existing.confidence = this.updateAverage(existing.confidence, pattern.confidence, existing.occurrences - 1)

      // Update predicted items
      for (const newItem of pattern.predictedItems) {
        const existingItem = existing.predictedItems.find(
          item => item.id === newItem.id && item.type === newItem.type
        )
        if (existingItem) {
          existingItem.probability = this.updateAverage(existingItem.probability, newItem.probability, existing.occurrences - 1)
        } else {
          existing.predictedItems.push(newItem)
        }
      }
    } else {
      this.behavioralPatterns.set(pattern.id, pattern)
    }
  }

  private async getPatternBasedSuggestions(context: PredictiveContext): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>> {
    const suggestions: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      confidence: number
      reasoning: string
      predictedAction: 'access' | 'search' | 'create'
    }> = []

    for (const pattern of this.behavioralPatterns.values()) {
      if (this.patternMatchesContext(pattern, context)) {
        for (const prediction of pattern.predictedItems) {
          suggestions.push({
            id: prediction.id,
            type: prediction.type,
            confidence: prediction.probability * pattern.confidence * pattern.accuracy,
            reasoning: `Pattern: ${pattern.name} (${pattern.occurrences} occurrences, ${Math.round(pattern.accuracy * 100)}% accuracy)`,
            predictedAction: 'access'
          })
        }
      }
    }

    return suggestions
  }

  private async getTemporalSuggestions(context: PredictiveContext): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>> {
    const suggestions: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      confidence: number
      reasoning: string
      predictedAction: 'access' | 'search' | 'create'
    }> = []

    for (const [key, features] of this.contentFeatures) {
      const timeBoost = this.getTemporalBoost(features, context)

      if (timeBoost > 0.3) { // Only suggest items with significant temporal relevance
        const [type, id] = key.split(':')
        suggestions.push({
          id,
          type: type as 'page' | 'note' | 'task',
          confidence: timeBoost,
          reasoning: `Usually accessed at this time (${Math.round(timeBoost * 100)}% temporal match)`,
          predictedAction: 'access'
        })
      }
    }

    return suggestions
  }

  private async getSimilarityBasedSuggestions(context: PredictiveContext): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>> {
    const suggestions: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      confidence: number
      reasoning: string
      predictedAction: 'access' | 'search' | 'create'
    }> = []

    if (context.recentAccesses.length === 0) return suggestions

    // Find items similar to recently accessed content
    const recentItem = context.recentAccesses[0]
    const [recentType, recentId] = recentItem.split(':')

    for (const [key, features] of this.contentFeatures) {
      if (key === recentItem) continue // Skip the same item

      const similarity = this.calculateContentSimilarity(
        { id: recentId, type: recentType as 'page' | 'note' | 'task' },
        { id: features.id, type: features.type }
      )

      if (similarity > 0.4) { // Threshold for similarity suggestions
        suggestions.push({
          id: features.id,
          type: features.type,
          confidence: similarity,
          reasoning: `Similar to recently accessed ${recentType} (${Math.round(similarity * 100)}% similarity)`,
          predictedAction: 'access'
        })
      }
    }

    return suggestions
  }

  private async getTaskContinuationSuggestions(context: PredictiveContext): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>> {
    const suggestions: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      confidence: number
      reasoning: string
      predictedAction: 'access' | 'search' | 'create'
    }> = []

    if (!context.activeTask) return suggestions

    // Find items related to the active task
    for (const [key, features] of this.contentFeatures) {
      if (features.coOccurringTasks.includes(context.activeTask)) {
        const [type, id] = key.split(':')
        suggestions.push({
          id,
          type: type as 'page' | 'note' | 'task',
          confidence: 0.7,
          reasoning: `Related to active task: ${context.activeTask}`,
          predictedAction: 'access'
        })
      }
    }

    return suggestions
  }

  private deduplicateAndRank(suggestions: Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>): Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }> {
    const uniqueMap = new Map<string, typeof suggestions[0]>()

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}:${suggestion.id}`
      const existing = uniqueMap.get(key)

      if (!existing || suggestion.confidence > existing.confidence) {
        uniqueMap.set(key, suggestion)
      }
    }

    return Array.from(uniqueMap.values())
      .sort((a, b) => b.confidence - a.confidence)
  }

  private patternMatchesContext(pattern: BehavioralPattern, context: PredictiveContext): boolean {
    const conditions = pattern.triggerConditions

    // Check time of day
    if (conditions.timeOfDay) {
      const [start, end] = conditions.timeOfDay
      if (context.hourOfDay < start || context.hourOfDay > end) {
        return false
      }
    }

    // Check day of week
    if (conditions.dayOfWeek && !conditions.dayOfWeek.includes(context.dayOfWeek)) {
      return false
    }

    // Check active task
    if (conditions.activeTask && conditions.activeTask !== context.activeTask) {
      return false
    }

    return true
  }

  private findRelevantPatterns(context: PredictiveContext): BehavioralPattern[] {
    return Array.from(this.behavioralPatterns.values())
      .filter(pattern => this.patternMatchesContext(pattern, context))
  }

  private getTemporalBoost(features: ContentFeatures, context: PredictiveContext): number {
    const hourBoost = features.preferredTimeSlots[context.hourOfDay] || 0
    const dayBoost = features.preferredDayOfWeek[context.dayOfWeek] || 0

    // Normalize by total accesses to get probability
    const totalHourAccesses = features.preferredTimeSlots.reduce((a, b) => a + b, 0)
    const totalDayAccesses = features.preferredDayOfWeek.reduce((a, b) => a + b, 0)

    const hourProb = totalHourAccesses > 0 ? hourBoost / totalHourAccesses : 0
    const dayProb = totalDayAccesses > 0 ? dayBoost / totalDayAccesses : 0

    return (hourProb + dayProb) / 2
  }

  private getBehavioralBoost(
    result: { id: string; type: 'page' | 'note' | 'task' },
    context: PredictiveContext
  ): number {
    let boost = 0

    for (const pattern of this.behavioralPatterns.values()) {
      if (this.patternMatchesContext(pattern, context)) {
        const prediction = pattern.predictedItems.find(
          item => item.id === result.id && item.type === result.type
        )
        if (prediction) {
          boost = Math.max(boost, prediction.probability * pattern.confidence)
        }
      }
    }

    return boost
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['mlContentFeatures', 'mlBehavioralPatterns', 'mlVocabulary', 'mlQueryEmbeddings'])

      if (result.mlContentFeatures) {
        this.contentFeatures = new Map(result.mlContentFeatures.map(([key, features]: [string, any]) => [
          key,
          {
            ...features,
            lastAccess: new Date(features.lastAccess)
          }
        ]))
      }

      if (result.mlBehavioralPatterns) {
        this.behavioralPatterns = new Map(result.mlBehavioralPatterns.map(([key, pattern]: [string, any]) => [
          key,
          {
            ...pattern,
            lastSeen: new Date(pattern.lastSeen)
          }
        ]))
      }

      if (result.mlVocabulary) {
        this.vocabulary = new Map(result.mlVocabulary)
      }

      if (result.mlQueryEmbeddings) {
        this.queryEmbeddings = new Map(result.mlQueryEmbeddings)
      }
    } catch (error) {
      console.warn('Failed to load ML data:', error)
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.local.set({
        mlContentFeatures: Array.from(this.contentFeatures.entries()),
        mlBehavioralPatterns: Array.from(this.behavioralPatterns.entries()),
        mlVocabulary: Array.from(this.vocabulary.entries()),
        mlQueryEmbeddings: Array.from(this.queryEmbeddings.entries())
      })
    } catch (error) {
      console.warn('Failed to save ML data:', error)
    }
  }

  /**
   * Clean up old ML data for privacy and performance
   */
  async cleanupOldData(daysToKeep = 90): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Clean old content features
    for (const [key, features] of this.contentFeatures) {
      if (features.lastAccess < cutoffDate) {
        this.contentFeatures.delete(key)
      }
    }

    // Clean old behavioral patterns
    for (const [key, pattern] of this.behavioralPatterns) {
      if (pattern.lastSeen < cutoffDate) {
        this.behavioralPatterns.delete(key)
      }
    }

    await this.saveToStorage()
  }

  /**
   * Get ML insights for debugging and optimization
   */
  getMLInsights(): {
    contentFeatures: number
    behavioralPatterns: number
    vocabularySize: number
    topPatterns: Array<{ name: string; confidence: number; occurrences: number }>
    memoryUsage: string
  } {
    const topPatterns = Array.from(this.behavioralPatterns.values())
      .sort((a, b) => b.confidence * b.occurrences - a.confidence * a.occurrences)
      .slice(0, 5)
      .map(pattern => ({
        name: pattern.name,
        confidence: Math.round(pattern.confidence * 100) / 100,
        occurrences: pattern.occurrences
      }))

    // Estimate memory usage
    const featuresSize = this.contentFeatures.size * 1000 // ~1KB per feature estimate
    const patternsSize = this.behavioralPatterns.size * 500 // ~500B per pattern estimate
    const vocabSize = this.vocabulary.size * 50 // ~50B per vocab entry estimate
    const totalSize = featuresSize + patternsSize + vocabSize

    return {
      contentFeatures: this.contentFeatures.size,
      behavioralPatterns: this.behavioralPatterns.size,
      vocabularySize: this.vocabulary.size,
      topPatterns,
      memoryUsage: `${Math.round(totalSize / 1024)}KB`
    }
  }
}