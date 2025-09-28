// Side panel store - UI state + cached shared state

import { defineStore } from 'pinia'
import { PageEntry, TaskEntry, SearchResult } from '../../shared/models'
// Types for search and chat history
export interface BrowserSearchQuery {
  query: string
  source: 'browser'
  timestamp: Date
}

export interface ExtensionSearchQuery {
  query: string
  source: 'extension'
  context?: string
  timestamp: Date
}

export interface BrowserChatMessage {
  id?: string
  content: string
  source: 'browser'
  timestamp: Date
  platform?: 'chatgpt' | 'claude' | 'bard' | 'copilot' | 'other'
  url?: string
  conversationId?: string
  role?: 'user' | 'assistant'
  extractedFrom?: 'url' | 'dom'
}

export interface ExtensionChatMessage {
  id?: string
  content: string
  source: 'extension'
  command?: string
  relatedPages?: string[]
  relatedTask?: string
  timestamp: Date
}

export interface UIState {
  // Navigation
  currentRoute: string
  selectedTab: 'home' | 'tasks' | 'chat'

  // Search UI
  searchQuery: string
  searchResults: SearchResult[]
  searchFilters: {
    tags: string[]
    task?: string
    type?: 'page' | 'note' | 'task' | 'all'
  }

  // Chat UI
  chatInput: string
  activeChatCommand?: string

  // General UI
  isLoading: boolean
  selectedItems: string[]
  expandedSections: string[]
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'info'
    message: string
    timestamp: Date
  }>

  // Task creation/editing
  taskDialog: {
    isOpen: boolean
    mode: 'create' | 'edit' | 'view'
    taskData?: {
      name: string
      description?: string
    }
  }
}

export interface CachedState {
  // Shared state cached from background
  currentTask: TaskEntry | null
  previousTask: TaskEntry | null
  recentPages: PageEntry[]
  workingSet: PageEntry[]
  lastSearchContext: {
    query: string
    engine: string
    recordedAt: Date
  } | null

  // Combined search/chat history for UI display
  recentSearches: Array<BrowserSearchQuery | ExtensionSearchQuery>
  recentChats: Array<BrowserChatMessage | ExtensionChatMessage>

  // Popular/suggested data
  popularTags: Array<{ tag: string; count: number }>
  suggestedShortcuts: string[]
  recentTasks: TaskEntry[]

  // Current tab context from browser
  currentTabInfo: {
    url?: string
    title?: string
    favicon?: string
  } | null

  // Activity stats for display
  todayStats: {
    searches: number
    chats: number
    pagesSaved: number
  }
}

export interface SidePanelState {
  ui: UIState
  cache: CachedState
}

