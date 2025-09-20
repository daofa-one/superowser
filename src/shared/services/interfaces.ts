// Service interface contracts - abstraction layer for repository implementations

import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  SearchResult,
  SavePageRequest,
  SaveNoteRequest,
  SearchQuery
} from '../models'

export interface IPageService {
  save(request: SavePageRequest): Promise<PageEntry>
  getById(id: string): Promise<PageEntry | null>
  getByUrl(url: string): Promise<PageEntry | null>
  getByShortcut(shortcut: string): Promise<PageEntry | null>
  getByTask(task: string): Promise<PageEntry[]>
  getByTags(tags: string[]): Promise<PageEntry[]>
  update(id: string, updates: Partial<PageEntry>): Promise<PageEntry>
  delete(id: string): Promise<void>
  getAll(limit?: number, offset?: number): Promise<PageEntry[]>
  search(query: string): Promise<PageEntry[]>
}

export interface INoteService {
  save(request: SaveNoteRequest): Promise<NoteEntry>
  getById(id: string): Promise<NoteEntry | null>
  getByPageId(pageId: string): Promise<NoteEntry[]>
  getByTask(task: string): Promise<NoteEntry[]>
  getByTags(tags: string[]): Promise<NoteEntry[]>
  update(id: string, updates: Partial<NoteEntry>): Promise<NoteEntry>
  delete(id: string): Promise<void>
  search(query: string): Promise<NoteEntry[]>
}

export interface ITaskService {
  create(name: string, description?: string): Promise<TaskEntry>
  getById(id: string): Promise<TaskEntry | null>
  getByName(name: string): Promise<TaskEntry | null>
  getActive(): Promise<TaskEntry | null>
  setActive(id: string): Promise<TaskEntry>
  addPage(taskId: string, pageId: string): Promise<void>
  removePage(taskId: string, pageId: string): Promise<void>
  addNote(taskId: string, noteId: string): Promise<void>
  removeNote(taskId: string, noteId: string): Promise<void>
  update(id: string, updates: Partial<TaskEntry>): Promise<TaskEntry>
  delete(id: string): Promise<void>
  getAll(): Promise<TaskEntry[]>
  merge(sourceId: string, targetId: string): Promise<TaskEntry>
}

export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult[]>
  searchPages(query: string, limit?: number): Promise<SearchResult[]>
  searchNotes(query: string, limit?: number): Promise<SearchResult[]>
  searchTasks(query: string, limit?: number): Promise<SearchResult[]>
  fuzzySearch(query: string, limit?: number): Promise<SearchResult[]>
  searchByTag(tag: string): Promise<SearchResult[]>
  searchByTask(task: string): Promise<SearchResult[]>
}

export interface IStorageService {
  // Generic storage operations
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>

  // Bulk operations
  exportData(): Promise<string> // JSON export
  importData(data: string): Promise<void> // JSON import

  // Analytics/stats
  getStats(): Promise<{
    totalPages: number
    totalNotes: number
    totalTasks: number
    mostUsedTags: Array<{ tag: string; count: number }>
    recentActivity: Array<{ type: string; timestamp: Date }>
  }>
}