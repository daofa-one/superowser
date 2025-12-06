/**
 * Centralized logging utility for the Superowser extension
 * Provides configurable log levels per component category
 */

import type { LogLevel, LogCategory, LogLevelSettings } from '../models'
import { getDefaultLogLevels } from '../models'

export interface LoggerConfig {
  level: LogLevel
  prefix?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

// Component name → Category mapping
const COMPONENT_CATEGORY_MAP: Record<string, LogCategory> = {
  // Background
  'BackgroundStore': 'background',
  'Background Store': 'background',
  'MessageHandler': 'background',
  'OmniboxHandler': 'background',
  'omnibox': 'background',
  'TabHandler': 'background',
  'DexieRepository': 'background',
  'Dexie': 'background',
  'StateSync': 'background',
  'Container': 'background',

  // Business Logic
  'PageUseCases': 'business-logic',
  'TaskUseCases': 'business-logic',
  'NotesUseCases': 'business-logic',
  'DocumentsUseCases': 'business-logic',
  'SearchUseCases': 'business-logic',
  'SearchService': 'business-logic',
  'FuzzySearchService': 'business-logic',
  'VersionComparisonService': 'business-logic',
  'TabManagementService': 'business-logic',
  'MLService': 'business-logic',
  'AnalyticsService': 'business-logic',

  // Commands
  'CommandService': 'commands',
  'CommandRegistry': 'commands',
  'CommandExecutor': 'commands',
  'CommandParser': 'commands',
  'IntegratedCommandService': 'commands',
  'NewTaskCommand': 'commands',
  'SetTaskCommand': 'commands',
  'TasksCommand': 'commands',
  'FindCommand': 'commands',
  '/find': 'commands',
  '/save autocomplete': 'commands',

  // AI
  'AIBridge': 'ai',
  'AI Bridge': 'ai',
  'AIAutomationHandler': 'ai',
  'AI Automation': 'ai',
  'AI Command': 'ai',
  'Superowser AI Bridge': 'ai',

  // UI
  'SidepanelStore': 'ui',
  'Sidepanel': 'ui',
  'ChatBox': 'ui',
  'TaskList': 'ui',
  'CurrentPageInfo': 'ui',
  'TaskManager': 'ui',
  'TaskShortcuts': 'ui',
  'Menu': 'ui',
  'SearchResultList': 'ui',
  'NotesList': 'ui',
  'Notes': 'ui',
  'Options': 'ui',

  // Authoring
  'AuthoringWorkspace': 'authoring',
  'DocumentState': 'authoring',
  'VersionManager': 'authoring',
  'useDocumentState': 'authoring',
  'usePreview': 'authoring',
  'useTitleEditing': 'authoring',

  // Infrastructure
  'Logger': 'infrastructure',
  'MessageClient': 'infrastructure',
  'Messaging': 'infrastructure',
  'MessageUtils': 'infrastructure',
  'UrlUtils': 'infrastructure',
  'url-utils': 'infrastructure',
  'VersionUtils': 'infrastructure',
  'version-utils': 'infrastructure',

  // Content Scripts
  'ContentScript': 'content-scripts',
  'Content': 'content-scripts',
  'AIBridgeContentScript': 'content-scripts'
}

// Cache for component category lookups
const categoryCache = new Map<string, LogCategory>()

// Determine category from component name
function getCategoryForComponent(componentName: string): LogCategory {
  // Check cache first
  if (categoryCache.has(componentName)) {
    return categoryCache.get(componentName)!
  }

  // Exact match
  if (COMPONENT_CATEGORY_MAP[componentName]) {
    const category = COMPONENT_CATEGORY_MAP[componentName]
    categoryCache.set(componentName, category)
    return category
  }

  // Partial match (case-insensitive)
  const normalizedName = componentName.toLowerCase()
  for (const [key, category] of Object.entries(COMPONENT_CATEGORY_MAP)) {
    if (normalizedName.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(normalizedName)) {
      categoryCache.set(componentName, category)
      return category
    }
  }

  // Default fallback
  const defaultCategory = 'infrastructure' as LogCategory
  categoryCache.set(componentName, defaultCategory)
  return defaultCategory
}

class Logger {
  private config: LoggerConfig = { level: 'error' }
  private logLevels: LogLevelSettings = getDefaultLogLevels()
  private isInitialized = false

  constructor() {
    this.initializeLogLevel()
  }

  private async initializeLogLevel() {
    try {
      // For content scripts and other contexts that can't access chrome.storage directly
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_USER_SETTINGS',
            data: { keys: ['logLevels', 'aiLogLevel'] }
          })

