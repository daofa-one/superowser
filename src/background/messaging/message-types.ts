// Message types for communication between side panel and background script

import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  DocumentEntry,
  DocumentVersionEntry,
  SearchContextEntry,
  SavePageRequest,
  SaveNoteRequest,
  SaveDocumentRequest,
  SaveDocumentVersionRequest,
  SearchResult,
  SearchQuery,
  UserSettings
} from '../../shared/models'
import {
  AIRunPromptRequest,
  AIAutomationSettings,
  AISelectors,
  AI_MESSAGE_TYPES
} from '../../shared/messaging/ai-types'

// Base message structure
export interface BaseMessage {
  type: string
  id?: string  // for request/response correlation
}

// Request messages from side panel to background
export interface SavePageMessage extends BaseMessage {
  type: 'SAVE_PAGE'
  data: SavePageRequest
}

export interface SaveCurrentTabMessage extends BaseMessage {
  type: 'SAVE_CURRENT_TAB'
  data?: {
    tags?: string[]
    shortcut?: string
    tasks?: string[]
    closeAfterSave?: boolean
    searchContext?: SearchContextEntry
  }
}

export interface SaveNoteMessage extends BaseMessage {
  type: 'SAVE_NOTE'
  data: SaveNoteRequest
}

export interface GetPageMessage extends BaseMessage {
  type: 'GET_PAGE'
  data: { id: string }
}

export interface GetPageByShortcutMessage extends BaseMessage {
  type: 'GET_PAGE_BY_SHORTCUT'
  data: { shortcut: string }
}

export interface GetPageByUrlMessage extends BaseMessage {
  type: 'GET_PAGE_BY_URL'
  data: { url: string }
}

export interface SearchMessage extends BaseMessage {
  type: 'SEARCH'
  data: SearchQuery
}

export interface OmniboxCommandMessage extends BaseMessage {
  type: 'OMNIBOX_COMMAND'
  data: { input: string }
}

export interface GetTasksMessage extends BaseMessage {
  type: 'GET_TASKS'
}

export interface SetActiveTaskMessage extends BaseMessage {
  type: 'SET_ACTIVE_TASK'
  data: { taskName: string }
}

export interface GetActiveTaskMessage extends BaseMessage {
  type: 'GET_ACTIVE_TASK'
}

export interface CreateTaskMessage extends BaseMessage {
  type: 'CREATE_TASK'
  data: { name: string; description?: string }
}

export interface DeleteTaskMessage extends BaseMessage {
  type: 'DELETE_TASK'
  data: { taskName: string }
}

export interface GetTaskContentMessage extends BaseMessage {
  type: 'GET_TASK_CONTENT'
  data: { taskName: string }
}

export interface MovePageToTaskMessage extends BaseMessage {
  type: 'MOVE_PAGE_TO_TASK'
  data: { pageId: string; taskName: string }
}

export interface UpdatePageMessage extends BaseMessage {
  type: 'UPDATE_PAGE'
  data: { id: string; updates: Partial<PageEntry> }
}

export interface DeletePageMessage extends BaseMessage {
  type: 'DELETE_PAGE'
  data: { id: string }
}

export interface GetCurrentTabInfoMessage extends BaseMessage {
  type: 'GET_CURRENT_TAB_INFO'
}

export interface GetExtensionChatHistoryMessage extends BaseMessage {
  type: 'GET_EXTENSION_CHAT_HISTORY'
}

export interface GetCommandSuggestionsMessage extends BaseMessage {
  type: 'GET_COMMAND_SUGGESTIONS'
  data: {
    input: string
  }
}

export interface GetUserSettingsMessage extends BaseMessage {
  type: 'GET_USER_SETTINGS'
}

export interface UpdateUserSettingsMessage extends BaseMessage {
  type: 'UPDATE_USER_SETTINGS'
  data: {
    preferredSearchEngine?: string
    preferredAiProvider?: string
    reuseAiTab?: boolean
    aiLogLevel?: 'info' | 'debug'
  }
}

export interface UpdateVersionManagementSettingsMessage extends BaseMessage {
  type: 'UPDATE_VERSION_MANAGEMENT_SETTINGS'
  data: Partial<UserSettings['versionManagement']>
}

export interface OpenPageMessage extends BaseMessage {
  type: 'OPEN_PAGE'
  data: { url: string; newTab?: boolean }
}

