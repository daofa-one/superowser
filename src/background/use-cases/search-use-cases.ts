// Use cases for search-related business logic

import {
  SearchQuery,
  SearchResult
} from '../../shared/models'
import {
  IPageService,
  INoteService,
  ITaskService,
  ISearchService
} from '../../shared/services/interfaces'

export class SearchUseCases {
  constructor(
    private pageService: IPageService,
    private noteService: INoteService,
    private taskService: ITaskService,
    private searchService: ISearchService
  ) {}

  async executeOmniboxCommand(input: string): Promise<{
    type: 'open' | 'search' | 'filter' | 'error'
    results?: SearchResult[]
    page?: any
    message?: string
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
        task: page.task
      }))
      return { type: 'filter', results }
    }

    // &task - show task group
    if (trimmed.startsWith('&')) {
      const taskName = trimmed.slice(1)
      const [pages, notes] = await Promise.all([
        this.pageService.getByTask(taskName),
        this.noteService.getByTask(taskName)
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
          task: page.task
        })),
        ...notes.map(note => ({
          type: 'note' as const,
          id: note.id,
          title: note.content.slice(0, 50) + '...',
          snippet: note.comment || '',
          score: 1,
          tags: note.tags,
          task: note.task
        }))
      ]

      return { type: 'filter', results }
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
        task: note.task
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
      if (context.activeTask && result.task === context.activeTask) {
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

    const taskNames = tasks
      .filter(t => t.name.toLowerCase().includes(query))
      .map(t => t.name)
      .sort((a, b) => {
        // Prioritize starts-with matches over contains matches
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 10)

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