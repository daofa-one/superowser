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

export class SearchUseCases {
  constructor(
    private pageService: IPageService,
    private noteService: INoteService,
    private taskService: ITaskService,
    private searchService: ISearchService,
    private taskUseCases: TaskUseCases
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

    // !notes query - search within notes
    if (trimmed.startsWith('!notes ')) {
      const query = trimmed.slice(7)
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

    // Regular fuzzy search
    if (trimmed) {
      const query: SearchQuery = {
        query: trimmed,
        type: 'all',
        limit: 20
      }
      const results = await this.searchService.search(query)
      return { type: 'search', results }
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
  }> {
    const query = partialQuery.toLowerCase()

    // Get all pages and extract unique values
    const [pages, tasks] = await Promise.all([
      this.pageService.getAll(1000), // Get a large sample
      this.taskService.getAll()
    ])

    const shortcuts = pages
      .filter(p => p.shortcut && p.shortcut.toLowerCase().includes(query))
      .sort((a, b) => {
        // Prioritize starts-with matches over contains matches
        const aStarts = a.shortcut!.toLowerCase().startsWith(query);
        const bStarts = b.shortcut!.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.shortcut!.localeCompare(b.shortcut!);
      })
      .slice(0, 10)
      .map(p => ({ shortcut: p.shortcut!, page: p }))

    // Group pages by tags and get unique tags with their pages
    const tagGroups = new Map<string, any[]>();
    pages.forEach(page => {
      page.tags.forEach((tag: string) => {
        if (tag.toLowerCase().includes(query)) {
          if (!tagGroups.has(tag)) {
            tagGroups.set(tag, []);
          }
          tagGroups.get(tag)!.push(page);
        }
      });
    });

    const tags = Array.from(tagGroups.entries())
      .map(([tag, pages]) => ({ tag, pages }))
      .sort((a, b) => {
        // Prioritize starts-with matches over contains matches
        const aStarts = a.tag.toLowerCase().startsWith(query);
        const bStarts = b.tag.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.tag.localeCompare(b.tag);
      })
      .slice(0, 10)

    const normalizedQuery = query.trim()
    let taskNames: string[] = []

    if (!normalizedQuery) {
      taskNames = tasks
        .map(t => t.name)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 10)
    } else {
      taskNames = tasks
        .map(task => {
          const score = fuzzyMatchScore(task.name, normalizedQuery)
          return score === null ? null : { name: task.name, score }
        })
        .filter((match): match is { name: string; score: number } => match !== null)
        .sort((a, b) => {
          if (a.score === b.score) {
            const aStarts = a.name.toLowerCase().startsWith(normalizedQuery)
            const bStarts = b.name.toLowerCase().startsWith(normalizedQuery)
            if (aStarts && !bStarts) return -1
            if (!aStarts && bStarts) return 1
            return a.name.localeCompare(b.name)
          }
          return b.score - a.score
        })
        .slice(0, 10)
        .map(match => match.name)
    }

    return {
      shortcuts,
      tags,
      tasks: taskNames
    }
  }

  async getPopularTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const pages = await this.pageService.getAll(1000)
    const notes = await this.noteService.getByTags([]) // Get all notes

    const tagCounts = new Map<string, number>()

    // Count tags from pages
    pages.forEach(page => {
      page.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    // Count tags from notes
    notes.forEach(note => {
      note.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}
