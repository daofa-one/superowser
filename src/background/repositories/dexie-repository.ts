// Dexie implementation of the repository layer

import Dexie, { type EntityTable } from 'dexie'
import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  SavePageRequest,
  SaveNoteRequest,
  NoteCategory,
  SearchContextEntry
} from '../../shared/models'
import {
  IPageService,
  INoteService,
  ITaskService
} from '../../shared/services/interfaces'

interface SuperowserDB extends Dexie {
  pages: EntityTable<PageEntry, 'id'>
  notes: EntityTable<NoteEntry, 'id'>
  tasks: EntityTable<TaskEntry, 'id'>
  settings: EntityTable<{ key: string; value: any }, 'key'>
}

const db = new Dexie('SuperowserDB') as SuperowserDB

// Schema definition
db.version(1).stores({
  pages: '++id, url, title, *tags, shortcut, task, createdAt, updatedAt',
  notes: '++id, pageId, content, *tags, task, createdAt, updatedAt',
  tasks: '++id, name, isActive, createdAt, updatedAt',
  settings: '++key'
})

// Version 2: Migrate from single task to tasks array
db.version(2).stores({
  pages: '++id, url, title, *tags, shortcut, *tasks, createdAt, updatedAt',
  notes: '++id, pageId, content, *tags, *tasks, createdAt, updatedAt',
  tasks: '++id, name, isActive, createdAt, updatedAt',
  settings: '++key'
}).upgrade(trans => {
  // Migrate existing pages from task to tasks array
  return trans.pages.toCollection().modify(page => {
    if (page.task) {
      page.tasks = [page.task]
      delete page.task
    } else {
      page.tasks = []
    }
  }).then(() => {
    // Migrate existing notes from task to tasks array
    return trans.notes.toCollection().modify(note => {
      if (note.task) {
        note.tasks = [note.task]
        delete note.task
      } else {
        note.tasks = []
      }
    })
  })
})

// Version 3: Remove tags from notes (tags should only exist on pages)
db.version(3).stores({
  pages: '++id, url, title, *tags, shortcut, *tasks, createdAt, updatedAt',
  notes: '++id, pageId, content, *tasks, createdAt, updatedAt',
  tasks: '++id, name, isActive, createdAt, updatedAt',
  settings: '++key'
}).upgrade(trans => {
  // Remove tags from notes - they should inherit from associated pages
  return trans.notes.toCollection().modify(note => {
    if (note.tags) {
      delete note.tags
    }
  })
})

// Version 4: Add note category metadata
db.version(4).stores({
  pages: '++id, url, title, *tags, shortcut, *tasks, createdAt, updatedAt',
  notes: '++id, pageId, content, category, *tasks, createdAt, updatedAt',
  tasks: '++id, name, isActive, createdAt, updatedAt',
  settings: '++key'
}).upgrade(trans => {
  return trans.notes.toCollection().modify(note => {
    note.category = normalizeNoteCategory((note as any).category)
  })
})

// Version 5: Track search context for pages
db.version(5).stores({
  pages: '++id, url, title, *tags, shortcut, *tasks, createdAt, updatedAt',
  notes: '++id, pageId, content, category, *tasks, createdAt, updatedAt',
  tasks: '++id, name, isActive, createdAt, updatedAt',
  settings: '++key'
}).upgrade(async trans => {
  await trans.pages.toCollection().modify(page => {
    const normalizedContext = normalizeSearchContext((page as any).searchContext)
    page.searchContext = normalizedContext
    page.searchContextHistory = mapSearchContextHistory((page as any).searchContextHistory)

    if (normalizedContext) {
      page.searchContextHistory = [...page.searchContextHistory, normalizedContext]
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        .slice(-10)
    }
  })
})

// Utility functions
const generateId = () => crypto.randomUUID()
const now = () => new Date()

const normalizeKey = (value?: string | null): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeKeyArray = (values?: string[] | null): string[] => {
  if (!values || values.length === 0) {
    return []
  }

  const normalized = values
    .map(value => normalizeKey(value))
    .filter((value): value is string => !!value)

  return Array.from(new Set(normalized))
}

const NOTE_CATEGORY_OPTIONS: NoteCategory[] = ['note', 'plan', 'brainstorm', 'highlight']

