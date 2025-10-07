// Background store - Master state management using Strategy A

import { defineStore } from 'pinia'
import { PageEntry, TaskEntry, UserSettings } from '../../shared/models'

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
  componentData?: any
  responseType?: string
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
  searchTabs: Record<string, { tabId: number; windowId?: number }>
}

export interface UserContextState {
  // Core workflow state
  currentTask: TaskEntry | null
  previousTask: TaskEntry | null
  workingSet: PageEntry[]  // Recently accessed pages

  // Extension search/chat
  extensionSearchHistory: ExtensionSearchQuery[]
  extensionChatHistory: ExtensionChatMessage[]
  lastSearchContext: {
    query: string
    engine: string
    recordedAt: Date
  } | null

  // User preferences
  settings: UserSettings

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
      browserChatHistory: [],
      searchTabs: {}
    },

    user: {
      currentTask: null,
      previousTask: null,
      workingSet: [],
      extensionSearchHistory: [],
      extensionChatHistory: [],
      lastSearchContext: null,

      settings: {
        defaultCloseAfterSave: false,
        maxSearchHistory: 1000,
        maxChatHistory: 1000,
        autoDetectSearchQueries: true,
        autoDetectChatMessages: true,
        preferredSearchEngine: 'google',
        preferredAiProvider: 'chatgpt',
        reuseAiTab: true,
        aiLogLevel: 'info', // Default to info level for minimal logging
        versionManagement: {
          autoSave: {
            enabled: true,
            interval: 300000, // 5 minutes
            mode: 'smart',
            contentThreshold: 100,
            smartTriggers: {
              significantEdits: true,
              milestoneMarkers: true,
              beforeSave: true,
              periodically: true,
              beforeClose: true
            }
          },
          storage: {
            maxVersionsPerDocument: 50,
            autoCleanup: {
              enabled: true,
              strategy: 'smart',
              keepCount: 20,
              maxAgeHours: 2160, // 90 days
              smartRetention: {
                keepMilestones: true,
                keepBranches: true,
                keepTagged: true,
                keepRecent: 10
              }
            },
            compressionEnabled: true,
            deduplicationEnabled: true
          },
          ui: {
            showVersionCount: true,
            showLastModified: true,
            defaultVersionView: 'list',
            enableQuickRestore: true,
            showDiffPreview: true,
            groupByDate: false,
            enableKeyboardShortcuts: true
          },
          advanced: {
            enableVersionBranching: false,
            enableSemanticTags: true,
            autoTagging: {
              enabled: true,
              detectMilestones: true,
              detectBreakingChanges: false,
              customPatterns: []
            },
            exportFormats: ['json', 'markdown'],
            enableAuditTrail: true,
            enableCollaboration: false
          }
        }
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
    async loadSettingsFromStorage() {
      try {
        console.log('[Background Store] Loading settings from storage...')
        const result = await chrome.storage.local.get(['userSettings'])
        const stored = result?.userSettings

        if (stored && typeof stored === 'object') {
          console.log('[Background Store] Found stored settings, merging with defaults...')

          // Safely merge version management settings
          let versionManagementSettings = this.user.settings.versionManagement
          try {
            if (stored.versionManagement && typeof stored.versionManagement === 'object') {
              versionManagementSettings = {
                ...this.user.settings.versionManagement,
                autoSave: {
                  ...this.user.settings.versionManagement.autoSave,
                  ...(stored.versionManagement.autoSave || {})
                },
                storage: {
                  ...this.user.settings.versionManagement.storage,
                  ...(stored.versionManagement.storage || {})
                },
                ui: {
                  ...this.user.settings.versionManagement.ui,
                  ...(stored.versionManagement.ui || {})
                },
                advanced: {
                  ...this.user.settings.versionManagement.advanced,
                  ...(stored.versionManagement.advanced || {})
                }
              }
            }
          } catch (vmError) {
            console.warn('[Background Store] Error merging version management settings, using defaults:', vmError)
          }

          // Merge with defaults
          this.user.settings = {
            ...this.user.settings,
            ...stored,
            versionManagement: versionManagementSettings
          }

          // Legacy migrations
          if (!this.user.settings.preferredAiProvider) {
            this.user.settings.preferredAiProvider = 'chatgpt'
          }
          if (typeof this.user.settings.reuseAiTab !== 'boolean') {
            this.user.settings.reuseAiTab = true
          }
          if (!this.user.settings.aiLogLevel || !['info', 'debug'].includes(this.user.settings.aiLogLevel)) {
            this.user.settings.aiLogLevel = 'info' // Default to info level
          }

          // Initialize version management settings if needed
          if (!stored.versionManagement) {
            console.log('[Background Store] Initializing version management settings with defaults')
            try {
              await this.saveSettingsToStorage()
            } catch (saveError) {
              console.warn('[Background Store] Failed to save initial version management settings:', saveError)
            }
          }

          this.broadcastStateUpdate('user.settings', this.user.settings)
        } else {
          console.log('[Background Store] No stored settings found, using defaults')
        }
      } catch (error) {
        console.error('[Background Store] Failed to load user settings from storage:', error)
        throw error // Re-throw to help identify initialization issues
      }
    },

    async saveSettingsToStorage() {
      try {
        await chrome.storage.local.set({ userSettings: this.user.settings })
        console.log('[Background Store] Settings saved to storage')
      } catch (error) {
        console.warn('[Background Store] Failed to save settings to storage:', error)
      }
    },

    async updateVersionManagementSettings(updates: Partial<UserSettings['versionManagement']>) {
      // Validate and merge the updates
      const validatedUpdates = this.validateVersionManagementUpdates(updates)

      this.user.settings.versionManagement = {
        ...this.user.settings.versionManagement,
        ...validatedUpdates
      }
      await this.saveSettingsToStorage()
      this.broadcastStateUpdate('user.settings', this.user.settings)
    },

    validateVersionManagementUpdates(updates: Partial<UserSettings['versionManagement']>): Partial<UserSettings['versionManagement']> {
      const validated: Partial<UserSettings['versionManagement']> = {}

      if (updates.autoSave) {
        validated.autoSave = {
          ...this.user.settings.versionManagement.autoSave,
          ...updates.autoSave
        }

        // Validate interval (min 30 seconds, max 1 hour)
        if (validated.autoSave.interval !== undefined) {
          validated.autoSave.interval = Math.max(30000, Math.min(3600000, validated.autoSave.interval))
        }

        // Validate content threshold (min 10 chars, max 10000)
        if (validated.autoSave.contentThreshold !== undefined) {
          validated.autoSave.contentThreshold = Math.max(10, Math.min(10000, validated.autoSave.contentThreshold))
        }
      }

      if (updates.storage) {
        validated.storage = {
          ...this.user.settings.versionManagement.storage,
          ...updates.storage
        }

        // Validate max versions (min 5, max 1000)
        if (validated.storage.maxVersionsPerDocument !== undefined) {
          validated.storage.maxVersionsPerDocument = Math.max(5, Math.min(1000, validated.storage.maxVersionsPerDocument))
        }

        if (validated.storage.autoCleanup) {
          // Validate keep count (min 3, max 100)
          if (validated.storage.autoCleanup.keepCount !== undefined) {
            validated.storage.autoCleanup.keepCount = Math.max(3, Math.min(100, validated.storage.autoCleanup.keepCount))
          }

          // Validate max age (min 24 hours, max 1 year)
          if (validated.storage.autoCleanup.maxAgeHours !== undefined) {
            validated.storage.autoCleanup.maxAgeHours = Math.max(24, Math.min(8760, validated.storage.autoCleanup.maxAgeHours))
          }

          if (validated.storage.autoCleanup.smartRetention?.keepRecent !== undefined) {
            validated.storage.autoCleanup.smartRetention.keepRecent = Math.max(1, Math.min(20, validated.storage.autoCleanup.smartRetention.keepRecent))
          }
        }
      }

      if (updates.ui) {
        validated.ui = {
          ...this.user.settings.versionManagement.ui,
          ...updates.ui
        }
      }

      if (updates.advanced) {
        validated.advanced = {
          ...this.user.settings.versionManagement.advanced,
          ...updates.advanced
        }

        if (validated.advanced.autoTagging?.customPatterns) {
          // Limit to 20 patterns, each max 100 chars
          validated.advanced.autoTagging.customPatterns = validated.advanced.autoTagging.customPatterns
            .slice(0, 20)
            .map(pattern => pattern.substring(0, 100))
            .filter(pattern => pattern.trim().length > 0)
        }

        if (validated.advanced.exportFormats) {
          // Only allow known formats
          const allowedFormats = ['json', 'markdown', 'txt', 'html', 'pdf']
          validated.advanced.exportFormats = validated.advanced.exportFormats.filter(
            format => allowedFormats.includes(format)
          )
        }
      }

      return validated
    },

    calculateStorageImpact(settings: UserSettings['versionManagement']): {
      estimatedSizePerDocument: number
      recommendedMaxDocuments: number
      estimatedTotalSize: number
      warnings: string[]
    } {
      const warnings: string[] = []
      const avgDocumentSize = 50000 // 50KB average
      const compressionRatio = settings.storage.compressionEnabled ? 0.6 : 1.0
      const versionOverhead = 2000 // 2KB metadata per version

      const estimatedSizePerDocument = (
        (avgDocumentSize * compressionRatio + versionOverhead) *
        settings.storage.maxVersionsPerDocument
      )

      const availableStorage = 100 * 1024 * 1024 // 100MB typical extension storage
      const recommendedMaxDocuments = Math.floor(availableStorage * 0.8 / estimatedSizePerDocument)
      const estimatedTotalSize = estimatedSizePerDocument * recommendedMaxDocuments

      if (settings.storage.maxVersionsPerDocument > 100) {
        warnings.push('High version count may impact performance')
      }

      if (!settings.storage.autoCleanup.enabled) {
        warnings.push('Manual cleanup required to prevent storage overflow')
      }

      if (settings.autoSave.enabled && settings.autoSave.interval < 60000) {
        warnings.push('Frequent auto-save may create many versions')
      }

      return {
        estimatedSizePerDocument,
        recommendedMaxDocuments,
        estimatedTotalSize,
        warnings
      }
    },

    async setPreferredSearchEngine(engine: string) {
      const normalized = (engine || '').toLowerCase()
      const allowedEngines = ['google', 'duckduckgo', 'bing']
      if (!allowedEngines.includes(normalized)) {
        throw new Error(`Unsupported search engine: ${engine}`)
      }

      if (this.user.settings.preferredSearchEngine === normalized) {
        return
      }

      this.user.settings.preferredSearchEngine = normalized

      try {
        await chrome.storage.local.set({ userSettings: this.user.settings })
      } catch (error) {
        console.warn('[Background Store] Failed to persist user settings:', error)
      }

      this.broadcastStateUpdate('user.settings', this.user.settings)
    },

    async setPreferredAiProvider(provider: string) {
      const normalized = (provider || '').toLowerCase()
      const allowedProviders = ['chatgpt', 'claude', 'perplexity', 'copilot', 'gemini']
      if (!allowedProviders.includes(normalized)) {
        throw new Error(`Unsupported AI provider: ${provider}`)
      }

      if (this.user.settings.preferredAiProvider === normalized) {
        return
      }

      this.user.settings.preferredAiProvider = normalized

      try {
        await chrome.storage.local.set({ userSettings: this.user.settings })
      } catch (error) {
        console.warn('[Background Store] Failed to persist AI provider setting:', error)
      }

      this.broadcastStateUpdate('user.settings', this.user.settings)
    },

    async setAiTabReusePreference(reuse: boolean) {
      if (this.user.settings.reuseAiTab === reuse) {
        return
      }

      this.user.settings.reuseAiTab = reuse

      try {
        await chrome.storage.local.set({ userSettings: this.user.settings })
      } catch (error) {
        console.warn('[Background Store] Failed to persist AI tab preference:', error)
      }

      this.broadcastStateUpdate('user.settings', this.user.settings)
    },

    async setAiLogLevelPreference(logLevel: 'info' | 'debug') {
      if (this.user.settings.aiLogLevel === logLevel) {
        return
      }

      this.user.settings.aiLogLevel = logLevel

      try {
        await chrome.storage.local.set({ userSettings: this.user.settings })
      } catch (error) {
        console.warn('[Background Store] Failed to persist AI log level preference:', error)
      }

      this.broadcastStateUpdate('user.settings', this.user.settings)
    },

    setLastSearchContext(context: { query: string; engine: string }) {
      this.user.lastSearchContext = {
        query: context.query,
        engine: context.engine,
        recordedAt: new Date()
      }

      this.broadcastStateUpdate('user.lastSearchContext', this.user.lastSearchContext)
    },

    getActiveSearchContext(maxAgeMs = 10 * 60 * 1000): { query: string; engine: string; recordedAt: Date } | null {
      const context = this.user.lastSearchContext
      if (!context) {
        return null
      }

      const age = Date.now() - context.recordedAt.getTime()
      if (age > maxAgeMs) {
        return null
      }

      return context
    },

    setLastSearchTab(engine: string, info: { tabId: number; windowId?: number }) {
      if (!engine) {
        return
      }

      this.browser.searchTabs[engine] = {
        tabId: info.tabId,
        windowId: info.windowId
      }
    },

    getLastSearchTab(engine: string): { tabId: number; windowId?: number } | null {
      if (!engine) {
        return null
      }

      return this.browser.searchTabs[engine] ?? null
    },

    clearLastSearchTab(engine: string) {
      if (!engine) {
        return
      }

      delete this.browser.searchTabs[engine]
    },

    clearSearchTabById(tabId: number) {
      if (typeof tabId !== 'number') {
        return
      }

      Object.entries(this.browser.searchTabs).forEach(([engine, info]) => {
        if (info.tabId === tabId) {
          delete this.browser.searchTabs[engine]
        }
      })
    },

    // Initialize store with persisted data
    async initialize(container?: any) {
      try {
        if (!container) {
          throw new Error('Container instance is required for initialization')
        }

        await this.loadSettingsFromStorage()

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
      componentData?: any
      responseType?: string
    }) {
      const chatMessage: ExtensionChatMessage = {
        id: crypto.randomUUID(),
        content: params.content,
        source: 'extension',
        timestamp: new Date(),
        command: params.command,
        relatedPages: params.relatedPages,
        relatedTask: params.relatedTask || this.user.currentTask?.name,
        componentData: params.componentData,
        responseType: params.responseType
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
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        path,
        value,
        timestamp: new Date().toISOString()
      }, () => {
        const error = chrome.runtime.lastError
        if (!error || !error.message) {
          return
        }

        const message = error.message
        if (message.includes('Receiving end does not exist') ||
            message.includes('Could not establish connection') ||
            message.includes('The message port closed before a response was received')) {
          return
        }

        console.warn('[Background Store] Failed to broadcast state update:', message)
      })
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
    },

    async updateAIAutomationSettings(settings: import('../../shared/messaging/ai-types').AIAutomationSettings) {
      this.user.settings.aiAutomation = settings
      await this.saveSettingsToStorage()
      this.broadcastStateUpdate('user.settings', this.user.settings)
    }
  }
})
