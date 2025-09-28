// Message types for communication between side panel and background script

import {
  PageEntry,
  NoteEntry,
  TaskEntry,
  SavePageRequest,
  SaveNoteRequest,
  SearchResult,
  SearchQuery
} from '../../shared/models'

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

export interface GetUserSettingsMessage extends BaseMessage {
  type: 'GET_USER_SETTINGS'
}

export interface UpdateUserSettingsMessage extends BaseMessage {
  type: 'UPDATE_USER_SETTINGS'
  data: {
    preferredSearchEngine?: string
  }
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
  | GetUserSettingsMessage
  | UpdateUserSettingsMessage
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
