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

import {
  IPageService,
  INoteService,
  ITaskService,
  ISearchService
} from '../shared/services/interfaces'

// Simple search service implementation
class SearchService implements ISearchService {
  constructor(
    private pageService: IPageService,
    private noteService: INoteService,
    private taskService: ITaskService
  ) {}

  async search(query: any): Promise<any[]> {
    // Implementation would go here
    return []
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
    const tasks = await this.taskService.getAll()
    const filtered = tasks.filter(task =>
      task.name.toLowerCase().includes(query.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
    )
    return filtered.slice(0, limit).map(task => ({
      type: 'task',
      id: task.id,
      title: task.name,
      snippet: task.description || '',
      score: 1,
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

  private constructor() {
    // Initialize services (repository layer)
    this._pageService = new DexiePageService()
    this._noteService = new DexieNoteService()
    this._taskService = new DexieTaskService()
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
      this._searchService
    )
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
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
}