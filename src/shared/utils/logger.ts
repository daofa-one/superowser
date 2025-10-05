/**
 * Centralized logging utility for the Superowser extension
 * Provides configurable log levels and consistent formatting across all components
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

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

class Logger {
  private config: LoggerConfig = { level: 'info' }
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
            data: { keys: ['aiLogLevel'] }
          })
          if (response?.settings?.aiLogLevel) {
            this.config.level = response.settings.aiLogLevel === 'debug' ? 'debug' : 'info'
          }
        } catch (error) {
          // Fallback for contexts where messaging isn't available
          this.config.level = 'info'
        }
      }
    } catch (error) {
      // Fallback to info level if we can't read settings
      this.config.level = 'info'
    }
    this.isInitialized = true
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level]
  }

  private formatMessage(level: LogLevel, component: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`
    return [prefix, ...args]
  }

  error(component: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', component, ...args))
    }
  }

  warn(component: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', component, ...args))
    }
  }

  info(component: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('info', component, ...args))
    }
  }

  debug(component: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', component, ...args))
    }
  }

  // Method to update log level (for when settings change)
  setLogLevel(level: LogLevel) {
    this.config.level = level
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
export function createStandaloneLogger(componentName: string, logLevel: LogLevel = 'info') {
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