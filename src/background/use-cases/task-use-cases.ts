// Use cases for task-related business logic

import {
  TaskEntry,
  PageEntry,
  NoteEntry,
  SaveNoteRequest
} from '../../shared/models'
import {
  ITaskService,
  IPageService,
  INoteService
} from '../../shared/services/interfaces'

export class TaskUseCases {
  constructor(
    private taskService: ITaskService,
    private pageService: IPageService,
    private noteService: INoteService,
    private backgroundStore?: any
  ) {}

  private normalizeName(name: string, context: string): string {
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      throw new Error(`Task name is required${context ? ` (${context})` : ''}`)
    }
    return trimmed
  }

  async createTask(name: string, description?: string): Promise<TaskEntry> {
    const normalizedName = this.normalizeName(name, 'create task')

    // Check if task name already exists
    const existing = await this.taskService.getByName(normalizedName)
    if (existing) {
      throw new Error(`Task "${normalizedName}" already exists`)
    }

    return this.taskService.create(normalizedName, description)
  }

  async setActiveTask(taskName: string): Promise<TaskEntry> {
    const normalizedName = this.normalizeName(taskName, 'set active task')

    let task = await this.taskService.getByName(normalizedName)

    if (!task) {
      // Create task if it doesn't exist
      task = await this.taskService.create(normalizedName)
    }

    const activeTask = await this.taskService.setActive(task.id)

    // Update background store with the new active task
    if (this.backgroundStore) {
      try {
        await this.backgroundStore.setCurrentTask(activeTask)
      } catch (error) {
        console.warn('Could not update background store:', error)
        // This is not critical for functionality, so we continue
      }
    }

    this.notifyTaskChange(activeTask)

    return activeTask
  }

  async getActiveTask(): Promise<TaskEntry | null> {
    return this.taskService.getActive()
  }

  async getTaskWithContent(taskName: string): Promise<{
    task: TaskEntry | null
    pages: PageEntry[]
    notes: NoteEntry[]
  }> {
    const normalizedName = this.normalizeName(taskName, 'load task content')
    const task = await this.taskService.getByName(normalizedName)

    if (!task) {
      return { task: null, pages: [], notes: [] }
    }

    const [pages, notes] = await Promise.all([
      this.pageService.getByTask(normalizedName),
      this.noteService.getByTask(normalizedName)
    ])

    return { task, pages, notes }
  }

  async addCurrentPageToActiveTask(pageInfo: { url: string; title: string; favicon?: string }): Promise<void> {
    const activeTask = await this.taskService.getActive()
    if (!activeTask) {
      throw new Error('No active task set')
    }

    // Check if page already exists
    let page = await this.pageService.getByUrl(pageInfo.url)

    if (!page) {
      // Create new page
      page = await this.pageService.save({
        url: pageInfo.url,
        title: pageInfo.title,
        favicon: pageInfo.favicon,
        tasks: [activeTask.name]
      })
    } else {
      // Add task to existing page's tasks array
      const newTasks = [...new Set([...(page.tasks || []), activeTask.name])]
      page = await this.pageService.update(page.id, {
        tasks: newTasks
      })
    }

    await this.taskService.addPage(activeTask.id, page.id)
  }

  async removePageFromTask(taskName: string, pageId: string): Promise<void> {
    const normalizedName = this.normalizeName(taskName, 'remove page from task')
    const task = await this.taskService.getByName(normalizedName)
    if (!task) {
      throw new Error(`Task "${normalizedName}" not found`)
    }

    await this.taskService.removePage(task.id, pageId)

    // Update page to remove task association
    const page = await this.pageService.getById(pageId)
    if (page) {
      const updatedTasks = page.tasks.filter(t => t !== normalizedName)
      await this.pageService.update(pageId, { tasks: updatedTasks })

      // Broadcast page update for any UI components listening to this specific page
      if (this.backgroundStore) {
        try {
          this.backgroundStore.broadcastStateUpdate(`page.${pageId}.updated`, Date.now())
          // Also broadcast by URL for components that work with URLs
          this.backgroundStore.broadcastStateUpdate(`page.url.${encodeURIComponent(page.url)}.updated`, Date.now())
        } catch (error) {
          console.warn('Could not broadcast page update:', error)
        }
      }
    }
  }

  async renameTask(oldName: string, newName: string): Promise<TaskEntry> {
    const normalizedOldName = this.normalizeName(oldName, 'rename task (current name)')
    const normalizedNewName = this.normalizeName(newName, 'rename task (new name)')
    const task = await this.taskService.getByName(normalizedOldName)
    if (!task) {
      throw new Error(`Task "${normalizedOldName}" not found`)
    }

    // Check if new name already exists
    const existing = await this.taskService.getByName(normalizedNewName)
    if (existing && existing.id !== task.id) {
      throw new Error(`Task "${normalizedNewName}" already exists`)
    }

    // Update task name
    const updatedTask = await this.taskService.update(task.id, { name: normalizedNewName })

    // Update all pages in this task
    const pages = await this.pageService.getByTask(normalizedOldName)
    await Promise.all(
      pages.map(page => {
        const updatedTasks = page.tasks.map(t => t === normalizedOldName ? normalizedNewName : t)
        return this.pageService.update(page.id, { tasks: updatedTasks })
      })
    )

    // Update all notes in this task
    const notes = await this.noteService.getByTask(normalizedOldName)
    await Promise.all(
      notes.map(note => {
        const updatedTasks = note.tasks.map(t => t === normalizedOldName ? normalizedNewName : t)
        return this.noteService.update(note.id, { tasks: updatedTasks })
      })
    )

    return updatedTask
  }

  async mergeTasks(sourceTaskName: string, targetTaskName: string): Promise<TaskEntry> {
    const normalizedSource = this.normalizeName(sourceTaskName, 'merge tasks (source)')
    const normalizedTarget = this.normalizeName(targetTaskName, 'merge tasks (target)')

    const [sourceTask, targetTask] = await Promise.all([
      this.taskService.getByName(normalizedSource),
      this.taskService.getByName(normalizedTarget)
    ])

    if (!sourceTask) {
      throw new Error(`Source task "${normalizedSource}" not found`)
    }
    if (!targetTask) {
      throw new Error(`Target task "${normalizedTarget}" not found`)
    }

    // Update all pages from source to target
    const sourcePages = await this.pageService.getByTask(normalizedSource)
    await Promise.all(
      sourcePages.map(page => {
        const updatedTasks = page.tasks.map(t => t === normalizedSource ? normalizedTarget : t)
        // Also add target task if not already present
        if (!updatedTasks.includes(normalizedTarget)) {
          updatedTasks.push(normalizedTarget)
        }
        return this.pageService.update(page.id, { tasks: updatedTasks })
      })
    )

    // Update all notes from source to target
    const sourceNotes = await this.noteService.getByTask(normalizedSource)
    await Promise.all(
      sourceNotes.map(note => {
        const updatedTasks = note.tasks.map(t => t === normalizedSource ? normalizedTarget : t)
        // Also add target task if not already present
        if (!updatedTasks.includes(normalizedTarget)) {
          updatedTasks.push(normalizedTarget)
        }
        return this.noteService.update(note.id, { tasks: updatedTasks })
      })
    )

    // Merge tasks in database
    return this.taskService.merge(sourceTask.id, targetTask.id)
  }

  async deleteTaskAndCleanup(taskName: string): Promise<void> {
    const normalizedName = this.normalizeName(taskName, 'delete task')
    const task = await this.taskService.getByName(normalizedName)
    if (!task) {
      throw new Error(`Task "${normalizedName}" not found`)
    }

    // Remove task association from all pages
    const pages = await this.pageService.getByTask(normalizedName)
    await Promise.all(
      pages.map(page =>
        this.pageService.update(page.id, { task: undefined })
      )
    )

    // Remove task association from all notes
    const notes = await this.noteService.getByTask(normalizedName)
    await Promise.all(
      notes.map(note =>
        this.noteService.update(note.id, { task: undefined })
      )
    )

    await this.taskService.delete(task.id)
  }

  async getAllTasksWithStats(): Promise<Array<TaskEntry & { pageCount: number; noteCount: number }>> {
    const tasks = await this.taskService.getAll()

    const tasksWithStats = await Promise.all(
      tasks.map(async (task) => {
        const [pages, notes] = await Promise.all([
          this.pageService.getByTask(task.name),
          this.noteService.getByTask(task.name)
        ])

        return {
          ...task,
          pageCount: pages.length,
          noteCount: notes.length
        }
      })
    )

    return tasksWithStats
  }

  async openAllPagesInTask(taskName: string): Promise<PageEntry[]> {
    return this.pageService.getByTask(taskName)
  }

  async saveNote(request: SaveNoteRequest): Promise<NoteEntry> {
    const note = await this.noteService.save(request)
    const taskNames = request.tasks || []

    if (taskNames.length > 0) {
      for (const rawName of taskNames) {
        const normalizedName = this.normalizeName(rawName, 'associate note with task')

        let task = await this.taskService.getByName(normalizedName)
        if (!task) {
          task = await this.taskService.create(normalizedName)
        }

        await this.taskService.addNote(task.id, note.id)

        if (this.backgroundStore) {
          try {
            this.backgroundStore.broadcastStateUpdate(`task.${normalizedName}.contentChanged`, Date.now())
          } catch (error) {
            console.warn('Could not broadcast task note update:', error)
          }
        }

        const refreshedTask = await this.taskService.getById(task.id)
        if (refreshedTask) {
          this.notifyTaskChange(refreshedTask)
        }
      }
    }

    return note
  }

  private notifyTaskChange(task: TaskEntry) {
    try {
      chrome.runtime.sendMessage({
        type: 'TASK_CHANGED',
        data: task
      }, () => {
        const error = chrome.runtime.lastError
        if (error && error.message) {
          if (error.message.includes('Receiving end does not exist') || error.message.includes('Could not establish connection')) {
            return
          }
          console.warn('Failed to broadcast TASK_CHANGED message:', error.message)
        }
      })
    } catch (error) {
      console.warn('Failed to broadcast TASK_CHANGED message:', error)
    }
  }
}
