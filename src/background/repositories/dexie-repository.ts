// Dexie implementation of the repository layer

import Dexie, { type EntityTable } from 'dexie'
import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  SavePageRequest,
  SaveNoteRequest
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

export class DexiePageService implements IPageService {
  async save(request: SavePageRequest): Promise<PageEntry> {
    const existing = await this.getByUrl(request.url)
    const normalizedTasks = normalizeKeyArray(request.tasks)

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
        createdAt: now(),
        updatedAt: now()
      }

      await db.pages.add(page)
      return page
    }
  }

  async getById(id: string): Promise<PageEntry | null> {
    return await db.pages.get(id) || null
  }

  async getByUrl(url: string): Promise<PageEntry | null> {
    return await db.pages.where('url').equals(url).first() || null
  }

  async getByShortcut(shortcut: string): Promise<PageEntry | null> {
    return await db.pages.where('shortcut').equals(shortcut).first() || null
  }

  async getByTask(task: string): Promise<PageEntry[]> {
    const normalized = normalizeKey(task)
    if (!normalized) {
      return []
    }
    return await db.pages.where('tasks').anyOf([normalized]).toArray()
  }

  async getByTags(tags: string[]): Promise<PageEntry[]> {
    return await db.pages.where('tags').anyOf(tags).toArray()
  }

  async update(id: string, updates: Partial<PageEntry>): Promise<PageEntry> {
    const payload: Partial<PageEntry> = {
      ...updates,
      updatedAt: now()
    }

    if (updates?.tasks) {
      payload.tasks = normalizeKeyArray(updates.tasks)
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
    return await db.pages
      .orderBy('updatedAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
  }

  async search(query: string): Promise<PageEntry[]> {
    const searchTerms = query.toLowerCase().split(' ')
    return await db.pages
      .filter(page =>
        searchTerms.every(term =>
          page.title.toLowerCase().includes(term) ||
          page.url.toLowerCase().includes(term) ||
          page.tags.some(tag => tag.toLowerCase().includes(term)) ||
          (page.content && page.content.toLowerCase().includes(term))
        )
      )
      .toArray()
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
      tags: request.tags || [],
      tasks: normalizedTasks,
      position: request.position,
      createdAt: now(),
      updatedAt: now()
    }

    await db.notes.add(note)
    return note
  }

  async getById(id: string): Promise<NoteEntry | null> {
    return await db.notes.get(id) || null
  }

  async getByPageId(pageId: string): Promise<NoteEntry[]> {
    return await db.notes.where('pageId').equals(pageId).toArray()
  }

  async getByTask(task: string): Promise<NoteEntry[]> {
    const normalized = normalizeKey(task)
    if (!normalized) {
      return []
    }
    return await db.notes.where('tasks').anyOf([normalized]).toArray()
  }

  async getByTags(tags: string[]): Promise<NoteEntry[]> {
    return await db.notes.where('tags').anyOf(tags).toArray()
  }

  async update(id: string, updates: Partial<NoteEntry>): Promise<NoteEntry> {
    const payload: Partial<NoteEntry> = {
      ...updates,
      updatedAt: now()
    }

    if (updates?.tasks) {
      payload.tasks = normalizeKeyArray(updates.tasks)
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
    const searchTerms = query.toLowerCase().split(' ')
    return await db.notes
      .filter(note =>
        searchTerms.every(term =>
          note.content.toLowerCase().includes(term) ||
          (note.comment && note.comment.toLowerCase().includes(term)) ||
          note.tags.some(tag => tag.toLowerCase().includes(term))
        )
      )
      .toArray()
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
