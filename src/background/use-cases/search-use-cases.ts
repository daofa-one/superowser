// Use cases for search-related business logic

import {
  SearchQuery,
  SearchResult,
  TaskEntry
} from '../../shared/models'
import {
  IPageService,
  INoteService,
  ITaskService,
  ISearchService
} from '../../shared/services/interfaces'
import { fuzzyMatchScore } from '../../shared/utils'
import { TaskUseCases } from './task-use-cases'
import { FuzzySearchService } from '../services/fuzzy-search-service'
import { AnalyticsService } from '../services/analytics-service'
import { MLService, PredictiveContext } from '../services/ml-service'

export class SearchUseCases {
  constructor(
    private pageService: IPageService,
    private noteService: INoteService,
    private taskService: ITaskService,
    private searchService: ISearchService,
    private taskUseCases: TaskUseCases,
    private fuzzySearchService: FuzzySearchService,
    private analyticsService: AnalyticsService,
    private mlService: MLService
  ) {}

  async executeOmniboxCommand(input: string): Promise<{
    type: 'open' | 'search' | 'filter' | 'error' | 'task-activate'
    results?: SearchResult[]
    page?: any
    message?: string
    task?: TaskEntry
  }> {
    // Parse omnibox syntax
    const trimmed = input.trim()

    // @shortcut - open saved page
    if (trimmed.startsWith('@')) {
      const shortcut = trimmed.slice(1)
      const page = await this.pageService.getByShortcut(shortcut)
      if (page) {
        // Record analytics for shortcut access
        this.analyticsService.recordAccess({
          id: page.id,
          type: 'page',
          source: 'omnibox',
          query: input,
          context: {
            activeTask: this.analyticsService.getCurrentContext().activeTask
          }
        })
        return { type: 'open', page }
      } else {
        return { type: 'error', message: `No page found with shortcut @${shortcut}` }
      }
    }

    // #tag - filter by tag
    if (trimmed.startsWith('#')) {
      const tag = trimmed.slice(1)
      const pages = await this.pageService.getByTags([tag])
      const results = pages.map(page => ({
        type: 'page' as const,
        id: page.id,
        title: page.title,
        snippet: page.url,
        score: 1,
        tags: page.tags,
        shortcut: page.shortcut,
        tasks: page.tasks
      }))
      return { type: 'filter', results }
    }

    // &task - show task group
    if (trimmed.startsWith('&')) {
      const taskQuery = trimmed.slice(1).trim()
      if (!taskQuery) {
        return { type: 'error', message: 'Please provide a task name after &.' }
      }

      const allTasks = await this.taskService.getAll()
      const exactMatch = allTasks.find(
        task => task.name.toLowerCase() === taskQuery.toLowerCase()
      )

      let targetTask: TaskEntry | undefined = exactMatch

      if (!targetTask) {
        const bestMatch = allTasks
          .map((task: TaskEntry) => {
            const score = fuzzyMatchScore(task.name, taskQuery)
            return score === null ? null : { task, score }
          })
          .filter((match): match is { task: TaskEntry; score: number } => match !== null)
          .sort((a, b) => {
            if (a.score === b.score) {
              return a.task.name.localeCompare(b.task.name)
            }
            return b.score - a.score
          })[0]

        targetTask = bestMatch?.task
      }

      if (!targetTask) {
        // Create a new active task if none matched
        const createdTask = await this.taskUseCases.setActiveTask(taskQuery)
        const [createdPages, createdNotes] = await Promise.all([
          this.pageService.getByTask(createdTask.name),
          this.noteService.getByTask(createdTask.name)
        ])

        const createdResults: SearchResult[] = [
          ...createdPages.map(page => ({
            type: 'page' as const,
            id: page.id,
            title: page.title,
            snippet: page.url,
            score: 1,
            tags: page.tags,
            shortcut: page.shortcut,
            tasks: page.tasks
          })),
          ...createdNotes.map(note => ({
            type: 'note' as const,
            id: note.id,
            title: note.content.slice(0, 50) + '...',
            snippet: note.comment || '',
            score: 1,
            tags: note.tags,
            tasks: note.tasks
          }))
        ]

        return {
          type: 'task-activate',
          results: createdResults,
          task: createdTask
        }
      }

      const activeTask = await this.taskUseCases.setActiveTask(targetTask.name)

      // Record analytics for task activation
      this.analyticsService.recordAccess({
        id: activeTask.id,
        type: 'task',
        source: 'omnibox',
        query: input,
        context: {
          activeTask: activeTask.name
        }
      })

      // Update analytics context with new active task
      this.analyticsService.setActiveTask(activeTask.name)

      const [pages, notes] = await Promise.all([
        this.pageService.getByTask(activeTask.name),
        this.noteService.getByTask(activeTask.name)
      ])

      const results: SearchResult[] = [
        ...pages.map(page => ({
          type: 'page' as const,
          id: page.id,
          title: page.title,
          snippet: page.url,
          score: 1,
          tags: page.tags,
          shortcut: page.shortcut,
          tasks: page.tasks
        })),
        ...notes.map(note => ({
          type: 'note' as const,
          id: note.id,
          title: note.content.slice(0, 50) + '...',
          snippet: note.comment || '',
          score: 1,
          tags: note.tags,
          tasks: note.tasks
        }))
      ]

      return { type: 'task-activate', results, task: activeTask }
    }

    // !notes query or !!query - search within notes
    if (trimmed.startsWith('!!') || trimmed.startsWith('!notes ')) {
      let query: string
      if (trimmed.startsWith('!!')) {
        query = trimmed.slice(2).trim()
      } else {
        query = trimmed.slice(7) // '!notes '
      }

      // Check if this is a specific note selection (contains #noteId)
      const noteIdMatch = query.match(/^(.+)#([^#]+)$/)
      if (noteIdMatch) {
        const [, searchQuery, noteId] = noteIdMatch
        // Return the specific note as a single result
        const note = await this.noteService.getById(noteId)
        if (note) {
          return {
            type: 'search',
            results: [{
              type: 'note' as const,
              id: note.id,
              title: note.content.slice(0, 50) + '...',
              snippet: note.comment || '',
              score: 1,
              tags: note.tags,
              tasks: note.tasks
            }]
          }
        }
        // Fall back to search if note not found
        query = searchQuery
      }

      const notes = await this.noteService.search(query)
      const results = notes.map(note => ({
        type: 'note' as const,
        id: note.id,
        title: note.content.slice(0, 50) + '...',
        snippet: note.comment || '',
        score: 1,
        tags: note.tags,
        tasks: note.tasks
      }))
      return { type: 'search', results }
    }

    if (trimmed) {
      const query: SearchQuery = {
        query: trimmed,
        type: 'all',
        limit: 20
      }

      const [combinedResults, fuzzyResults] = await Promise.all([
        this.searchService.search(query),
        this.searchService.fuzzySearch(trimmed, 20)
      ])

      const merged = new Map<string, SearchResult>()

      const upsert = (result: SearchResult) => {
        if (merged.has(result.id)) {
          const existing = merged.get(result.id)!
          merged.set(result.id, {
            ...existing,
            score: Math.max(existing.score, result.score)
          })
        } else {
          merged.set(result.id, result)
        }
      }

      combinedResults.forEach(upsert)
      fuzzyResults.forEach(upsert)

      const ranked = Array.from(merged.values()).sort((a, b) => b.score - a.score)
      return { type: 'search', results: ranked.slice(0, 20) }
    }

    return { type: 'error', message: 'Empty search query' }
  }

  async fuzzySearch(query: string, limit = 20): Promise<SearchResult[]> {
    return this.searchService.fuzzySearch(query, limit)
  }

  async searchByContext(query: string, context: {
    currentUrl?: string
    activeTask?: string
    recentTags?: string[]
  }): Promise<SearchResult[]> {
    // Context-aware search that prioritizes relevant results
    const baseResults = await this.fuzzySearch(query)

    // Score boost based on context
    const scoredResults = baseResults.map(result => {
      let contextScore = result.score

      // Boost if same task as active task
      if (context.activeTask && result.tasks.includes(context.activeTask)) {
        contextScore += 0.3
      }

      // Boost if contains recent tags
      if (context.recentTags) {
        const commonTags = result.tags.filter(tag =>
          context.recentTags!.includes(tag)
        ).length
        contextScore += commonTags * 0.1
      }

      return { ...result, score: contextScore }
    })

    // Sort by enhanced score
    return scoredResults.sort((a, b) => b.score - a.score)
  }

  async getSearchSuggestions(partialQuery: string): Promise<{
    shortcuts: Array<{ shortcut: string; page: any }>
    tags: Array<{ tag: string; pages: any[] }>
    tasks: string[]
    pages: Array<{ page: any; score: number }>
    notes: Array<{ note: any; score: number }>
  }> {
    try {
      const rawInput = (partialQuery ?? '').trim()
      const lowerInput = rawInput.toLowerCase()
      const normalizedQuery = lowerInput.startsWith('@') || lowerInput.startsWith('#') || lowerInput.startsWith('&')
        ? lowerInput.slice(1)
        : lowerInput

      // Get all pages, tasks, and notes and extract unique values
      const [pagesRaw, tasksRaw, notesRaw] = await Promise.all([
        this.pageService.getAll(1000), // Get a large sample
        this.taskService.getAll(),
        this.noteService.getAll(1000) // Get all notes
      ])

      const pages = Array.isArray(pagesRaw) ? pagesRaw : []
      const tasks = Array.isArray(tasksRaw) ? tasksRaw : []
      const allNotes = Array.isArray(notesRaw) ? notesRaw : []

      // Update fuzzy search indices with current data
      this.fuzzySearchService.updatePageIndex(pages)
      this.fuzzySearchService.updateNoteIndex(allNotes)
      this.fuzzySearchService.updateTaskIndex(tasks)

      // Update ML content features for enhanced intelligence
      await this.updateMLFeatures(pages, allNotes, tasks)

      const pageById = new Map<string, typeof pages[number]>()
      pages.forEach(page => {
        if (page?.id) {
          pageById.set(page.id, page)
        }
      })

      const lowerQuery = normalizedQuery

      // Get current context for priority scoring
      const currentContext = this.analyticsService.getCurrentContext()
      const searchContext = {
        activeTask: currentContext.activeTask,
        recentTags: currentContext.recentTags,
        query: lowerQuery
      }

      // Get shortcuts using Fuse.js with priority scoring
      let shortcuts = lowerQuery
        ? this.fuzzySearchService.searchShortcuts(lowerQuery, 10)
        : pages
            .filter(p => p.shortcut)
            .sort((a, b) => a.shortcut!.localeCompare(b.shortcut!))
            .slice(0, 10)
            .map(p => ({ shortcut: p.shortcut!, page: p, score: 1 }))

      // Apply priority scoring to shortcuts
      shortcuts = shortcuts.map(item => ({
        ...item,
        priorityScore: this.analyticsService.calculatePriorityScore(
          { id: item.page.id, type: 'page', tags: item.page.tags, tasks: item.page.tasks },
          item.score,
          searchContext
        )
      })).sort((a, b) => b.priorityScore - a.priorityScore)

      const shortcutPageIds = new Set(shortcuts.map(entry => entry.page.id))

      // Get page matches using Fuse.js with priority scoring
      let pageMatches = lowerQuery
        ? this.fuzzySearchService.searchPages(lowerQuery, 20)
            .filter(match => !shortcutPageIds.has(match.page.id))
        : pages
            .filter(page => !shortcutPageIds.has(page.id))
            .slice(0, 20)
            .map(page => ({ page, score: 1 }))

      // Apply priority scoring to pages
      pageMatches = pageMatches.map(match => ({
        ...match,
        priorityScore: this.analyticsService.calculatePriorityScore(
          { id: match.page.id, type: 'page', tags: match.page.tags, tasks: match.page.tasks },
          match.score,
          searchContext
        )
      })).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10)

      // Search notes using Fuse.js with priority scoring
      let noteMatches = lowerQuery
        ? this.fuzzySearchService.searchNotes(lowerQuery, 20)
        : allNotes.slice(0, 20).map(note => ({ note, score: 1 }))

      // Apply priority scoring to notes
      noteMatches = noteMatches.map(match => ({
        ...match,
        priorityScore: this.analyticsService.calculatePriorityScore(
          { id: match.note.id, type: 'note', tags: match.note.tags, tasks: match.note.tasks },
          match.score,
          searchContext
        )
      })).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10)

      // Search tags using Fuse.js
      const tags = lowerQuery
        ? this.fuzzySearchService.searchTags(lowerQuery, pages, 10)
        : (() => {
            // Get all unique tags when no query
            const tagSet = new Set<string>()
            pages.forEach(page => {
              if (Array.isArray(page.tags)) {
                page.tags.forEach(tag => tagSet.add(tag))
              }
            })
            return Array.from(tagSet)
              .sort((a, b) => a.localeCompare(b))
              .slice(0, 10)
              .map(tag => ({
                tag,
                pages: pages.filter(page => page.tags.includes(tag)),
                score: 1
              }))
          })()

      // Search tasks using Fuse.js with priority scoring
      const taskMatches = lowerQuery
        ? this.fuzzySearchService.searchTasks(lowerQuery, 20)
        : tasks.slice(0, 20).map(task => ({ task, score: 1 }))

      // Apply priority scoring to tasks
      const prioritizedTasks = taskMatches.map(match => ({
        ...match,
        priorityScore: this.analyticsService.calculatePriorityScore(
          { id: match.task.id, type: 'task' },
          match.score,
          searchContext
        )
      })).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10)

