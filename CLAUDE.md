# Superowser Extension Design Summary

_Last updated: 2025-09-20 04:42:19_

---

## 🎯 Purpose

Superowser is a browser extension to help users collect, retrieve, and manage
web pages effectively. It replaces reliance on overcrowded tabs and memory with
structured, searchable storage via a side panel UI and omnibox command
interface.

---

## 📁 Functional Categories

### 1. 🧺 Collecting
- Save individual pages with tags, shortcut (@), and task/collection (&)
- Capture all tabs into a named collection
- Right-click to save highlighted text as a note
- Autocomplete tag/shortcut suggestions
- "Close after save" toggle

### 2. 🔍 Retrieving
- **Omnibox search**
  - `` ` @shortcut`` → open saved page
  - `` ` #tag`` → filter by tag
  - `` ` &task``  → show task group
  - `` ` !!query``  → search within notes
  - `` ` query``  → fuzzy search
- Autosuggestion includes:
  - Favicon, title, tags, shortcut, date, collection
- Fuzzy match logic (e.g. `@mlblog` matches `@ml_blog`, `@mlblg`)
- Context-aware results (recent, frequent, working set)

### 3. 🧹 Managing
- Edit metadata (tags, shortcut, collection)
- Batch delete/archive
- Rename, merge, open collections
- View and manage notes
- Export/import data (JSON/CSV)
- "Unused pages" detection

---

## 🧠 Notes & Highlight Capture
- Right-click highlighted text → "Save Highlight to Task"
- Optionally add comment, tags, task
- Stored under `NoteEntry`
- Search via `` ` !! ...``
- Displayed in panel under 📝 marker
- Lightweight: no injected UI or DOM anchors

---

## 🧭 Omnibox Syntax

| Pattern | Meaning |
|---------|---------|
| `` ` @shortcut`` | Open saved page |
| `` ` #tag``  | Search by tag |
| `` ` &task``  | Show collection/task |
| `` ` !! query``  | Search only notes/highlights |
| `` ` query``  | Fuzzy full-text search |

---

## 🖥️ Side Panel (First Tab Layout)

1. **Menu** (first item selected by default)
2. **Current Page Info**
   - Favicon, title, URL, tags, shortcut, note markers
3. **Current Task: `&task_name`**
   - Collapsible list of saved pages
   - Each entry: title, favicon, tags, notes, open/edit/delete buttons
4. **Chat Box**
   - Conversational interface for `/commands` or natural input
   - Supports: `/save`, `/open`, `/task`, `/notes`, etc.
5. **Footer**
   - One-line copyright and year

---

## 💬 Command Grammar

| Command | Description |
|---------|-------------|
| `/save` | Save current tab with tags/shortcut/task |
| `/open` | Open by shortcut or task |
| `/notes` | Show notes by tag/task |
| `/search` | Fuzzy search |
| `/task` | Set active task |
| `/help` | Show commands |

---

## ⚙️ Tech Stack

- **UI Framework**: Vue 3 + TypeScript
- **Build Tool**: Vite
- **Primary UI Surface**: Chrome side panel (replaces popup)
- **Core Storage**: Dexie.js (IndexedDB wrapper)
- **Message Bus**: All storage and index access goes through background service worker
- **Chat Input**: `textarea`-based with autocomplete popovers (Popper.js)
- **No need for Vuex/Pinia** (state is background-driven)

---

## 🧱 Component Architecture (Updated)

- `SidePanel.vue` ↔ `background.js` via `chrome.runtime.sendMessage`
- `background.js` owns:
  - Dexie instance (storage)
  - Search index
  - Task + note logic
- `contentScript.js`: Extracts title/body/highlight → passes to background
- `omnibox.js`: Parses commands → sends query → receives results
- No direct DB access from any UI component

---

## 🔍 Competitor Insights

Compared with:
- **Notion Web Clipper** (heavy, cloud-based)
- **OneTab / Session Buddy** (dump-style, no tagging/recall)
- **Toby / Workona** (visual boards, cloud-sync)
- **Knoman** (annotation focus, no omnibox or structured tagging)

Superowser differentiates through:
- Local, private storage
- Omnibox-first fuzzy recall
- Side panel workspace
- Structured tagging, notes, shortcut search

---
