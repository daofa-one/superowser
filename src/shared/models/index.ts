// Core domain models for Superowser

export interface SearchContextEntry {
  query: string
  engine: string
  recordedAt: Date
}

export interface PageEntry {
  id: string
  url: string
  title: string
  favicon?: string
  tags: string[]
  shortcut?: string  // @shortcut for quick access
  tasks: string[]    // array of &tasks for grouping (changed from single task)
  content?: string   // extracted page content for search
  searchContext?: SearchContextEntry
  searchContextHistory: SearchContextEntry[]
  createdAt: Date
  updatedAt: Date
}

export type NoteCategory = 'note' | 'plan' | 'brainstorm' | 'highlight'

export interface NoteEntry {
  id: string
  pageId?: string    // optional - can be standalone note
  content: string    // highlighted text or note content
  comment?: string   // user's comment on the highlight
  tags: string[]     // removed in v3 migration - notes inherit tags from pages
  tasks: string[]    // array of &tasks for grouping (changed from single task)
  category: NoteCategory
  position?: {       // position info for highlights
    start: number
    end: number
    selector?: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface TaskEntry {
  id: string
  name: string       // &task_name
  description?: string
  pageIds: string[]  // pages in this task
  noteIds: string[]  // notes in this task
  isActive: boolean  // current working task
  createdAt: Date
  updatedAt: Date
}

export interface SearchResult {
  type: 'page' | 'note' | 'task'
  id: string
  title: string
  snippet?: string
  score: number
  tags: string[]
  shortcut?: string
  tasks: string[]   // changed from single task to array
}

export interface SavePageRequest {
  url: string
  title: string
  favicon?: string
  tags?: string[]
  shortcut?: string
  tasks?: string[]   // changed from single task to array
  searchContext?: SearchContextEntry
  closeAfterSave?: boolean
}

export interface SaveNoteRequest {
  pageId?: string
  content: string
  comment?: string
  tags?: string[]
  tasks?: string[]   // changed from single task to array
  category?: NoteCategory
  position?: {
    start: number
    end: number
    selector?: string
  }
}

export interface SearchQuery {
  query: string
  type?: 'page' | 'note' | 'task' | 'all'
  tags?: string[]
  tasks?: string[]   // changed from single task to array
  limit?: number
}
