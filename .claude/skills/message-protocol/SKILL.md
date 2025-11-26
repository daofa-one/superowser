# Skill: Message Protocol

## Overview

Superowser uses Chrome's message passing API to communicate between extension contexts (side panel, content scripts, background service worker). This skill defines the standard message structure and all message types.

## Core Principle

**All storage and search operations go through the background service worker.**

- Side panel → Background (via `chrome.runtime.sendMessage`)
- Content script → Background (via `chrome.runtime.sendMessage`)
- Background owns the Dexie instance and search index

---

## Message Envelope

### Standard Structure

```typescript
interface Message<T = any> {
  type: string;           // Message type constant (e.g., 'SAVE_PAGE')
  payload?: T;            // Optional typed payload
  requestId?: string;     // Optional ID for async request/response pairing
}

interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Sending a Message

```typescript
// From side panel or content script
const response = await chrome.runtime.sendMessage<MessageResponse<PageEntry>>({
  type: 'SAVE_PAGE',
  payload: {
    url: 'https://example.com',
    title: 'Example Page',
    tags: ['example', 'demo'],
    shortcut: 'ex',
    task: 'research'
  }
});

if (response.success) {
  console.log('Page saved:', response.data);
} else {
  console.error('Error:', response.error);
}
```

### Handling Messages (Background)

```typescript
// In background service worker
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message)
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Indicates async response
});

async function handleMessage(message: Message): Promise<any> {
  switch (message.type) {
    case 'SAVE_PAGE':
      return await savePage(message.payload);
    case 'SEARCH_PAGES':
      return await searchPages(message.payload);
    // ... other handlers
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
```

---

## Message Types Registry

### Page Operations

#### `SAVE_PAGE`
**Direction**: Side Panel/Content Script → Background
**Payload**:
```typescript
interface SavePagePayload {
  url: string;
  title: string;
  tags?: string[];
  shortcut?: string;
  task?: string;
  closeAfterSave?: boolean;
}
```
**Response**: `PageEntry` (the saved page)

---

#### `GET_PAGE`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface GetPagePayload {
  id?: number;
  url?: string;
  shortcut?: string;
}
```
**Response**: `PageEntry | null`

---

#### `UPDATE_PAGE`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface UpdatePagePayload {
  id: number;
  updates: Partial<PageEntry>;
}
```
**Response**: `PageEntry` (updated page)

---

#### `DELETE_PAGE`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface DeletePagePayload {
  id: number;
}
```
**Response**: `{ deleted: boolean }`

---

#### `GET_PAGES`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface GetPagesPayload {
  task?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}
```
**Response**: `PageEntry[]`

---

### Search Operations

#### `SEARCH_PAGES`
**Direction**: Side Panel/Omnibox → Background
**Payload**:
```typescript
interface SearchPagesPayload {
  query: string;
  type?: 'fuzzy' | 'shortcut' | 'tag' | 'task' | 'notes';
  currentTask?: string;  // For context-aware ranking
  limit?: number;
}
```
**Response**: `RankedResult[]`

```typescript
interface RankedResult {
  page: PageEntry;
  score: number;
  matchedField?: 'title' | 'url' | 'tags' | 'notes';
}
```

---

#### `SUGGEST_TAGS`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface SuggestTagsPayload {
  input: string;
  limit?: number;
}
```
**Response**: `string[]` (tag suggestions)

---

#### `SUGGEST_SHORTCUTS`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface SuggestShortcutsPayload {
  input: string;
  limit?: number;
}
```
**Response**: `PageEntry[]`

---

#### `SUGGEST_TASKS`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface SuggestTasksPayload {
  input: string;
  limit?: number;
}
```
**Response**: `string[]`

---

### Note Operations

#### `SAVE_NOTE`
**Direction**: Content Script/Side Panel → Background
**Payload**:
```typescript
interface SaveNotePayload {
  pageId?: number;      // If null, create page first
  pageUrl?: string;     // Used if pageId not provided
  pageTitle?: string;   // Used if creating new page
  content: string;      // The highlighted text or note content
  comment?: string;     // Optional user comment
  tags?: string[];
  task?: string;
}
```
**Response**: `NoteEntry`

---

#### `GET_NOTES`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface GetNotesPayload {
  pageId?: number;
  task?: string;
  tags?: string[];
}
```
**Response**: `NoteEntry[]`

---

#### `DELETE_NOTE`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface DeleteNotePayload {
  id: number;
}
```
**Response**: `{ deleted: boolean }`

---

### Task/Collection Operations