export interface GetSearchSuggestionsMessage extends BaseMessage {
  type: 'GET_SEARCH_SUGGESTIONS'
  data: { query: string }
}

export interface GetPopularTagsMessage extends BaseMessage {
  type: 'GET_POPULAR_TAGS'
  data?: { limit?: number }
}

export interface ExportDataMessage extends BaseMessage {
  type: 'EXPORT_DATA'
}

export interface ImportDataMessage extends BaseMessage {
  type: 'IMPORT_DATA'
  data: { jsonData: string }
}

export interface SaveShortcutMessage extends BaseMessage {
  type: 'SAVE_SHORTCUT'
  data: { url: string; shortcut: string }
}

export interface SaveTagsMessage extends BaseMessage {
  type: 'SAVE_TAGS'
  data: { url: string; tags: string[] }
}

export interface GetRecentPagesMessage extends BaseMessage {
  type: 'GET_RECENT_PAGES'
}

export interface RemovePageFromTaskMessage extends BaseMessage {
  type: 'REMOVE_PAGE_FROM_TASK'
  data: { taskName: string; pageId: string }
}

export interface GetNotesByPageMessage extends BaseMessage {
  type: 'GET_NOTES_BY_PAGE'
  data: { pageId: string }
}

export interface GetAllNotesMessage extends BaseMessage {
  type: 'GET_ALL_NOTES'
}

export interface UpdateNoteMessage extends BaseMessage {
  type: 'UPDATE_NOTE'
  data: { id: string; [key: string]: any }
}

export interface DeleteNoteMessage extends BaseMessage {
  type: 'DELETE_NOTE'
  data: { id: string }
}

export interface ExtensionChatMessage extends BaseMessage {
  type: 'EXTENSION_CHAT'
  data: {
    content: string
    command?: string
    relatedTask?: string
  }
}

export interface GetDocumentMessage extends BaseMessage {
  type: 'GET_DOCUMENT'
  data: { documentId: string; versionLimit?: number }
}

export interface CreateDocumentMessage extends BaseMessage {
  type: 'CREATE_DOCUMENT'
  data: SaveDocumentRequest
}

export interface UpdateDocumentMessage extends BaseMessage {
  type: 'UPDATE_DOCUMENT'
  data: { documentId: string; updates: Partial<DocumentEntry> }
}

export interface DeleteDocumentMessage extends BaseMessage {
  type: 'DELETE_DOCUMENT'
  data: { documentId: string }
}

export interface SaveDocumentVersionMessage extends BaseMessage {
  type: 'SAVE_DOCUMENT_VERSION'
  data: SaveDocumentVersionRequest
}

export interface DeleteDocumentVersionMessage extends BaseMessage {
  type: 'DELETE_DOCUMENT_VERSION'
  data: { versionId: string }
}

export interface UpdateDocumentVersionMessage extends BaseMessage {
  type: 'UPDATE_DOCUMENT_VERSION'
  data: { versionId: string; updates: Partial<DocumentVersionEntry> }
}

export interface DuplicateDocumentVersionMessage extends BaseMessage {
  type: 'DUPLICATE_DOCUMENT_VERSION'
  data: { versionId: string; options?: Partial<DocumentVersionEntry> }
}

export interface GetTaskDocumentsMessage extends BaseMessage {
  type: 'GET_TASK_DOCUMENTS'
  data: { taskId: string }
}

export interface GetTaskMessage extends BaseMessage {
  type: 'GET_TASK'
  data: { taskId: string }
}

export interface GetTaskPagesMessage extends BaseMessage {
  type: 'GET_TASK_PAGES'
  data: { taskId: string }
}

export interface GetTaskNotesMessage extends BaseMessage {
  type: 'GET_TASK_NOTES'
  data: { taskId: string }
}

export interface OpenAuthoringWorkspaceMessage extends BaseMessage {
  type: 'OPEN_AUTHORING_WORKSPACE'
  data: { documentId: string; taskId?: string }
}

// AI message types
export interface AIRunPromptMessage extends BaseMessage {
  type: 'AI_RUN_PROMPT'
  data: AIRunPromptRequest
}

export interface AIGetSettingsMessage extends BaseMessage {
  type: typeof AI_MESSAGE_TYPES.AI_GET_SETTINGS
}