          if (response?.settings?.logLevels) {
            // Use new component-based settings
            this.logLevels = {
              ...getDefaultLogLevels(),
              ...response.settings.logLevels
            }
          } else if (response?.settings?.aiLogLevel) {
            // Migrate from old aiLogLevel setting
            const legacyLevel = response.settings.aiLogLevel === 'debug' ? 'debug' : 'info'
            this.logLevels = this.migrateLegacyLogLevel(legacyLevel)
          }

          // Set global level for backward compatibility
          this.config.level = this.getGlobalLogLevel()
        } catch (error) {
          // Fallback for contexts where messaging isn't available
          this.logLevels = getDefaultLogLevels()
          this.config.level = 'error'
        }
      }
    } catch (error) {
      this.logLevels = getDefaultLogLevels()
      this.config.level = 'error'
    }
    this.isInitialized = true
  }

  // Migrate old aiLogLevel to new structure
  private migrateLegacyLogLevel(legacyLevel: 'info' | 'debug'): LogLevelSettings {
    const level: LogLevel = legacyLevel === 'debug' ? 'debug' : 'info'
    return {
      background: level,
      'business-logic': level,
      commands: level,
      ai: level,
      ui: level,
      authoring: level,
      infrastructure: level,
      'content-scripts': level
    }
  }

  // Calculate global log level (most verbose category)
  private getGlobalLogLevel(): LogLevel {
    const levels = Object.values(this.logLevels)
    if (levels.some(l => l === 'debug')) return 'debug'
    if (levels.some(l => l === 'info')) return 'info'
    if (levels.some(l => l === 'warn')) return 'warn'
    return 'error'
  }

  // Check if should log for specific component
  private shouldLog(level: LogLevel, componentName: string): boolean {
    const category = getCategoryForComponent(componentName)
    const categoryLevel = this.logLevels[category]
    return LOG_LEVELS[level] <= LOG_LEVELS[categoryLevel]
  }

  private formatMessage(level: LogLevel, component: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`
    return [prefix, ...args]
  }

  error(component: string, ...args: any[]) {
    if (this.shouldLog('error', component)) {
      console.error(...this.formatMessage('error', component, ...args))
    }
  }

  warn(component: string, ...args: any[]) {
    if (this.shouldLog('warn', component)) {
      console.warn(...this.formatMessage('warn', component, ...args))
    }
  }

  info(component: string, ...args: any[]) {
    if (this.shouldLog('info', component)) {
      console.log(...this.formatMessage('info', component, ...args))
    }
  }

  debug(component: string, ...args: any[]) {
    if (this.shouldLog('debug', component)) {
      console.log(...this.formatMessage('debug', component, ...args))
    }
  }

  // Method to update log level (for when settings change)
  setLogLevel(level: LogLevel) {
    this.config.level = level
  }

  // Method to update log levels dynamically
  setLogLevels(levels: Partial<LogLevelSettings>) {
    this.logLevels = {
      ...this.logLevels,
      ...levels
    }
    this.config.level = this.getGlobalLogLevel()
  }

  // Diagnostic method to show current configuration
  getLogConfiguration(): { category: LogCategory; level: LogLevel }[] {
    return Object.entries(this.logLevels).map(([category, level]) => ({
      category: category as LogCategory,
      level
    }))
  }

  // Convenience method to create a component-specific logger
  createComponentLogger(componentName: string) {
    return {
      error: (...args: any[]) => this.error(componentName, ...args),
      warn: (...args: any[]) => this.warn(componentName, ...args),
      info: (...args: any[]) => this.info(componentName, ...args),
      debug: (...args: any[]) => this.debug(componentName, ...args)
    }
  }
}

// Global logger instance
export const logger = new Logger()

// Convenience function for quick component loggers
export function createLogger(componentName: string) {
  return logger.createComponentLogger(componentName)
}

// For content scripts that need standalone logging (since they can't import modules)
export function createStandaloneLogger(componentName: string, logLevel: LogLevel = 'error') {
  const LOG_LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  }

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] <= LOG_LEVELS[logLevel]
  }

  const formatMessage = (level: LogLevel, ...args: any[]): any[] => {
    const timestamp = new Date().toISOString().slice(11, 23)
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${componentName}]`
    return [prefix, ...args]
  }

  return {
    error: (...args: any[]) => {
      if (shouldLog('error')) console.error(...formatMessage('error', ...args))
    },
    warn: (...args: any[]) => {
      if (shouldLog('warn')) console.warn(...formatMessage('warn', ...args))
    },
    info: (...args: any[]) => {
      if (shouldLog('info')) console.log(...formatMessage('info', ...args))
    },
    debug: (...args: any[]) => {
      if (shouldLog('debug')) console.log(...formatMessage('debug', ...args))
    },
    setLogLevel: (newLevel: LogLevel) => {
      logLevel = newLevel
    }
  }
}
