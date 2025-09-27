// Dependency injection container for clean architecture

import {
  DexiePageService,
  DexieNoteService,
  DexieTaskService
} from './repositories/dexie-repository'

import {
  PageUseCases,
  TaskUseCases,
  SearchUseCases
} from './use-cases'
import { NotesUseCases } from './use-cases/notes-use-cases'

import {
  IPageService,
  INoteService,
  ITaskService,
  ISearchService
} from '../shared/services/interfaces'
import { fuzzyMatchScore } from '../shared/utils'
import { TaskEntry } from '../shared/models'
import { FuzzySearchService } from './services/fuzzy-search-service'
import { AnalyticsService } from './services/analytics-service'
import { MLService } from './services/ml-service'

// Simple search service implementation
class SearchService implements ISearchService {
  constructor(
    private pageService: IPageService,
    private noteService: INoteService,
    private taskService: ITaskService
  ) {}

  async search(query: any): Promise<any[]> {
    if (!query || typeof query.query !== 'string' || !query.query.trim()) {
      return []
    }

    const normalized = query.query.trim().toLowerCase()
    const terms = normalized.split(/\s+/).filter(Boolean)

    const [pageMatches, noteMatches, taskMatches] = await Promise.all([
      this.pageService.search(normalized),
      this.noteService.search(normalized),
      this.taskService.getAll()
    ])

    const pageResults = pageMatches.map(page => {
      const title = (page.title || '').toLowerCase()
      const url = page.url.toLowerCase()
      const shortcut = (page.shortcut || '').toLowerCase()
      const tags = page.tags.map(tag => tag.toLowerCase())

      let score = 1
      if (shortcut && shortcut.includes(normalized)) score += 1.5
      if (title.includes(normalized)) score += 1.2
      if (url.includes(normalized)) score += 1
      if (title.startsWith(normalized)) score += 1
      if (url.startsWith(normalized)) score += 0.5
      score += tags.filter(tag => tag.includes(normalized)).length * 0.2
      score += terms.length * 0.1

      return {
        type: 'page' as const,
        id: page.id,
        title: page.title,
        snippet: page.url,
        score,
        tags: page.tags,
        shortcut: page.shortcut,
        tasks: page.tasks
      }
    })

    const noteResults = noteMatches.map(note => {
      const content = note.content.toLowerCase()
      const comment = (note.comment || '').toLowerCase()

      let score = 1
      if (content.includes(normalized)) score += 1
      if (comment.includes(normalized)) score += 0.5
      if (content.startsWith(normalized)) score += 0.5

      return {
        type: 'note' as const,
        id: note.id,
        title: note.content.slice(0, 50) + '...',
        snippet: note.comment || '',
        score,
        tags: note.tags,
        tasks: note.tasks
      }
    })

    const taskResults = taskMatches
      .map(task => {
        const name = task.name.toLowerCase()
        const description = (task.description || '').toLowerCase()
        const nameMatch = name.includes(normalized)
        const descriptionMatch = description.includes(normalized)

        if (!nameMatch && !descriptionMatch) {
          return null
        }

        let score = 1
        if (name.startsWith(normalized)) score += 1.5
        if (nameMatch) score += 1
        if (descriptionMatch) score += 0.5

        return {
          type: 'task' as const,
          id: task.id,
          title: task.name,
          snippet: task.description || '',
          score,
          tags: [],
          tasks: []
        }
      })
      .filter((match): match is { type: 'task'; id: string; title: string; snippet: string; score: number; tags: string[]; tasks: string[] } => match !== null)

    return [...pageResults, ...noteResults, ...taskResults]
  }

  async searchPages(query: string, limit = 20): Promise<any[]> {
    const pages = await this.pageService.search(query)
    return pages.slice(0, limit).map(page => ({
      type: 'page',
      id: page.id,
      title: page.title,
      snippet: page.url,
      score: 1,
      tags: page.tags,
      shortcut: page.shortcut,
      tasks: page.tasks
    }))
  }

  async searchNotes(query: string, limit = 20): Promise<any[]> {
    const notes = await this.noteService.search(query)
    return notes.slice(0, limit).map(note => ({
      type: 'note',
      id: note.id,
      title: note.content.slice(0, 50) + '...',
      snippet: note.comment || '',
      score: 1,
      tags: note.tags,
      tasks: note.tasks
    }))
  }

  async searchTasks(query: string, limit = 20): Promise<any[]> {
    const normalizedQuery = query.trim()
    const tasks = await this.taskService.getAll()

    if (!normalizedQuery) {
      return tasks.slice(0, limit).map(task => ({
        type: 'task',
        id: task.id,
        title: task.name,
        snippet: task.description || '',
        score: 0,
        tags: [],
        tasks: []
      }))
    }

    const matches = tasks
      .map((task: TaskEntry) => {
        const nameScore = fuzzyMatchScore(task.name, normalizedQuery)
        const descriptionScore = task.description
          ? fuzzyMatchScore(task.description, normalizedQuery)
          : null
        const bestScore = Math.max(
          nameScore ?? Number.NEGATIVE_INFINITY,
          descriptionScore ?? Number.NEGATIVE_INFINITY
        )

        if (!Number.isFinite(bestScore) || bestScore === Number.NEGATIVE_INFINITY) {
          return null
        }

        return { task, score: bestScore }
      })
      .filter((match): match is { task: TaskEntry; score: number } => match !== null)
      .sort((a, b) => {
        if (a.score === b.score) {
          return a.task.name.localeCompare(b.task.name)
        }
        return b.score - a.score
      })
      .slice(0, limit)

    return matches.map(match => ({
      type: 'task',
      id: match.task.id,
      title: match.task.name,
      snippet: match.task.description || '',
      score: match.score,
      tags: [],
      tasks: []
    }))
  }