const normalizeNoteCategory = (value?: string | null): NoteCategory => {
  const normalized = (value ?? 'note').toLowerCase()
  return NOTE_CATEGORY_OPTIONS.includes(normalized as NoteCategory)
    ? normalized as NoteCategory
    : 'note'
}

const mapNoteCategory = (note: NoteEntry | (NoteEntry & { category?: string; tags?: string[]; tasks?: string[] })): NoteEntry => ({
  ...note,
  tags: Array.isArray((note as any).tags) ? (note as any).tags : [],
  tasks: Array.isArray((note as any).tasks) ? (note as any).tasks : [],
  category: normalizeNoteCategory((note as any).category)
})

const normalizeSearchContext = (context: SearchContextEntry | undefined | null): SearchContextEntry | undefined => {
  if (!context) {
    return undefined
  }

  const recordedAt = context.recordedAt instanceof Date ? context.recordedAt : new Date(context.recordedAt)

  if (!context.query || !context.engine || Number.isNaN(recordedAt.getTime())) {
    return undefined
  }

  return {
    query: context.query,
    engine: context.engine,
    recordedAt
  }
}

const mapSearchContextHistory = (history: unknown): SearchContextEntry[] => {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .map(entry => normalizeSearchContext(entry as SearchContextEntry))
    .filter((entry): entry is SearchContextEntry => !!entry)
}

const mapPageEntry = (page: PageEntry | (PageEntry & { searchContext?: SearchContextEntry; searchContextHistory?: SearchContextEntry[] })): PageEntry => {
  const searchContext = normalizeSearchContext((page as any).searchContext)
  const searchContextHistory = mapSearchContextHistory((page as any).searchContextHistory)

  return {
    ...page,
    searchContext,
    searchContextHistory,
    createdAt: page.createdAt instanceof Date ? page.createdAt : new Date(page.createdAt),
    updatedAt: page.updatedAt instanceof Date ? page.updatedAt : new Date(page.updatedAt)
  }
}

export class DexiePageService implements IPageService {
  async save(request: SavePageRequest): Promise<PageEntry> {
    const existing = await this.getByUrl(request.url)
    const normalizedTasks = normalizeKeyArray(request.tasks)
    const normalizedContext = normalizeSearchContext(request.searchContext)

    if (existing) {
      // Update existing page
      const updates: Partial<PageEntry> = {
        title: request.title,
        favicon: request.favicon,
        tags: request.tags || existing.tags,
        shortcut: request.shortcut || existing.shortcut,
        tasks: normalizedTasks.length > 0 ? normalizedTasks : existing.tasks,
        updatedAt: now()
      }

      if (normalizedContext) {
        updates.searchContext = normalizedContext
        updates.searchContextHistory = [...existing.searchContextHistory, normalizedContext]
          .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
          .slice(-10)
      }

      return this.update(existing.id, updates)
    } else {
      // Create new page
      const page: PageEntry = {
        id: generateId(),
        url: request.url,
        title: request.title,
        favicon: request.favicon,
        tags: request.tags || [],
        shortcut: request.shortcut,
        tasks: normalizedTasks,
        searchContext: normalizedContext,
        searchContextHistory: normalizedContext ? [normalizedContext] : [],
        createdAt: now(),
        updatedAt: now()
      }

      await db.pages.add(page)
      return mapPageEntry(page)
    }
  }

  async getById(id: string): Promise<PageEntry | null> {
    const raw = await db.pages.get(id)
    return raw ? mapPageEntry(raw) : null
  }

  async getByUrl(url: string): Promise<PageEntry | null> {
    const raw = await db.pages.where('url').equals(url).first()
    return raw ? mapPageEntry(raw) : null
  }

  async getByShortcut(shortcut: string): Promise<PageEntry | null> {
    const raw = await db.pages.where('shortcut').equals(shortcut).first()
    return raw ? mapPageEntry(raw) : null
  }

  async getByTask(task: string): Promise<PageEntry[]> {
    const normalized = normalizeKey(task)
    if (!normalized) {
      return []
    }
    const results = await db.pages.where('tasks').anyOf([normalized]).toArray()
    return results.map(mapPageEntry)
  }

  async getByTags(tags: string[]): Promise<PageEntry[]> {
    const results = await db.pages.where('tags').anyOf(tags).toArray()
    return results.map(mapPageEntry)
  }

