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

export interface DocumentEntry {
  id: string
  title: string
  taskId?: string
  status: 'draft' | 'review' | 'final' | 'archived'
  activeVersionId?: string
  createdAt: Date
  updatedAt: Date
}

export interface DocumentVersionEntry {
  id: string
  documentId: string
  parentVersionId?: string
  title?: string
  summary?: string
  content: string
  createdAt: Date
  createdBy: 'user' | 'ai' | 'import'
  sources?: Array<{
    noteId?: string
    pageId?: string
    snippet?: string
  }>

  // Version Management Extensions
  alias?: string                    // User-friendly name (e.g., "Initial Draft", "Final Review")
  tags: string[]                    // Semantic tags (e.g., ["milestone", "draft", "reviewed"])
  contentHash: string               // SHA-256 hash for deduplication
  size: number                      // Content size in bytes
  changesSummary?: {                // Auto-generated change summary
    linesAdded: number
    linesRemoved: number
    linesModified: number
    significantChange: boolean      // Heuristic for major changes
  }
  metadata: {
    isAutoSaved: boolean            // True if created by auto-save
    isMilestone: boolean            // Marked as important milestone
    isArchived: boolean             // Archived versions (hidden by default)
    branchName?: string             // For version branching
    mergeSourceIds?: string[]       // For merged versions
    editingDuration?: number        // Time spent editing (ms)
    characterCount: number          // Character count for quick reference
    wordCount: number               // Word count for quick reference
    version: string                 // Semantic version (e.g., "1.0.0", "1.1.2")
    platform?: string               // Platform where version was created
  }
  settings?: {                      // Version-specific settings at creation time
    autoSaveInterval?: number
    compressionEnabled?: boolean
  }
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

export interface SaveDocumentRequest {
  title: string
  taskId?: string
  status?: DocumentEntry['status']
  initialContent?: string
}

export interface SaveDocumentVersionRequest {
  documentId: string
  title?: string
  summary?: string
  content: string
  parentVersionId?: string
  createdBy?: 'user' | 'ai' | 'import'
  sources?: Array<{
    noteId?: string
    pageId?: string
    snippet?: string
  }>

  // Version Management Extensions
  alias?: string
  tags?: string[]
  isAutoSaved?: boolean
  isMilestone?: boolean
  branchName?: string
  editingDuration?: number
}

export interface SearchQuery {
  query: string
  type?: 'page' | 'note' | 'task' | 'all'
  tags?: string[]
  tasks?: string[]   // changed from single task to array
  limit?: number
}

export interface VersionManagementSettings {
  autoSave: {
    enabled: boolean
    interval: number
    mode: 'content_change' | 'time_based' | 'smart'
    contentThreshold: number
    smartTriggers: {
      significantEdits: boolean
      milestoneMarkers: boolean
      beforeSave: boolean
      periodically: boolean
      beforeClose: boolean
    }
  }
  storage: {
    maxVersionsPerDocument: number
    autoCleanup: {
      enabled: boolean
      strategy: 'count' | 'age' | 'smart'
      keepCount: number
      maxAgeHours: number
      smartRetention: {
        keepMilestones: boolean
        keepBranches: boolean
        keepTagged: boolean
        keepRecent: number
      }
    }
    compressionEnabled: boolean
    deduplicationEnabled: boolean
  }
  ui: {
    showVersionCount: boolean
    showLastModified: boolean
    defaultVersionView: 'list' | 'timeline' | 'tree'
    enableQuickRestore: boolean
    showDiffPreview: boolean
    groupByDate: boolean
    enableKeyboardShortcuts: boolean
  }
  advanced: {
    enableVersionBranching: boolean // Future feature - UI not yet implemented
    enableSemanticTags: boolean
    autoTagging: {
      enabled: boolean
      detectMilestones: boolean
      detectBreakingChanges: boolean
      customPatterns: string[]
    }
    exportFormats: string[]
    enableAuditTrail: boolean
    enableCollaboration: boolean
  }
}

export interface ShortcutConfig {
  command: string        // '/tasks', '/save', etc.
  parameters: string     // Default parameters
  autoExecute: boolean   // Execute immediately or fill input
  enabled: boolean       // Show/hide button
}

export interface CustomButtonConfig {
  id: string             // Unique ID for the button
  label: string          // Display label (max 10 chars)
  icon: string           // Emoji or single character
  command: string        // Command to execute
  parameters: string     // Default parameters
  autoExecute: boolean   // Execute immediately or fill input
  position: number       // Display order (after default buttons)
}

export interface UserSettings {
  defaultCloseAfterSave: boolean
  maxSearchHistory: number
  maxChatHistory: number
  autoDetectSearchQueries: boolean
  autoDetectChatMessages: boolean
  preferredSearchEngine: string
  preferredAiProvider: string
  reuseAiTab: boolean
  aiLogLevel: 'info' | 'debug'
  versionManagement: VersionManagementSettings
  aiAutomation?: import('../messaging/ai-types').AIAutomationSettings
  shortcuts?: {
    tasks: ShortcutConfig
    save: ShortcutConfig
    notes: ShortcutConfig
    search: ShortcutConfig
    ai: ShortcutConfig
  }
  customButtons?: CustomButtonConfig[]  // Additional custom shortcut buttons
}

// Version Management Operations
export interface VersionDiff {
  added: string[]
  removed: string[]
  modified: Array<{
    line: number
    oldContent: string
    newContent: string
  }>
  summary: {
    linesAdded: number
    linesRemoved: number
    linesModified: number
  }
}

export interface VersionComparisonResult {
  sourceVersion: DocumentVersionEntry
  targetVersion: DocumentVersionEntry
  diff: VersionDiff
  similarity: number  // 0-1 score
  hasConflicts: boolean
}

export interface VersionBranchInfo {
  branchName: string
  baseVersionId: string
  headVersionId: string
  versions: DocumentVersionEntry[]
  isActive: boolean
  description?: string
}

export interface VersionPruneRequest {
  documentId: string
  strategy: 'count' | 'age' | 'smart' | 'manual'
  options: {
    keepCount?: number
    maxAgeHours?: number
    preserveMilestones?: boolean
    preserveTagged?: boolean
    preserveRecent?: number
    specificVersionIds?: string[]
  }
}

export interface VersionAnalytics {
  documentId: string
  totalVersions: number
  storageUsed: number  // bytes
  averageVersionSize: number
  oldestVersion: Date
  newestVersion: Date
  autoSavedCount: number
  milestoneCount: number
  branchCount: number
  uniqueContentVersions: number  // after deduplication
  compressionRatio?: number
}

export interface VersionRestoreRequest {
  documentId: string
  versionId: string
  createBackup: boolean
  alias?: string
}
