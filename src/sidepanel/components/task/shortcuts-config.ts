// Task shortcut configuration

export interface ChatShortcut {
  id: string
  label: string
  icon: string
  command: string
  description?: string
  position: number
  enabled: boolean
  contextActive?: boolean
  /** If true, clicking the button auto-executes the command. If false, just fills input. */
  autoExecute?: boolean
  /** If true, requires user input/parameters before executing */
  requiresInput?: boolean
  conditions?: {
    hasActiveTask?: boolean
    currentView?: string
    pageUrl?: RegExp
  }
}

// Default shortcuts for reference
export const DEFAULT_SHORTCUTS: ChatShortcut[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    icon: '📋',
    command: '/tasks',
    position: 0,
    enabled: true,
    description: 'Show all tasks',
    autoExecute: true, // No parameters needed
    requiresInput: false
  },
  {
    id: 'save',
    label: 'Save',
    icon: '💾',
    command: '/save',
    position: 1,
    enabled: true,
    description: 'Save current page',
    autoExecute: true, // Uses defaults (current task, current tab)
    requiresInput: false
  },
  {
    id: 'note',
    label: 'Note',
    icon: '📝',
    command: '/note',
    position: 2,
    enabled: true,
    description: 'Create a note',
    autoExecute: false, // Needs note content from user
    requiresInput: true
  },
  {
    id: 'search',
    label: 'Find',
    icon: '🔍',
    command: '/find',
    position: 3,
    enabled: true,
    description: 'Find tasks, pages, notes and docs',
    autoExecute: false, // Needs search query
    requiresInput: true
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    command: '/ai',
    position: 4,
    enabled: true,
    description: 'Ask AI assistant',
    autoExecute: false, // Needs prompt from user
    requiresInput: true
  }
]