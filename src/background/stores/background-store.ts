// Background store - Master state management using Strategy A

import { defineStore } from 'pinia'
import { PageEntry, TaskEntry, NoteEntry } from '../../shared/models'

export interface BrowserSearchQuery {
  id: string
  query: string
  source: 'browser'
  url: string
  extractedQuery: string
  searchEngine: 'google' | 'bing' | 'duckduckgo' | 'other'
  timestamp: Date
}

export interface ExtensionSearchQuery {
  id: string
  query: string
  source: 'extension'
  context: 'omnibox' | 'sidepanel' | 'popup'
  timestamp: Date
  filters?: {
    tags?: string[]
    task?: string
    type?: 'page' | 'note' | 'task'
  }
}

export interface BrowserChatMessage {
  id: string
  content: string
  source: 'browser'
  platform: 'chatgpt' | 'claude' | 'bard' | 'copilot' | 'other'
  url: string
  conversationId?: string
  role: 'user' | 'assistant'
  extractedFrom: 'url' | 'dom'
  timestamp: Date
}

export interface ExtensionChatMessage {
  id: string
  content: string
  source: 'extension'
  command?: string
  relatedPages?: string[]
  relatedTask?: string
  timestamp: Date
}

export interface BrowserState {
  windows: chrome.windows.Window[]
  currentWindow: chrome.windows.Window | null
  currentTab: chrome.tabs.Tab | null
  currentUrl: string
  tabHistory: Array<{
    url: string
    title: string
    timestamp: Date
    favicon?: string
  }>

  // Browser-sourced search/chat
  browserSearchHistory: BrowserSearchQuery[]
  browserChatHistory: BrowserChatMessage[]
}

export interface UserContextState {
  // Core workflow state
  currentTask: TaskEntry | null
  previousTask: TaskEntry | null
  workingSet: PageEntry[]  // Recently accessed pages

  // Extension search/chat
  extensionSearchHistory: ExtensionSearchQuery[]
  extensionChatHistory: ExtensionChatMessage[]

  // User preferences
  settings: {
    defaultCloseAfterSave: boolean
    maxSearchHistory: number
    maxChatHistory: number
    autoDetectSearchQueries: boolean
    autoDetectChatMessages: boolean
    preferredSearchEngine: string
  }

  // Analytics/insights
  stats: {
    totalPagesSaved: number
    totalSearches: number
    totalChatMessages: number
    mostUsedTags: Array<{ tag: string; count: number }>
    dailyActivity: Array<{ date: string; pages: number; searches: number }>
  }
}

export interface AppState {
  isFirstRun: boolean
  version: string
  lastSyncTime: Date
  isOnline: boolean
  lastBackup?: Date
}

export interface BackgroundState {
  browser: BrowserState
  user: UserContextState
  app: AppState
}