export interface AIUpdateSettingsMessage extends BaseMessage {
  type: typeof AI_MESSAGE_TYPES.AI_UPDATE_SETTINGS
  data: Partial<AIAutomationSettings>
}

export interface AIUpdateSelectorsMessage extends BaseMessage {
  type: typeof AI_MESSAGE_TYPES.AI_UPDATE_SELECTORS
  data: { provider: AIAutomationSettings['provider']; selectors: Partial<AISelectors> }
}

export interface AITestSelectorsMessage extends BaseMessage {
  type: typeof AI_MESSAGE_TYPES.AI_TEST_SELECTORS
  data: { provider: AIAutomationSettings['provider']; selectors: AISelectors }
}

export interface AITestAutomationMessage extends BaseMessage {
  type: 'AI_TEST_AUTOMATION'
  data?: { prompt?: string }
}

export interface AITestInjectionMessage extends BaseMessage {
  type: 'AI_TEST_INJECTION'
}

// Union type for all request messages
export type RequestMessage =
  | SavePageMessage
  | SaveCurrentTabMessage
  | SaveNoteMessage
  | GetPageMessage
  | GetPageByShortcutMessage
  | GetPageByUrlMessage
  | SearchMessage
  | OmniboxCommandMessage
  | GetTasksMessage
  | SetActiveTaskMessage
  | GetActiveTaskMessage
  | CreateTaskMessage
  | DeleteTaskMessage
  | GetTaskContentMessage
  | MovePageToTaskMessage
  | UpdatePageMessage
  | DeletePageMessage
  | GetCurrentTabInfoMessage
  | GetExtensionChatHistoryMessage
  | GetCommandSuggestionsMessage
  | GetUserSettingsMessage
  | UpdateUserSettingsMessage
  | UpdateVersionManagementSettingsMessage
  | OpenPageMessage
  | GetSearchSuggestionsMessage
  | GetPopularTagsMessage
  | ExportDataMessage
  | ImportDataMessage
  | SaveShortcutMessage
  | SaveTagsMessage
  | GetRecentPagesMessage
  | RemovePageFromTaskMessage
  | GetNotesByPageMessage
  | GetAllNotesMessage
  | UpdateNoteMessage
  | DeleteNoteMessage
  | ExtensionChatMessage
  | GetDocumentMessage
  | CreateDocumentMessage
  | UpdateDocumentMessage
  | DeleteDocumentMessage
  | SaveDocumentVersionMessage
  | DeleteDocumentVersionMessage
  | UpdateDocumentVersionMessage
  | DuplicateDocumentVersionMessage
  | GetTaskDocumentsMessage
  | GetTaskMessage
  | GetTaskPagesMessage
  | GetTaskNotesMessage
  | OpenAuthoringWorkspaceMessage
  | AIRunPromptMessage
  | AIGetSettingsMessage
  | AIUpdateSettingsMessage
  | AIUpdateSelectorsMessage
  | AITestSelectorsMessage
  | AITestAutomationMessage
  | AITestInjectionMessage

// Response messages from background to side panel
export interface SuccessResponse<T = any> extends BaseMessage {
  type: 'SUCCESS'
  data: T
}

export interface ErrorResponse extends BaseMessage {
  type: 'ERROR'
  error: {
    message: string
    code?: string
    details?: any
  }
}

export type ResponseMessage = SuccessResponse | ErrorResponse

// Specific response data types
export interface TabInfo {
  id: number
  url: string
  title: string
  favicon?: string
}

export interface TaskContentResponse {
  task: TaskEntry | null
  pages: PageEntry[]
  notes: NoteEntry[]
}

export interface OmniboxCommandResponse {
  type: 'open' | 'search' | 'filter' | 'error'
  results?: SearchResult[]
  page?: PageEntry
  message?: string
}

export interface SearchSuggestionsResponse {
  shortcuts: string[]
  tags: string[]
  tasks: string[]
}

// Utility type guards
export function isRequestMessage(message: any): message is RequestMessage {
  return message && typeof message.type === 'string' && message.type !== 'SUCCESS' && message.type !== 'ERROR'
}

export function isResponseMessage(message: any): message is ResponseMessage {
  return message && (message.type === 'SUCCESS' || message.type === 'ERROR')
}
