// Use cases for notes-related business logic

import {
  NoteEntry,
  SaveNoteRequest
} from '../../shared/models'
import {
  INoteService,
  ITaskService
} from '../../shared/services/interfaces'

export class NotesUseCases {
  constructor(
    private noteService: INoteService,
    private taskService: ITaskService,
    private backgroundStore?: any
  ) {}

  /**
   * Get all notes in the system
   */
  async getAllNotes(): Promise<NoteEntry[]> {
    return this.noteService.getAll()
  }

  /**
   * Get notes by page ID
   */
  async getNotesByPage(pageId: string): Promise<NoteEntry[]> {
    return this.noteService.getByPageId(pageId)
  }

  /**
   * Get notes by task name
   */
  async getNotesByTask(taskName: string): Promise<NoteEntry[]> {
    return this.noteService.getByTask(taskName)
  }

  /**
   * Search notes by content, comment, or metadata
   */
  async searchNotes(query: string): Promise<NoteEntry[]> {
    return this.noteService.search(query)
  }

  /**
   * Get notes by tags
   */
  async getNotesByTags(tags: string[]): Promise<NoteEntry[]> {
    return this.noteService.getByTags(tags)
  }

  /**
   * Save a new note with automatic task creation
   */
  async saveNote(request: SaveNoteRequest): Promise<NoteEntry> {
    const note = await this.noteService.save(request)

    // Create tasks if they don't exist
    const taskNames = request.tasks || []
    if (taskNames.length > 0) {
      for (const taskName of taskNames) {
        const existingTask = await this.taskService.getByName(taskName)
        const task = existingTask
          ? existingTask
          : await this.taskService.create(taskName, 'Auto-created when adding note')

        try {
          await this.taskService.addNote(task.id, note.id)
        } catch (error) {
          console.warn('Failed to link note to task', taskName, error)
        }
      }
    }

    return note
  }

  /**
   * Update an existing note
   */
  async updateNote(id: string, updates: Partial<NoteEntry>): Promise<NoteEntry> {
    return this.noteService.update(id, updates)
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    await this.noteService.delete(id)
  }

  /**
   * Get a single note by ID
   */
  async getNote(id: string): Promise<NoteEntry | null> {
    return this.noteService.getById(id)
  }

  /**
   * Get note statistics (counts by task, tags, etc.)
   */
  async getNoteStats(): Promise<{
    totalNotes: number
    notesByTask: Array<{ task: string; count: number }>
    notesByTag: Array<{ tag: string; count: number }>
    notesWithPages: number
    notesWithoutPages: number
  }> {
    const allNotes = await this.getAllNotes()

    const taskCounts = new Map<string, number>()
    const tagCounts = new Map<string, number>()
    let notesWithPages = 0
    let notesWithoutPages = 0

    allNotes.forEach(note => {
      // Count by tasks
      note.tasks.forEach(task => {
        taskCounts.set(task, (taskCounts.get(task) || 0) + 1)
      })

      // Count by tags
      note.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })

      // Count page associations
      if (note.pageId) {
        notesWithPages++
      } else {
        notesWithoutPages++
      }
    })

    return {
      totalNotes: allNotes.length,
      notesByTask: Array.from(taskCounts.entries())
        .map(([task, count]) => ({ task, count }))
        .sort((a, b) => b.count - a.count),
      notesByTag: Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
      notesWithPages,
      notesWithoutPages
    }
  }

  /**
   * Export notes in various formats
   */
  async exportNotes(format: 'json' | 'csv' = 'json'): Promise<string> {
    const notes = await this.getAllNotes()

    if (format === 'csv') {
      const headers = ['ID', 'Content', 'Comment', 'Tags', 'Tasks', 'Page ID', 'Created At', 'Updated At']
      const rows = notes.map(note => [
        note.id,
        `"${note.content.replace(/"/g, '""')}"`,
        `"${(note.comment || '').replace(/"/g, '""')}"`,
        `"${note.tags.join(', ')}"`,
        `"${note.tasks.join(', ')}"`,
        note.pageId || '',
        note.createdAt.toISOString(),
        note.updatedAt?.toISOString() || ''
      ])

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    }

    // JSON format (default)
    return JSON.stringify(notes, null, 2)
  }

  /**
   * Clean up orphaned notes (notes without valid page references)
   */
  async cleanupOrphanedNotes(): Promise<number> {
    // This would require access to pageService to check if pages exist
    // For now, return 0 as this is an advanced feature
    return 0
  }
}
