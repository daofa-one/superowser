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
    description: 'Show all tasks'
  },
  {
    id: 'save',
    label: 'Save',
    icon: '💾',
    command: '/save',
    position: 1,
    enabled: true,
    description: 'Save current page'
  },
  {
    id: 'note',
    label: 'Note',
    icon: '📝',
    command: '/note',
    position: 2,
    enabled: true,
    description: 'Create a note'
  },
  {
    id: 'search',
    label: 'Find',
    icon: '🔍',
    command: '/find',
    position: 3,
    enabled: true,
    description: 'Find tasks, pages, notes and docs'
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    command: '/ai',
    position: 4,
    enabled: true,
    description: 'Ask AI assistant'
  }
]