      const taskNames = prioritizedTasks.map(match => match.task.name)

      // Get ML-enhanced suggestions and predictions
      const mlEnhancedResults = await this.getMLEnhancedSuggestions(
        lowerQuery,
        { shortcuts, tags, tasks: taskNames, pages: pageMatches, notes: noteMatches },
        searchContext
      )

      return mlEnhancedResults
    } catch (error) {
      console.error('Error in getSearchSuggestions:', error)
      return {
        shortcuts: [],
        tags: [],
        tasks: [],
        pages: [],
        notes: []
      }
    }
  }

  async getPopularTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const pages = await this.pageService.getAll(1000)

    const tagCounts = new Map<string, number>()

    // Count tags from pages only (notes no longer have tags after v3 migration)
    pages.forEach(page => {
      page.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Update ML features for content items
   */
  private async updateMLFeatures(pages: any[], notes: any[], tasks: any[]): Promise<void> {
    const currentTime = new Date()
    const sessionInfo = {
      sessionLength: 30, // Default session length in minutes
      timeOfDay: currentTime.getHours(),
      dayOfWeek: currentTime.getDay()
    }

    // Update features for pages
    for (const page of pages) {
      await this.mlService.updateContentFeatures({
        id: page.id,
        type: 'page',
        title: page.title,
        content: page.url, // Use URL as content for pages
        tags: page.tags
      }, sessionInfo)
    }

    // Update features for notes
    for (const note of notes) {
      await this.mlService.updateContentFeatures({
        id: note.id,
        type: 'note',
        title: note.content.slice(0, 100), // First 100 chars as title
        content: note.content,
        tags: note.tags
      }, sessionInfo)
    }

    // Update features for tasks
    for (const task of tasks) {
      await this.mlService.updateContentFeatures({
        id: task.id,
        type: 'task',
        title: task.name,
        content: task.description,
        tags: []
      }, sessionInfo)
    }
  }

  /**
   * Get ML-enhanced search suggestions with predictions
   */
  private async getMLEnhancedSuggestions(
    query: string,
    baseResults: {
      shortcuts: any[]
      tags: any[]
      tasks: string[]
      pages: any[]
      notes: any[]
    },
    searchContext: any
  ): Promise<{
    shortcuts: any[]
    tags: any[]
    tasks: string[]
    pages: any[]
    notes: any[]
    predictions?: Array<{
      id: string
      type: 'page' | 'note' | 'task'
      title: string
      confidence: number
      reasoning: string
      category: 'predictive' | 'similar' | 'temporal' | 'behavioral'
    }>
  }> {
    try {
      // Create predictive context
      const predictiveContext: PredictiveContext = {
        currentTime: new Date(),
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours(),
        activeTask: searchContext.activeTask,
        recentQueries: searchContext.query ? [searchContext.query] : [],
        recentAccesses: [], // Could be populated from analytics
        sessionDuration: 30 // Default session duration
      }

      // Get ML-powered predictive suggestions
      const predictions = await this.mlService.getPredictiveSuggestions(predictiveContext, 3)

      // Enhance base results with ML scores if we have a query
      if (query) {
        const enhancedPages = await this.enhanceWithMLScores(baseResults.pages, query, predictiveContext, 'page')
        const enhancedNotes = await this.enhanceWithMLScores(baseResults.notes, query, predictiveContext, 'note')

        baseResults.pages = enhancedPages
        baseResults.notes = enhancedNotes
      }

      // Convert ML predictions to UI format
      const formattedPredictions = await this.formatPredictions(predictions)

      return {
        ...baseResults,
        predictions: formattedPredictions
      }
    } catch (error) {
      console.warn('Failed to get ML-enhanced suggestions:', error)
      return baseResults
    }
  }

  /**
   * Enhance search results with ML scores
   */
  private async enhanceWithMLScores(
    results: any[],
    query: string,
    context: PredictiveContext,
    type: 'page' | 'note'
  ): Promise<any[]> {
    if (!results || results.length === 0) return results

    try {
      const baseResults = results.map(result => ({
        id: result[type].id,
        type,
        score: result.priorityScore || result.score || 1
      }))

      const enhanced = await this.mlService.enhanceSearchResults(query, baseResults, context)

      // Map back to original format with ML boost
      return results.map((result, index) => {
        const enhancedResult = enhanced[index]
        return {
          ...result,
          mlBoost: enhancedResult?.mlBoost || 0,
          finalScore: enhancedResult?.score || result.priorityScore || result.score || 1
        }
      }).sort((a, b) => b.finalScore - a.finalScore)
    } catch (error) {
      console.warn('Failed to enhance results with ML scores:', error)
      return results
    }
  }

  /**
   * Format ML predictions for UI consumption
   */
  private async formatPredictions(predictions: Array<{
    id: string
    type: 'page' | 'note' | 'task'
    confidence: number
    reasoning: string
    predictedAction: 'access' | 'search' | 'create'
  }>): Promise<Array<{
    id: string
    type: 'page' | 'note' | 'task'
    title: string
    confidence: number
    reasoning: string
    category: 'predictive' | 'similar' | 'temporal' | 'behavioral'
  }>> {
    const formatted = []

    for (const prediction of predictions) {
      try {
        let title = 'Unknown'
        let category: 'predictive' | 'similar' | 'temporal' | 'behavioral' = 'predictive'

        // Get title based on type
        if (prediction.type === 'page') {
          const page = await this.pageService.getById(prediction.id)
          title = page?.title || 'Unknown Page'
        } else if (prediction.type === 'note') {
          const note = await this.noteService.getById(prediction.id)
          title = note?.content.slice(0, 50) + '...' || 'Unknown Note'
        } else if (prediction.type === 'task') {
          const task = await this.taskService.getById(prediction.id)
          title = task?.name || 'Unknown Task'
        }

        // Categorize prediction based on reasoning
        if (prediction.reasoning.includes('Pattern')) {
          category = 'behavioral'
        } else if (prediction.reasoning.includes('time')) {
          category = 'temporal'
        } else if (prediction.reasoning.includes('Similar')) {
          category = 'similar'
        }

        formatted.push({
          id: prediction.id,
          type: prediction.type,
          title,
          confidence: Math.round(prediction.confidence * 100) / 100,
          reasoning: prediction.reasoning,
          category
        })
      } catch (error) {
        console.warn(`Failed to format prediction for ${prediction.type}:${prediction.id}:`, error)
      }
    }

    return formatted
  }
}