#### `SET_CURRENT_TASK`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface SetCurrentTaskPayload {
  task: string | null;  // null to clear current task
}
```
**Response**: `{ task: string | null }`

---

#### `GET_CURRENT_TASK`
**Direction**: Side Panel → Background
**Payload**: None
**Response**: `{ task: string | null }`

---

#### `GET_ALL_TASKS`
**Direction**: Side Panel → Background
**Payload**: None
**Response**: `TaskSummary[]`

```typescript
interface TaskSummary {
  name: string;
  pageCount: number;
  lastUpdated: number;
}
```

---

#### `RENAME_TASK`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface RenameTaskPayload {
  oldName: string;
  newName: string;
}
```
**Response**: `{ updated: number }` (number of pages updated)

---

### Metadata Operations

#### `GET_CURRENT_PAGE_INFO`
**Direction**: Side Panel → Background (queries active tab)
**Payload**: None
**Response**: `CurrentPageInfo`

```typescript
interface CurrentPageInfo {
  url: string;
  title: string;
  favicon?: string;
  saved: boolean;       // Is this page already saved?
  pageEntry?: PageEntry; // If saved, the entry
}
```

---

#### `EXTRACT_PAGE_CONTENT`
**Direction**: Background → Content Script
**Payload**: None
**Response**: `PageContent`

```typescript
interface PageContent {
  title: string;
  body: string;         // Readable text content
  url: string;
}
```

---

### Data Management

#### `EXPORT_DATA`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface ExportDataPayload {
  format: 'json' | 'csv';
  includeNotes?: boolean;
}
```
**Response**: `{ data: string }` (JSON string or CSV string)

---

#### `IMPORT_DATA`
**Direction**: Side Panel → Background
**Payload**:
```typescript
interface ImportDataPayload {
  data: string;
  format: 'json' | 'csv';
  merge: boolean;  // If true, merge with existing; if false, replace
}
```
**Response**: `{ imported: number, errors: string[] }`

---

## Error Handling

### Standard Error Response

```typescript
interface MessageResponse<T> {
  success: false;
  error: string;         // Human-readable error message
  errorCode?: string;    // Machine-readable error code
}
```

### Common Error Codes

```typescript
enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_SHORTCUT = 'DUPLICATE_SHORTCUT',
  INVALID_INPUT = 'INVALID_INPUT',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}
```

### Error Handling Example

```typescript
try {
  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_PAGE',
    payload: { /* ... */ }
  });

  if (!response.success) {
    switch (response.errorCode) {
      case ErrorCode.DUPLICATE_SHORTCUT:
        showError('This shortcut is already in use');
        break;
      case ErrorCode.STORAGE_ERROR:
        showError('Could not save page. Please try again.');
        break;
      default:
        showError(response.error);
    }
  }
} catch (err) {
  // Message passing itself failed
  showError('Could not communicate with background service');
}
```

---

## Async Request/Response Pattern

For long-running operations or streaming results:

```typescript
// Sender
const requestId = crypto.randomUUID();

chrome.runtime.sendMessage({
  type: 'LONG_OPERATION',
  payload: { /* ... */ },
  requestId
});

// Listen for response
chrome.runtime.onMessage.addListener((message) => {
  if (message.requestId === requestId) {
    if (message.type === 'LONG_OPERATION_PROGRESS') {
      updateProgress(message.payload.progress);
    } else if (message.type === 'LONG_OPERATION_COMPLETE') {
      handleComplete(message.payload);
    }
  }
});
```

---

## Type Definitions Location

All message types should be defined in:
```
src/types/messages.ts
```

Export as:
```typescript
// src/types/messages.ts
export enum MessageType {
  SAVE_PAGE = 'SAVE_PAGE',
  GET_PAGE = 'GET_PAGE',
  // ... all types
}

export interface Message<T = any> { /* ... */ }
export interface MessageResponse<T = any> { /* ... */ }

// All payload interfaces
export interface SavePagePayload { /* ... */ }
export interface GetPagePayload { /* ... */ }
// ... etc
```

Import everywhere:
```typescript
import { MessageType, Message, SavePagePayload } from '@/types/messages';
```

---

## Testing

### Mocking chrome.runtime.sendMessage

```typescript
// test/mocks/chrome.ts
global.chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({ success: true, data: mockData })
  }
};
```

### Testing Message Handlers

```typescript
describe('handleMessage', () => {
  it('should save page', async () => {
    const message: Message = {
      type: MessageType.SAVE_PAGE,
      payload: { url: 'test.com', title: 'Test' }
    };

    const result = await handleMessage(message);
    expect(result.id).toBeDefined();
    expect(result.url).toBe('test.com');
  });
});
```

---

## Related Files

- `src/types/messages.ts` - All message type definitions
- `src/background/message-handler.ts` - Background message handler
- `src/sidepanel/composables/useMessages.ts` - Vue composable for sending messages
- `src/content/content-script.ts` - Content script message sender
