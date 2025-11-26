# Skill: Browser Extension Patterns

## Overview

Common patterns and best practices for Chrome Extension development (Manifest V3) used in the Superowser project.

## Core Patterns

### Message Passing Architecture

All storage and data operations go through the background service worker:

```typescript
// From UI context (side panel, popup)
const response = await chrome.runtime.sendMessage({
  type: 'SAVE_PAGE',
  payload: { url, title, tags, shortcut }
});

// In background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_PAGE') {
    // Handle storage operation
    // Return response
  }
});
```

**Why**: Service worker is the only persistent context with full API access.

### Extension Contexts

1. **Background Service Worker** (`background/`)
   - Owns Dexie instance and search index
   - Handles all storage operations
   - Manages omnibox API
   - Coordinates across contexts

2. **Side Panel** (`sidepanel/`)
   - Primary UI surface (replaces popup)
   - Vue 3 application
   - Communicates via `chrome.runtime.sendMessage`

3. **Content Script** (`content/`)
   - Injected into web pages
   - Extracts page metadata and highlights
   - Minimal footprint

4. **Omnibox Handler** (`background/omnibox.ts`)
   - Parses command syntax
   - Returns search results
   - Handles navigation

### Storage Pattern

```typescript
// Use Dexie.js wrapper around IndexedDB
import Dexie from 'dexie';

class Database extends Dexie {
  pages!: Dexie.Table<PageEntry, number>;
  notes!: Dexie.Table<NoteEntry, number>;

  constructor() {
    super('SuperowserDB');
    this.version(1).stores({
      pages: '++id, url, shortcut, *tags, task, created',
      notes: '++id, pageId, *tags, task, created'
    });
  }
}
```

**Key Points**:
- `++id`: Auto-increment primary key
- `*tags`: Multi-valued index for array fields
- Service worker owns the instance

### Chrome API Best Practices

1. **Side Panel API** (Chrome 114+)
   ```typescript
   chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
   chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
   ```

2. **Omnibox API**
   ```typescript
   chrome.omnibox.setDefaultSuggestion({ description: 'Search Superowser' });
   chrome.omnibox.onInputChanged.addListener((text, suggest) => {
     // Return suggestions
   });
   ```

3. **Context Menus**
   ```typescript
   chrome.contextMenus.create({
     id: 'save-highlight',
     title: 'Save Highlight to Task',
     contexts: ['selection']
   });
   ```

## Dependency Injection

Per project guidelines, prefer dependency injection over instantiation:

```typescript
// Good
class SearchService {
  constructor(private db: Database) {}
}

// Avoid
class SearchService {
  private db = new Database(); // Don't do this
}
```

## Related Files

- `src/background/` - Service worker logic
- `src/sidepanel/` - Vue UI components
- `src/content/` - Content script injection
- `manifest.json` - Extension configuration