  async fuzzySearch(query: string, limit = 20): Promise<any[]> {
    const [pages, notes, tasks] = await Promise.all([
      this.searchPages(query, Math.floor(limit * 0.6)),
      this.searchNotes(query, Math.floor(limit * 0.3)),
      this.searchTasks(query, Math.floor(limit * 0.1))
    ])

    return [...pages, ...notes, ...tasks]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async searchByTag(tag: string): Promise<any[]> {
    const [pages, notes] = await Promise.all([
      this.pageService.getByTags([tag]),
      this.noteService.getByTags([tag])
    ])

    return [
      ...pages.map(page => ({
        type: 'page',
        id: page.id,
        title: page.title,
        snippet: page.url,
        score: 1,
        tags: page.tags,
        shortcut: page.shortcut,
        tasks: page.tasks
      })),
      ...notes.map(note => ({
        type: 'note',
        id: note.id,
        title: note.content.slice(0, 50) + '...',
        snippet: note.comment || '',
        score: 1,
        tags: note.tags,
        tasks: note.tasks
      }))
    ]
  }

  async searchByTask(task: string): Promise<any[]> {
    const [pages, notes] = await Promise.all([
      this.pageService.getByTask(task),
      this.noteService.getByTask(task)
    ])

    return [
      ...pages.map(page => ({
        type: 'page',
        id: page.id,
        title: page.title,
        snippet: page.url,
        score: 1,
        tags: page.tags,
        shortcut: page.shortcut,
        tasks: page.tasks
      })),
      ...notes.map(note => ({
        type: 'note',
        id: note.id,
        title: note.content.slice(0, 50) + '...',
        snippet: note.comment || '',
        score: 1,
        tags: note.tags,
        tasks: note.tasks
      }))
    ]
  }
}

// Container class for dependency injection
export class DIContainer {
  private static instance: DIContainer

  private _pageService: IPageService
  private _noteService: INoteService
  private _taskService: ITaskService
  private _searchService: ISearchService

  private _pageUseCases: PageUseCases
  private _taskUseCases: TaskUseCases
  private _searchUseCases: SearchUseCases
  private _notesUseCases: NotesUseCases
  private _fuzzySearchService: FuzzySearchService
  private _analyticsService: AnalyticsService
  private _mlService: MLService

  private constructor() {
    // Initialize services (repository layer)
    this._pageService = new DexiePageService()
    this._noteService = new DexieNoteService()
    this._taskService = new DexieTaskService()
    this._fuzzySearchService = new FuzzySearchService()
    this._analyticsService = new AnalyticsService()
    this._mlService = new MLService()
    this._searchService = new SearchService(
      this._pageService,
      this._noteService,
      this._taskService
    )

    // Initialize use cases (business logic layer)
    this._pageUseCases = new PageUseCases(
      this._pageService,
      this._taskService,
      this._searchService
    )

    this._taskUseCases = new TaskUseCases(
      this._taskService,
      this._pageService,
      this._noteService
    )

    this._searchUseCases = new SearchUseCases(
      this._pageService,
      this._noteService,
      this._taskService,
      this._searchService,
      this._taskUseCases,
      this._fuzzySearchService,
      this._analyticsService,
      this._mlService
    )

    this._notesUseCases = new NotesUseCases(
      this._noteService,
      this._taskService
    )
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
  }

  // Set the background store for use cases
  public setBackgroundStore(backgroundStore: any): void {
    this._pageUseCases = new PageUseCases(
      this._pageService,
      this._taskService,
      this._searchService,
      backgroundStore
    )

    this._taskUseCases = new TaskUseCases(
      this._taskService,
      this._pageService,
      this._noteService,
      backgroundStore
    )

    this._searchUseCases = new SearchUseCases(
      this._pageService,
      this._noteService,
      this._taskService,
      this._searchService,
      this._taskUseCases,
      this._fuzzySearchService,
      this._analyticsService,
      this._mlService
    )

    this._notesUseCases = new NotesUseCases(
      this._noteService,
      this._taskService,
      backgroundStore
    )
  }

  // Getters for services
  get pageService(): IPageService {
    return this._pageService
  }

  get noteService(): INoteService {
    return this._noteService
  }

  get taskService(): ITaskService {
    return this._taskService
  }

  get searchService(): ISearchService {
    return this._searchService
  }

  // Getters for use cases
  get pageUseCases(): PageUseCases {
    return this._pageUseCases
  }

  get taskUseCases(): TaskUseCases {
    return this._taskUseCases
  }

  get searchUseCases(): SearchUseCases {
    return this._searchUseCases
  }

  get notesUseCases(): NotesUseCases {
    return this._notesUseCases
  }

  get fuzzySearchService(): FuzzySearchService {
    return this._fuzzySearchService
  }

  get analyticsService(): AnalyticsService {
    return this._analyticsService
  }

  get mlService(): MLService {
    return this._mlService
  }
}