  async update(id: string, updates: Partial<PageEntry>): Promise<PageEntry> {
    const payload: Partial<PageEntry> = {
      ...updates,
      updatedAt: now()
    }

    if (updates?.tasks) {
      payload.tasks = normalizeKeyArray(updates.tasks)
    }

    if (updates?.searchContext) {
      const normalizedContext = normalizeSearchContext(updates.searchContext)
      if (normalizedContext) {
        payload.searchContext = normalizedContext
        const existing = await this.getById(id)
        const history = existing?.searchContextHistory ?? []
        payload.searchContextHistory = [...history, normalizedContext]
          .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
          .slice(-10)
      }
    } else if (updates && 'searchContext' in updates && !updates.searchContext) {
      payload.searchContext = undefined
    }

    if (updates?.searchContextHistory) {
      payload.searchContextHistory = updates.searchContextHistory
        .map(context => normalizeSearchContext(context))
        .filter((entry): entry is SearchContextEntry => !!entry)
        .slice(-10)
    }

    await db.pages.update(id, payload)
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Page ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.pages.delete(id)
  }

  async getAll(limit = 100, offset = 0): Promise<PageEntry[]> {
    const results = await db.pages
      .orderBy('updatedAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
    return results.map(mapPageEntry)
  }

  async search(query: string): Promise<PageEntry[]> {
    const searchTerms = query.toLowerCase().split(' ')
    const results = await db.pages
      .filter(page =>
        searchTerms.every(term =>
          page.title.toLowerCase().includes(term) ||
          page.url.toLowerCase().includes(term) ||
          page.tags.some(tag => tag.toLowerCase().includes(term)) ||
          (page.content && page.content.toLowerCase().includes(term))
        )
      )
      .toArray()
    return results.map(mapPageEntry)
  }
}

export class DexieNoteService implements INoteService {
  async save(request: SaveNoteRequest): Promise<NoteEntry> {
    const normalizedTasks = normalizeKeyArray(request.tasks)

    const note: NoteEntry = {
      id: generateId(),
      pageId: request.pageId,
      content: request.content,
      comment: request.comment,
      tags: [], // Always empty after migration
      tasks: normalizedTasks,
      category: normalizeNoteCategory(request.category),
      position: request.position,
      createdAt: now(),
      updatedAt: now()
    }

    await db.notes.add(note)
    return note
  }

  async getById(id: string): Promise<NoteEntry | null> {
    const raw = await db.notes.get(id)
    return raw ? mapNoteCategory(raw) : null
  }

  async getByPageId(pageId: string): Promise<NoteEntry[]> {
    const notes = await db.notes.where('pageId').equals(pageId).toArray()
    return notes.map(mapNoteCategory)
  }

  async getByTask(task: string): Promise<NoteEntry[]> {
    const normalized = normalizeKey(task)
    if (!normalized) {
      return []
    }
    const notes = await db.notes.where('tasks').anyOf([normalized]).toArray()
    return notes.map(mapNoteCategory)
  }

  async getByTags(_tags: string[]): Promise<NoteEntry[]> {
    // Notes no longer have tags after v3 migration - return empty array
    return []
  }

  async update(id: string, updates: Partial<NoteEntry>): Promise<NoteEntry> {
    const payload: Partial<NoteEntry> = {
      ...updates,
      updatedAt: now()
    }

    if (updates?.tasks) {
      payload.tasks = normalizeKeyArray(updates.tasks)
    }

    if (updates && 'category' in updates) {
      payload.category = normalizeNoteCategory(updates.category as string)
    }

    await db.notes.update(id, payload)
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Note ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.notes.delete(id)
  }

  async search(query: string): Promise<NoteEntry[]> {
    if (!query.trim()) {
      return this.getAll()
    }

    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0)
    if (searchTerms.length === 0) {
      return this.getAll()
    }

    const notes = await db.notes
      .filter(note =>
        searchTerms.every(term =>
          note.content.toLowerCase().includes(term) ||
          (note.comment && note.comment.toLowerCase().includes(term))
        )
      )
      .toArray()

    return notes.map(mapNoteCategory)
  }

