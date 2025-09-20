// Use cases for task-related business logic

import {
  TaskEntry,
  PageEntry,
  NoteEntry
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
    private noteService: INoteService
  ) {}

  async createTask(name: string, description?: string): Promise<TaskEntry> {
    // Check if task name already exists
    const existing = await this.taskService.getByName(name)
    if (existing) {
      throw new Error(`Task "${name}" already exists`)
    }

    return this.taskService.create(name, description)
  }

  async setActiveTask(taskName: string): Promise<TaskEntry> {
    let task = await this.taskService.getByName(taskName)

    if (!task) {
      // Create task if it doesn't exist
      task = await this.taskService.create(taskName)
    }

    return this.taskService.setActive(task.id)
  }

  async getActiveTask(): Promise<TaskEntry | null> {
    return this.taskService.getActive()
  }

  async getTaskWithContent(taskName: string): Promise<{
    task: TaskEntry | null
    pages: PageEntry[]
    notes: NoteEntry[]
  }> {
    const task = await this.taskService.getByName(taskName)

    if (!task) {
      return { task: null, pages: [], notes: [] }
    }

    const [pages, notes] = await Promise.all([
      this.pageService.getByTask(taskName),
      this.noteService.getByTask(taskName)
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
        task: activeTask.name
      })
    } else {
      // Update existing page to be in this task
      page = await this.pageService.update(page.id, {
        task: activeTask.name
      })
    }

    await this.taskService.addPage(activeTask.id, page.id)
  }

  async removePageFromTask(taskName: string, pageId: string): Promise<void> {
    const task = await this.taskService.getByName(taskName)
    if (!task) {
      throw new Error(`Task "${taskName}" not found`)
    }

    await this.taskService.removePage(task.id, pageId)

    // Update page to remove task association
    await this.pageService.update(pageId, { task: undefined })
  }

  async renameTask(oldName: string, newName: string): Promise<TaskEntry> {
    const task = await this.taskService.getByName(oldName)
    if (!task) {
      throw new Error(`Task "${oldName}" not found`)
    }

    // Check if new name already exists
    const existing = await this.taskService.getByName(newName)
    if (existing && existing.id !== task.id) {
      throw new Error(`Task "${newName}" already exists`)
    }

    // Update task name
    const updatedTask = await this.taskService.update(task.id, { name: newName })

    // Update all pages in this task
    const pages = await this.pageService.getByTask(oldName)
    await Promise.all(
      pages.map(page =>
        this.pageService.update(page.id, { task: newName })
      )
    )

    // Update all notes in this task
    const notes = await this.noteService.getByTask(oldName)
    await Promise.all(
      notes.map(note =>
        this.noteService.update(note.id, { task: newName })
      )
    )

    return updatedTask
  }

  async mergeTasks(sourceTaskName: string, targetTaskName: string): Promise<TaskEntry> {
    const [sourceTask, targetTask] = await Promise.all([
      this.taskService.getByName(sourceTaskName),
      this.taskService.getByName(targetTaskName)
    ])

    if (!sourceTask) {
      throw new Error(`Source task "${sourceTaskName}" not found`)
    }
    if (!targetTask) {
      throw new Error(`Target task "${targetTaskName}" not found`)
    }

    // Update all pages from source to target
    const sourcePages = await this.pageService.getByTask(sourceTaskName)
    await Promise.all(
      sourcePages.map(page =>
        this.pageService.update(page.id, { task: targetTaskName })
      )
    )

    // Update all notes from source to target
    const sourceNotes = await this.noteService.getByTask(sourceTaskName)
    await Promise.all(
      sourceNotes.map(note =>
        this.noteService.update(note.id, { task: targetTaskName })
      )
    )

    // Merge tasks in database
    return this.taskService.merge(sourceTask.id, targetTask.id)
  }

  async deleteTaskAndCleanup(taskName: string): Promise<void> {
    const task = await this.taskService.getByName(taskName)
    if (!task) {
      throw new Error(`Task "${taskName}" not found`)
    }

    // Remove task association from all pages
    const pages = await this.pageService.getByTask(taskName)
    await Promise.all(
      pages.map(page =>
        this.pageService.update(page.id, { task: undefined })
      )
    )

    // Remove task association from all notes
    const notes = await this.noteService.getByTask(taskName)
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
}