export const useBackgroundStore = defineStore('background', {
  state: (): BackgroundState => ({
    browser: {
      windows: [],
      currentWindow: null,
      currentTab: null,
      currentUrl: '',
      tabHistory: [],
      browserSearchHistory: [],
      browserChatHistory: []
    },

    user: {
      currentTask: null,
      previousTask: null,
      workingSet: [],
      extensionSearchHistory: [],
      extensionChatHistory: [],

      settings: {
        defaultCloseAfterSave: false,
        maxSearchHistory: 1000,
        maxChatHistory: 1000,
        autoDetectSearchQueries: true,
        autoDetectChatMessages: true,
        preferredSearchEngine: 'google'
      },

      stats: {
        totalPagesSaved: 0,
        totalSearches: 0,
        totalChatMessages: 0,
        mostUsedTags: [],
        dailyActivity: []
      }
    },

    app: {
      isFirstRun: true,
      version: '0.0.1',
      lastSyncTime: new Date(),
      isOnline: true
    }
  }),

  getters: {
    // Combined search history with source indication
    allSearchHistory: (state): Array<BrowserSearchQuery | ExtensionSearchQuery> => [
      ...state.browser.browserSearchHistory,
      ...state.user.extensionSearchHistory
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),

    // Combined chat history with source indication
    allChatHistory: (state): Array<BrowserChatMessage | ExtensionChatMessage> => [
      ...state.browser.browserChatHistory,
      ...state.user.extensionChatHistory
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),

    // Recent activity summary
    recentActivity: (state) => {
      const recent = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

      return {
        searches: state.browser.browserSearchHistory
          .filter(s => s.timestamp > recent).length +
          state.user.extensionSearchHistory
          .filter(s => s.timestamp > recent).length,

        chats: state.browser.browserChatHistory
          .filter(c => c.timestamp > recent).length +
          state.user.extensionChatHistory
          .filter(c => c.timestamp > recent).length,

        tabSwitches: state.browser.tabHistory
          .filter(t => t.timestamp > recent).length
      }
    },

    // Context for current page
    currentPageContext: (state) => {
      if (!state.browser.currentUrl) return null

      const recentSearches = state.browser.browserSearchHistory
        .filter(s => s.timestamp > new Date(Date.now() - 30 * 60 * 1000)) // Last 30 min

      const recentChats = state.browser.browserChatHistory
        .filter(c => c.timestamp > new Date(Date.now() - 30 * 60 * 1000))

      return {
        url: state.browser.currentUrl,
        task: state.user.currentTask,
        recentSearches,
        recentChats,
        workingSet: state.user.workingSet
      }
    }
  },

  actions: {
    // Initialize store with persisted data
    async initialize(container?: any) {
      try {
        if (!container) {
          throw new Error('Container instance is required for initialization')
        }

        // Load active task from database
        const activeTask = await container.taskUseCases.getActiveTask()

        if (activeTask) {
          this.user.currentTask = activeTask
          console.log('[Background Store] Loaded active task:', activeTask.name)
        }

        // Mark app as initialized
        this.app.isFirstRun = false
      } catch (error) {
        console.error('[Background Store] Failed to initialize:', error)
      }
    },

    // Browser state management
    updateCurrentTab(tab: chrome.tabs.Tab) {
      if (this.browser.currentTab?.url !== tab.url) {
        // Tab changed, add to history
        if (this.browser.currentTab) {
          this.addToTabHistory(this.browser.currentTab)
        }
      }

      this.browser.currentTab = tab
      this.browser.currentUrl = tab.url || ''

      // Try to extract search query if it's a search engine
      this.detectBrowserSearch(tab.url || '')
    },

    addToTabHistory(tab: chrome.tabs.Tab) {
      this.browser.tabHistory.unshift({
        url: tab.url || '',
        title: tab.title || '',
        timestamp: new Date(),
        favicon: tab.favIconUrl
      })

      // Keep only last 100 tabs
      if (this.browser.tabHistory.length > 100) {
        this.browser.tabHistory = this.browser.tabHistory.slice(0, 100)
      }
    },

    // Search detection from browser URLs
    detectBrowserSearch(url: string) {
      if (!this.user.settings.autoDetectSearchQueries) return

      const searchPatterns = {
        google: /[?&]q=([^&]+)/,
        bing: /[?&]q=([^&]+)/,
        duckduckgo: /[?&]q=([^&]+)/
      }

      let searchEngine: keyof typeof searchPatterns | 'other' = 'other'
      let match: RegExpMatchArray | null = null

      for (const [engine, pattern] of Object.entries(searchPatterns)) {
        if (url.includes(engine) && (match = url.match(pattern))) {
          searchEngine = engine as keyof typeof searchPatterns
          break
        }
      }

      if (match) {
        const query = decodeURIComponent(match[1].replace(/\+/g, ' '))
        this.addBrowserSearch({
          query,
          url,
          searchEngine: searchEngine as any
        })
      }
    },

    addBrowserSearch(params: {
      query: string
      url: string
      searchEngine: 'google' | 'bing' | 'duckduckgo' | 'other'
    }) {
      const searchQuery: BrowserSearchQuery = {
        id: crypto.randomUUID(),
        query: params.query,
        source: 'browser',
        url: params.url,
        extractedQuery: params.query,
        searchEngine: params.searchEngine,
        timestamp: new Date()
      }

      this.browser.browserSearchHistory.unshift(searchQuery)

      // Keep within limit
      if (this.browser.browserSearchHistory.length > this.user.settings.maxSearchHistory) {
        this.browser.browserSearchHistory = this.browser.browserSearchHistory
          .slice(0, this.user.settings.maxSearchHistory)
      }

      this.user.stats.totalSearches++
      this.broadcastStateUpdate('browser.browserSearchHistory', this.browser.browserSearchHistory)
    },

    addExtensionSearch(params: {
      query: string
      context: 'omnibox' | 'sidepanel' | 'popup'
      filters?: ExtensionSearchQuery['filters']
    }) {
      const searchQuery: ExtensionSearchQuery = {
        id: crypto.randomUUID(),
        query: params.query,
        source: 'extension',
        context: params.context,
        timestamp: new Date(),
        filters: params.filters
      }

      this.user.extensionSearchHistory.unshift(searchQuery)

      if (this.user.extensionSearchHistory.length > this.user.settings.maxSearchHistory) {
        this.user.extensionSearchHistory = this.user.extensionSearchHistory
          .slice(0, this.user.settings.maxSearchHistory)
      }

      this.user.stats.totalSearches++
      this.broadcastStateUpdate('user.extensionSearchHistory', this.user.extensionSearchHistory)
    },

    // Task management
    async setCurrentTask(task: TaskEntry | null) {
      if (this.user.currentTask) {
        this.user.previousTask = this.user.currentTask
      }
      this.user.currentTask = task

      this.broadcastStateUpdate('user.currentTask', task)
      this.broadcastStateUpdate('user.previousTask', this.user.previousTask)
    },

    // Chat management
    addBrowserChat(params: {
      content: string
      platform: 'chatgpt' | 'claude' | 'bard' | 'copilot' | 'other'
      url: string
      role: 'user' | 'assistant'
      conversationId?: string
    }) {
      const chatMessage: BrowserChatMessage = {
        id: crypto.randomUUID(),
        content: params.content,
        source: 'browser',
        platform: params.platform,
        url: params.url,
        role: params.role,
        extractedFrom: 'dom',
        timestamp: new Date(),
        conversationId: params.conversationId
      }

      this.browser.browserChatHistory.unshift(chatMessage)

      if (this.browser.browserChatHistory.length > this.user.settings.maxChatHistory) {
        this.browser.browserChatHistory = this.browser.browserChatHistory
          .slice(0, this.user.settings.maxChatHistory)
      }

      this.user.stats.totalChatMessages++
      this.broadcastStateUpdate('browser.browserChatHistory', this.browser.browserChatHistory)
    },

    addExtensionChat(params: {
      content: string
      command?: string
      relatedPages?: string[]
      relatedTask?: string
    }) {
      const chatMessage: ExtensionChatMessage = {
        id: crypto.randomUUID(),
        content: params.content,
        source: 'extension',
        timestamp: new Date(),
        command: params.command,
        relatedPages: params.relatedPages,
        relatedTask: params.relatedTask || this.user.currentTask?.name
      }

      this.user.extensionChatHistory.unshift(chatMessage)

      if (this.user.extensionChatHistory.length > this.user.settings.maxChatHistory) {
        this.user.extensionChatHistory = this.user.extensionChatHistory
          .slice(0, this.user.settings.maxChatHistory)
      }

      this.user.stats.totalChatMessages++
      this.broadcastStateUpdate('user.extensionChatHistory', this.user.extensionChatHistory)
    },

    // State broadcasting to side panel
    broadcastStateUpdate(path: string, value: any) {
      try {
        chrome.runtime.sendMessage({
          type: 'STATE_UPDATE',
          path,
          value,
          timestamp: new Date().toISOString()
        }, () => {
          const error = chrome.runtime.lastError
          if (error && error.message && !error.message.includes('Receiving end does not exist')) {
            console.warn('[Background Store] Failed to broadcast state update:', error.message)
          }
        })
      } catch (error) {
        console.warn('Failed to broadcast state update:', error)
      }
    },

    // Working set management
    addToWorkingSet(page: PageEntry) {
      const existing = this.user.workingSet.findIndex(p => p.id === page.id)
      if (existing >= 0) {
        // Move to front
        this.user.workingSet.splice(existing, 1)
      }

      this.user.workingSet.unshift(page)

      // Keep only last 20 pages
      if (this.user.workingSet.length > 20) {
        this.user.workingSet = this.user.workingSet.slice(0, 20)
      }

      this.broadcastStateUpdate('user.workingSet', this.user.workingSet)
    }
  }
})