export const useSidePanelStore = defineStore('sidepanel', {
  state: (): SidePanelState => ({
    ui: {
      currentRoute: '/',
      selectedTab: 'home',
      searchQuery: '',
      searchResults: [],
      searchFilters: {
        tags: [],
        type: 'all'
      },
      chatInput: '',
      isLoading: false,
      selectedItems: [],
      expandedSections: [],
      notifications: [],
      taskDialog: {
        isOpen: false,
        mode: 'create'
      }
    },

    cache: {
      currentTask: null,
      previousTask: null,
      recentPages: [],
      workingSet: [],
      lastSearchContext: null,
      recentSearches: [],
      recentChats: [],
      popularTags: [],
      suggestedShortcuts: [],
      recentTasks: [],
      currentTabInfo: null,
      todayStats: {
        searches: 0,
        chats: 0,
        pagesSaved: 0
      }
    }
  }),

  getters: {
    // UI state getters
    isSearchActive: (state) => state.ui.searchQuery.length > 0,
    hasSearchResults: (state) => state.ui.searchResults.length > 0,
    hasNotifications: (state) => state.ui.notifications.length > 0,

    // Cache getters with fallbacks
    currentTaskName: (state) => state.cache.currentTask?.name || null,
    hasActiveTask: (state) => !!state.cache.currentTask,

    // Combined histories for display
    combinedSearchHistory: (state) => {
      return state.cache.recentSearches
        .sort((a: BrowserSearchQuery | ExtensionSearchQuery, b: BrowserSearchQuery | ExtensionSearchQuery) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50) // Last 50 for UI performance
    },

    combinedChatHistory: (state) => {
      return state.cache.recentChats
        .sort((a: BrowserChatMessage | ExtensionChatMessage, b: BrowserChatMessage | ExtensionChatMessage) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50)
    },

    // Context-aware suggestions
    contextualSuggestions: (state) => {
      const suggestions: Array<{
        type: 'search' | 'chat' | 'page' | 'task'
        content: string
        source: string
        timestamp: Date
      }> = []

      // Recent extension searches for auto-complete
      state.cache.recentSearches
        .filter((s: BrowserSearchQuery | ExtensionSearchQuery) => s.source === 'extension')
        .slice(0, 5)
        .forEach((search: BrowserSearchQuery | ExtensionSearchQuery) => {
          suggestions.push({
            type: 'search',
            content: search.query,
            source: 'extension',
            timestamp: search.timestamp
          })
        })

      // Recent browser searches for context
      state.cache.recentSearches
        .filter((s: BrowserSearchQuery | ExtensionSearchQuery) => s.source === 'browser')
        .slice(0, 3)
        .forEach((search: BrowserSearchQuery | ExtensionSearchQuery) => {
          suggestions.push({
            type: 'search',
            content: search.query,
            source: 'browser',
            timestamp: search.timestamp
          })
        })

      return suggestions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    },

    // Quick access data
    quickActions: (state) => {
      const actions = []

      if (state.cache.currentTask) {
        actions.push({
          type: 'task',
          label: `Current: ${state.cache.currentTask.name}`,
          action: 'viewCurrentTask'
        })
      }

      if (state.cache.previousTask) {
        actions.push({
          type: 'task',
          label: `Switch to: ${state.cache.previousTask.name}`,
          action: 'switchToPreviousTask'
        })
      }

      if (state.cache.currentTabInfo?.url) {
        actions.push({
          type: 'page',
          label: 'Save current page',
          action: 'saveCurrentPage'
        })
      }

      return actions
    }
  },

  actions: {
    // UI state actions (local only)
    setSearchQuery(query: string) {
      this.ui.searchQuery = query
    },

    setSearchResults(results: SearchResult[]) {
      this.ui.searchResults = results
    },

    addSearchFilter(type: 'tag' | 'task', value: string) {
      if (type === 'tag' && !this.ui.searchFilters.tags.includes(value)) {
        this.ui.searchFilters.tags.push(value)
      } else if (type === 'task') {
        this.ui.searchFilters.task = value
      }
    },

    removeSearchFilter(type: 'tag' | 'task', value?: string) {
      if (type === 'tag' && value) {
        this.ui.searchFilters.tags = this.ui.searchFilters.tags.filter(t => t !== value)
      } else if (type === 'task') {
        this.ui.searchFilters.task = undefined
      }
    },

    setChatInput(input: string) {
      this.ui.chatInput = input

      // Detect command
      if (input.startsWith('/')) {
        const command = input.split(' ')[0].slice(1)
        this.ui.activeChatCommand = command
      } else {
        this.ui.activeChatCommand = undefined
      }
    },

    setSelectedTab(tab: 'home' | 'tasks' | 'chat') {
      this.ui.selectedTab = tab

      // Clear search when switching tabs
      if (tab !== 'home') {
        this.ui.searchQuery = ''
        this.ui.searchResults = []
      }
    },

    setLoading(loading: boolean) {
      this.ui.isLoading = loading
    },

    addNotification(notification: {
      type: 'success' | 'error' | 'info'
      message: string
    }) {
      const id = crypto.randomUUID()
      this.ui.notifications.push({
        id,
        ...notification,
        timestamp: new Date()
      })

      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.removeNotification(id)
      }, 5000)
    },

    removeNotification(id: string) {
      this.ui.notifications = this.ui.notifications.filter(n => n.id !== id)
    },

    openTaskDialog(mode: 'create' | 'edit' | 'view', taskData?: any) {
      this.ui.taskDialog = {
        isOpen: true,
        mode,
        taskData
      }
    },

    closeTaskDialog() {
      this.ui.taskDialog.isOpen = false
      this.ui.taskDialog.taskData = undefined
    },

    // Shared state actions (send to background)
    async performExtensionSearch(query: string, filters?: any) {
      this.setLoading(true)

      try {
        const response = await this.sendMessage({
          type: 'SEARCH',
          data: {
            query,
            type: filters?.type || 'all',
            tags: filters?.tags,
            task: filters?.task
          }
        })

        this.setSearchResults(response.data)

        // This will trigger background to add to extension search history
        await this.sendMessage({
          type: 'ADD_EXTENSION_SEARCH',
          data: {
            query,
            context: 'sidepanel',
            filters
          }
        })

      } catch (error) {
        this.addNotification({
          type: 'error',
          message: `Search failed: ${error instanceof Error ? error.message : String(error)}`
        })
      } finally {
        this.setLoading(false)
      }
    },

    async sendExtensionChat(message: string) {
      this.setLoading(true)

      try {
        const command = message.startsWith('/') ? message.split(' ')[0].slice(1) : undefined

        const response = await this.sendMessage({
          type: 'EXTENSION_CHAT',
          data: {
            content: message,
            command,
            relatedTask: this.cache.currentTask?.name
          }
        })

        this.setChatInput('')
        this.addNotification({
          type: 'success',
          message: 'Message sent'
        })

        return response.data

      } catch (error) {
        this.addNotification({
          type: 'error',
          message: `Chat failed: ${error instanceof Error ? error.message : String(error)}`
        })
      } finally {
        this.setLoading(false)
      }
    },

    async setCurrentTask(taskName: string) {
      this.setLoading(true)

      try {
        const response = await this.sendMessage({
          type: 'SET_ACTIVE_TASK',
          data: { taskName }
        })

        if (response?.type === 'SUCCESS' && response.data) {
          // Update local cache with the new active task
          this.cache.currentTask = response.data
        }

        this.addNotification({
          type: 'success',
          message: `Switched to task: ${taskName}`
        })

      } catch (error) {
        this.addNotification({
          type: 'error',
          message: `Failed to switch task: ${error instanceof Error ? error.message : String(error)}`
        })
      } finally {
        this.setLoading(false)
      }
    },

    async saveCurrentPage(options?: {
      tags?: string[]
      shortcut?: string
      task?: string
    }) {
      this.setLoading(true)

      try {
        const response = await this.sendMessage({
          type: 'SAVE_CURRENT_TAB',
          data: {
            task: options?.task || this.cache.currentTask?.name,
            tags: options?.tags,
            shortcut: options?.shortcut
          }
        })

        this.addNotification({
          type: 'success',
          message: 'Page saved successfully'
        })

        return response.data

      } catch (error) {
        this.addNotification({
          type: 'error',
          message: `Failed to save page: ${error instanceof Error ? error.message : String(error)}`
        })
      } finally {
        this.setLoading(false)
      }
    },

    // Cache update methods (called by state sync)
    updateCache(path: string, value: any) {
      if (!path) {
        return
      }

      const chatPaths = [
        'user.extensionChatHistory',
        'background.user.extensionChatHistory'
      ]

      if (chatPaths.includes(path)) {
        const normalized = Array.isArray(value)
          ? value.map((entry: any) => ({
              ...entry,
              timestamp: entry?.timestamp ? new Date(entry.timestamp) : new Date()
            }))
          : []

        // Check if this is a new message (newer than our latest cached message)
        const existingIds = new Set(this.cache.recentChats.map(chat => chat.id))
        const newMessages = normalized.filter(msg => !existingIds.has(msg.id))

        if (newMessages.length > 0) {
          // Append new messages to existing cache and sort by timestamp
          this.cache.recentChats = [...this.cache.recentChats, ...newMessages]
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        } else {
          // No new messages, just replace (for initial load)
          this.cache.recentChats = normalized
        }

        console.debug('[Sidepanel] Updated chat history', {
          path,
          totalCount: this.cache.recentChats.length,
          newMessages: newMessages.length
        })
        return
      }

      const searchContextPaths = [
        'user.lastSearchContext',
        'background.user.lastSearchContext'
      ]

      if (searchContextPaths.includes(path)) {
        if (!value) {
          this.cache.lastSearchContext = null
        } else {
          const recordedAt = (value as any)?.recordedAt
          const parsedDate = recordedAt ? new Date(recordedAt) : new Date()
          this.cache.lastSearchContext = {
            query: (value as any)?.query ?? '',
            engine: (value as any)?.engine ?? '',
            recordedAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
          }
        }
        return
      }

      const directMappings: Record<string, keyof CachedState> = {
        'user.currentTask': 'currentTask',
        'user.previousTask': 'previousTask',
        'currentTask': 'currentTask',
        'previousTask': 'previousTask',
        'user.settings': 'settings',
        'settings': 'settings'
      }

      const targetKey = directMappings[path]
      if (targetKey) {
        ;(this.cache as any)[targetKey] = value ?? null
        return
      }

      if (path.startsWith('user.')) {
        const [, ...rest] = path.split('.').filter(Boolean)
        if (rest.length === 0) {
          return
        }

        const [firstKey, ...remainingKeys] = rest
        // Normalize legacy nested paths to cache keys
        const cacheKeyMap: Record<string, keyof CachedState> = {
          extensionChatHistory: 'recentChats',
          extensionSearchHistory: 'recentSearches',
          settings: 'settings',
          lastSearchContext: 'lastSearchContext'
        }

        const mappedKey = cacheKeyMap[firstKey] || (firstKey as keyof CachedState)
        if (typeof (this.cache as any)[mappedKey] === 'undefined') {
          (this.cache as any)[mappedKey] = {}
        }

        let target = (this.cache as any)[mappedKey]

        for (let i = 0; i < remainingKeys.length - 1; i++) {
          const key = remainingKeys[i]
          if (typeof target[key] !== 'object' || target[key] === null) {
            target[key] = {}
          }
          target = target[key]
        }

        const finalKey = remainingKeys[remainingKeys.length - 1]
        target[finalKey] = value
        return
      }

      const keys = path.split('.').filter(Boolean)
      if (keys.length === 0) {
        return
      }

      let target = this.cache as any

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (typeof target[key] !== 'object' || target[key] === null) {
          target[key] = {}
        }
        target = target[key]
      }

      target[keys[keys.length - 1]] = value
    },

    handleStateUpdate(message: { path?: string; value?: unknown }) {
      if (!message?.path) {
        return
      }

      this.updateCache(message.path, message.value ?? null)
    },

    // Utility method for sending messages to background
    async sendMessage(message: any, retries = 3): Promise<any> {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await new Promise((resolve, reject) => {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
              reject(new Error('Extension context invalidated'))
              return
            }

            const messageWithId = {
              ...message,
              id: crypto.randomUUID()
            }

            chrome.runtime.sendMessage(messageWithId, (response: any) => {
              const lastError = chrome.runtime.lastError

              if (lastError) {
                // Check for specific connection errors
                if (lastError.message?.includes('Could not establish connection') ||
                    lastError.message?.includes('Receiving end does not exist')) {
                  resolve({
                    type: 'ERROR',
                    error: {
                      message: 'Background script not ready'
                    }
                  })
                } else {
                  reject(new Error(lastError.message))
                }
                return
              }

              if (response?.type === 'ERROR') {
                reject(new Error(response.error.message))
                return
              }

              resolve(response)
            })
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)

          // Only retry for connection errors
          if (errorMessage.includes('Background script not ready')) {
            if (attempt < retries - 1) {
              console.warn(`Connection attempt ${attempt + 1} failed, retrying in ${(attempt + 1) * 100}ms...`)
              await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 100))
              continue
            }
            return { type: 'ERROR', error: { message: errorMessage } }
          }

          throw error
        }
      }

      return { type: 'ERROR', error: { message: 'Request failed' } }
    },

    // Check if background connection is available
    async checkConnection(): Promise<boolean> {
      try {
        if (!chrome.runtime?.id) {
          return false
        }

        await this.sendMessage({ type: 'GET_CURRENT_TAB_INFO' }, 1)
        return true
      } catch (error) {
        console.warn('Background connection not available:', error)
        return false
      }
    },

    // Initialize store by fetching initial data from background
    async initialize() {
      this.setLoading(true)

      try {
        // Check connection first
        const connectionAvailable = await this.checkConnection()
        if (!connectionAvailable) {
          console.warn('Background script not ready, using fallback state')
          this.setLoading(false)
          return
        }

        // Fetch initial shared state
        const [currentTask, recentPages, currentTab, extensionChatHistory] = await Promise.all([
          this.sendMessage({ type: 'GET_ACTIVE_TASK' }),
          this.sendMessage({ type: 'GET_RECENT_PAGES' }),
          this.sendMessage({ type: 'GET_CURRENT_TAB_INFO' }),
          this.sendMessage({ type: 'GET_EXTENSION_CHAT_HISTORY' })
        ])

        // Update cache
        this.cache.currentTask = currentTask.data
        this.cache.recentPages = recentPages.data || []
        this.cache.currentTabInfo = currentTab.data
        this.cache.recentChats = Array.isArray(extensionChatHistory.data)
          ? extensionChatHistory.data.map((entry: any) => ({
              ...entry,
              timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
            }))
          : []

      } catch (error) {
        console.error('Failed to initialize side panel store:', error)
        this.addNotification({
          type: 'error',
          message: 'Failed to load initial data'
        })
      } finally {
        this.setLoading(false)
      }
    }
  }
})
