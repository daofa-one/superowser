// Dexie implementation of the repository layer

import Dexie, { type EntityTable } from 'dexie'
import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  SavePageRequest,
  SaveNoteRequest,
  SearchResult
} from '../../shared/models'
import {
  IPageService,
  INoteService,
  ITaskService,
  ISearchService,
  IStorageService
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

// Utility functions
const generateId = () => crypto.randomUUID()
const now = () => new Date()

export class DexiePageService implements IPageService {
  async save(request: SavePageRequest): Promise<PageEntry> {
    const existing = await this.getByUrl(request.url)

    if (existing) {
      // Update existing page
      const updates: Partial<PageEntry> = {
        title: request.title,
        favicon: request.favicon,
        tags: request.tags || existing.tags,
        shortcut: request.shortcut || existing.shortcut,
        task: request.task || existing.task,
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
        task: request.task,
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
    return await db.pages.where('task').equals(task).toArray()
  }

  async getByTags(tags: string[]): Promise<PageEntry[]> {
    return await db.pages.where('tags').anyOf(tags).toArray()
  }

  async update(id: string, updates: Partial<PageEntry>): Promise<PageEntry> {
    await db.pages.update(id, { ...updates, updatedAt: now() })
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
    const note: NoteEntry = {
      id: generateId(),
      pageId: request.pageId,
      content: request.content,
      comment: request.comment,
      tags: request.tags || [],
      task: request.task,
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
    return await db.notes.where('task').equals(task).toArray()
  }

  async getByTags(tags: string[]): Promise<NoteEntry[]> {
    return await db.notes.where('tags').anyOf(tags).toArray()
  }

  async update(id: string, updates: Partial<NoteEntry>): Promise<NoteEntry> {
    await db.notes.update(id, { ...updates, updatedAt: now() })
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
    const task: TaskEntry = {
      id: generateId(),
      name,
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
    return await db.tasks.where('name').equals(name).first() || null
  }

  async getActive(): Promise<TaskEntry | null> {
    return await db.tasks.where('isActive').equals(true).first() || null
  }

  async setActive(id: string): Promise<TaskEntry> {
    // Deactivate all tasks first
    await db.tasks.where('isActive').equals(true).modify({ isActive: false })
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
    return await db.tasks.orderBy('updatedAt').reverse().toArray()
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