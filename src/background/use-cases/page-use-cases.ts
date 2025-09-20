// Use cases for page-related business logic

import {
  PageEntry,
  SavePageRequest,
  SearchResult
} from '../../shared/models'
import {
  IPageService,
  ITaskService,
  ISearchService
} from '../../shared/services/interfaces'

export class PageUseCases {
  constructor(
    private pageService: IPageService,
    private taskService: ITaskService,
    private searchService: ISearchService
  ) {}

  async savePage(request: SavePageRequest): Promise<PageEntry> {
    // Validate shortcut uniqueness
    if (request.shortcut) {
      const existing = await this.pageService.getByShortcut(request.shortcut)
      if (existing && existing.url !== request.url) {
        throw new Error(`Shortcut @${request.shortcut} is already in use`)
      }
    }

    const page = await this.pageService.save(request)

    // If task is specified, add page to task
    if (request.task) {
      let task = await this.taskService.getByName(request.task)
      if (!task) {
        task = await this.taskService.create(request.task)
      }
      await this.taskService.addPage(task.id, page.id)
    }

    return page
  }

  async saveCurrentTab(tabInfo: { url: string; title: string; favicon?: string }): Promise<PageEntry> {
    // Get current active task if any
    const activeTask = await this.taskService.getActive()

    const request: SavePageRequest = {
      url: tabInfo.url,
      title: tabInfo.title,
      favicon: tabInfo.favicon,
      task: activeTask?.name
    }

    return this.savePage(request)
  }

  async openByShortcut(shortcut: string): Promise<PageEntry | null> {
    return this.pageService.getByShortcut(shortcut)
  }

  async getPagesByTask(taskName: string): Promise<PageEntry[]> {
    return this.pageService.getByTask(taskName)
  }

  async updatePageTags(pageId: string, tags: string[]): Promise<PageEntry> {
    return this.pageService.update(pageId, { tags })
  }

  async setPageShortcut(pageId: string, shortcut: string): Promise<PageEntry> {
    // Validate shortcut uniqueness
    const existing = await this.pageService.getByShortcut(shortcut)
    if (existing && existing.id !== pageId) {
      throw new Error(`Shortcut @${shortcut} is already in use`)
    }

    return this.pageService.update(pageId, { shortcut })
  }

  async movePageToTask(pageId: string, newTaskName: string): Promise<PageEntry> {
    const page = await this.pageService.getById(pageId)
    if (!page) {
      throw new Error(`Page ${pageId} not found`)
    }

    // Remove from old task if any
    if (page.task) {
      const oldTask = await this.taskService.getByName(page.task)
      if (oldTask) {
        await this.taskService.removePage(oldTask.id, pageId)
      }
    }

    // Add to new task
    let newTask = await this.taskService.getByName(newTaskName)
    if (!newTask) {
      newTask = await this.taskService.create(newTaskName)
    }
    await this.taskService.addPage(newTask.id, pageId)

    return this.pageService.update(pageId, { task: newTaskName })
  }

  async searchPages(query: string, limit = 20): Promise<SearchResult[]> {
    return this.searchService.searchPages(query, limit)
  }

  async getRecentPages(limit = 10): Promise<PageEntry[]> {
    return this.pageService.getAll(limit, 0)
  }

  async deletePageAndCleanup(pageId: string): Promise<void> {
    const page = await this.pageService.getById(pageId)
    if (!page) {
      throw new Error(`Page ${pageId} not found`)
    }

    // Remove from task if any
    if (page.task) {
      const task = await this.taskService.getByName(page.task)
      if (task) {
        await this.taskService.removePage(task.id, pageId)
      }
    }

    await this.pageService.delete(pageId)
  }

  async duplicateShortcutCheck(shortcut: string, excludePageId?: string): Promise<boolean> {
    const existing = await this.pageService.getByShortcut(shortcut)
    return existing ? (excludePageId ? existing.id !== excludePageId : true) : false
  }
}