  async getAll(limit = 1000, offset = 0): Promise<NoteEntry[]> {
    const notes = await db.notes
      .orderBy('updatedAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
    return notes.map(mapNoteCategory)
  }
}

export class DexieTaskService implements ITaskService {
  async create(name: string, description?: string): Promise<TaskEntry> {
    const normalizedName = normalizeKey(name)
    if (!normalizedName) {
      throw new Error('Task name cannot be empty')
    }

    const task: TaskEntry = {
      id: generateId(),
      name: normalizedName,
      description,
      pageIds: [],
      noteIds: [],
      isActive: false,
      createdAt: now(),
      updatedAt: now()
    }

    await db.tasks.add(task)
    return task
  }

  async getById(id: string): Promise<TaskEntry | null> {
    return await db.tasks.get(id) || null
  }

  async getByName(name: string): Promise<TaskEntry | null> {
    const normalized = normalizeKey(name)
    if (!normalized) {
      return null
    }
    const task = await db.tasks.where('name').equals(normalized).first()
    if (!task) {
      return null
    }
    if (task.name !== normalized) {
      task.name = normalized
      await db.tasks.update(task.id, { name: normalized, updatedAt: now() })
    }
    return task
  }

  async getActive(): Promise<TaskEntry | null> {
    const active = await db.tasks.filter(task => task.isActive === true).first()
    if (!active) {
      return null
    }

    const normalizedName = normalizeKey(active.name)
    if (!normalizedName) {
      // Clear invalid active state
      await db.tasks.update(active.id, { isActive: false, updatedAt: now() })
      return null
    }

    if (active.name !== normalizedName) {
      await db.tasks.update(active.id, { name: normalizedName, updatedAt: now() })
      active.name = normalizedName
    }

    return active
  }

  async setActive(id: string): Promise<TaskEntry> {
    // Deactivate all tasks first
    await db.tasks.filter(task => task.isActive === true).modify({ isActive: false })
    // Activate the selected task
    await db.tasks.update(id, { isActive: true, updatedAt: now() })
    const task = await this.getById(id)
    if (!task) throw new Error(`Task ${id} not found`)
    return task
  }

  async addPage(taskId: string, pageId: string): Promise<void> {
    const task = await this.getById(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    if (!task.pageIds.includes(pageId)) {
      task.pageIds.push(pageId)
      await this.update(taskId, { pageIds: task.pageIds })
    }
  }

  async removePage(taskId: string, pageId: string): Promise<void> {
    const task = await this.getById(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    const updatedPageIds = task.pageIds.filter(id => id !== pageId)
    await this.update(taskId, { pageIds: updatedPageIds })
  }

  async addNote(taskId: string, noteId: string): Promise<void> {
    const task = await this.getById(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    if (!task.noteIds.includes(noteId)) {
      task.noteIds.push(noteId)
      await this.update(taskId, { noteIds: task.noteIds })
    }
  }

  async removeNote(taskId: string, noteId: string): Promise<void> {
    const task = await this.getById(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    const updatedNoteIds = task.noteIds.filter(id => id !== noteId)
    await this.update(taskId, { noteIds: updatedNoteIds })
  }

  async update(id: string, updates: Partial<TaskEntry>): Promise<TaskEntry> {
    await db.tasks.update(id, { ...updates, updatedAt: now() })
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Task ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.tasks.delete(id)
  }

  async getAll(): Promise<TaskEntry[]> {
    const tasks = await db.tasks.orderBy('updatedAt').reverse().toArray()
    const sanitized: TaskEntry[] = []

    for (const task of tasks) {
      const normalized = normalizeKey(task.name)
      if (!normalized) {
        continue
      }
      if (task.name !== normalized) {
        await db.tasks.update(task.id, { name: normalized, updatedAt: now() })
        task.name = normalized
      }
      sanitized.push(task)
    }

    return sanitized
  }

  async merge(sourceId: string, targetId: string): Promise<TaskEntry> {
    const [source, target] = await Promise.all([
      this.getById(sourceId),
      this.getById(targetId)
    ])

    if (!source || !target) {
      throw new Error('Source or target task not found')
    }

    // Merge page and note IDs
    const mergedPageIds = [...new Set([...target.pageIds, ...source.pageIds])]
    const mergedNoteIds = [...new Set([...target.noteIds, ...source.noteIds])]

    await this.update(targetId, {
      pageIds: mergedPageIds,
      noteIds: mergedNoteIds
    })

    await this.delete(sourceId)

    return await this.getById(targetId) as TaskEntry
  }
}
