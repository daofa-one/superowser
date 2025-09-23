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
    private searchService: ISearchService,
    private backgroundStore?: any
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

    // If tasks are specified, add page to each task
    if (request.tasks && request.tasks.length > 0) {
      for (const taskName of request.tasks) {
        let task = await this.taskService.getByName(taskName)
        if (!task) {
          task = await this.taskService.create(taskName)
        }
        await this.taskService.addPage(task.id, page.id)
      }

      // Broadcast task content updates
      if (this.backgroundStore) {
        try {
          for (const taskName of request.tasks) {
            // Signal that this task's content has changed
            this.backgroundStore.broadcastStateUpdate(`task.${taskName}.contentChanged`, Date.now())
          }
        } catch (error) {
          console.warn('Could not broadcast task content update:', error)
        }
      }
    }

    this.notifyPageUpdate(page)

    return page
  }

  async saveCurrentTab(tabInfo: { url: string; title: string; favicon?: string }): Promise<PageEntry> {
    // Get current active task if any
    const activeTask = await this.taskService.getActive()

    const request: SavePageRequest = {
      url: tabInfo.url,
      title: tabInfo.title,
      favicon: tabInfo.favicon,
      tasks: activeTask ? [activeTask.name] : []
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
    const updated = await this.pageService.update(pageId, { tags })
    this.notifyPageUpdate(updated)
    return updated
  }

  async setPageShortcut(pageId: string, shortcut: string): Promise<PageEntry> {
    // Validate shortcut uniqueness
    const existing = await this.pageService.getByShortcut(shortcut)
    if (existing && existing.id !== pageId) {
      throw new Error(`Shortcut @${shortcut} is already in use`)
    }

    const updated = await this.pageService.update(pageId, { shortcut })
    this.notifyPageUpdate(updated)
    return updated
  }

  async movePageToTask(pageId: string, newTaskName: string): Promise<PageEntry> {
    const page = await this.pageService.getById(pageId)
    if (!page) {
      throw new Error(`Page ${pageId} not found`)
    }

    // Remove from all old tasks
    if (page.tasks && page.tasks.length > 0) {
      for (const taskName of page.tasks) {
        const oldTask = await this.taskService.getByName(taskName)
        if (oldTask) {
          await this.taskService.removePage(oldTask.id, pageId)
        }
      }
    }

    // Add to new task
    let newTask = await this.taskService.getByName(newTaskName)
    if (!newTask) {
      newTask = await this.taskService.create(newTaskName)
    }
    await this.taskService.addPage(newTask.id, pageId)

    const updated = await this.pageService.update(pageId, { tasks: [newTaskName] })
    this.notifyPageUpdate(updated)
    return updated
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

    // Remove from all tasks
    if (page.tasks && page.tasks.length > 0) {
      for (const taskName of page.tasks) {
        const task = await this.taskService.getByName(taskName)
        if (task) {
          await this.taskService.removePage(task.id, pageId)
        }
      }
    }

    await this.pageService.delete(pageId)

    // Broadcast page deletion for any UI components listening to this specific page
    if (this.backgroundStore) {
      try {
        this.backgroundStore.broadcastStateUpdate(`page.${pageId}.deleted`, Date.now())
        // Also broadcast by URL for components that work with URLs
        this.backgroundStore.broadcastStateUpdate(`page.url.${encodeURIComponent(page.url)}.deleted`, Date.now())
      } catch (error) {
        console.warn('Could not broadcast page deletion:', error)
      }
    }
  }

  async duplicateShortcutCheck(shortcut: string, excludePageId?: string): Promise<boolean> {
    const existing = await this.pageService.getByShortcut(shortcut)
    return existing ? (excludePageId ? existing.id !== excludePageId : true) : false
  }

  async updatePage(pageId: string, updates: Partial<PageEntry>): Promise<PageEntry> {
    const updated = await this.pageService.update(pageId, updates)
    this.notifyPageUpdate(updated)
    return updated
  }

  private notifyPageUpdate(page: PageEntry | null): void {
    if (!page || !this.backgroundStore) {
      return
    }

    try {
      this.backgroundStore.broadcastStateUpdate(`page.${page.id}.updated`, page)
      if (page.url) {
        this.backgroundStore.broadcastStateUpdate(`page.url.${encodeURIComponent(page.url)}.updated`, page)
      }
    } catch (error) {
      console.warn('Could not broadcast page update:', error)
    }
  }
}
