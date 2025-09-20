// Core domain models for Superowser

export interface PageEntry {
  id: string
  url: string
  title: string
  favicon?: string
  tags: string[]
  shortcut?: string  // @shortcut for quick access
  task?: string      // &task for grouping
  content?: string   // extracted page content for search
  createdAt: Date
  updatedAt: Date
}

export interface NoteEntry {
  id: string
  pageId?: string    // optional - can be standalone note
  content: string    // highlighted text or note content
  comment?: string   // user's comment on the highlight
  tags: string[]
  task?: string      // &task for grouping
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
  task?: string
}

export interface SavePageRequest {
  url: string
  title: string
  favicon?: string
  tags?: string[]
  shortcut?: string
  task?: string
  closeAfterSave?: boolean
}

export interface SaveNoteRequest {
  pageId?: string
  content: string
  comment?: string
  tags?: string[]
  task?: string
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
  task?: string
  limit?: number
}