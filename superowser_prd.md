# 🧾 Product Requirements Document (PRD)

## 📌 Product Name
**Superowser**  
_A smarter browser extension for collecting, retrieving, and managing web content._

## 🧭 Purpose
To solve the common pain of tab overload, forgotten context, and fragmented reference material by enabling users to:

- Save pages meaningfully (tags, shortcuts, tasks)
- Retrieve them quickly (Omnibox, fuzzy search)
- Organize content with lightweight workflows (collections, notes)
- Interact conversationally (command chat)

## 🎯 Goals
| Goal | Description |
|------|-------------|
| 🧺 **Collect with context** | Save tabs, highlights, and tasks with minimal friction |
| 🔍 **Retrieve fast** | Use Omnibox shortcuts, fuzzy search, and task-aware browsing |
| 🧹 **Manage cleanly** | Edit, delete, and browse saved items without clutter |
| 💬 **Conversational command** | Offer `/command` chat to recall or manipulate content |
| 🧠 **Use naturally** | Keep it keyboard-first, local-first, and privacy-friendly |

## 🧩 Key Features

### ✅ Core Features
- Save current tab with `#tags`, `@shortcut`, `&task`
- Capture multiple tabs into a collection
- Right-click to save highlights as notes
- Omnibox search:
  - `` ` @shortcut``, `` ` #tag``, `` ` &task``, `` ` query``, `` ` !notes``
- Fuzzy matching (e.g. `mlblog` ≈ `ml_blog`)
- Side panel as primary UI
  - Current page info
  - Collapsible current task list
  - Chatbox for command input
- Notes view (📝 marker for pages with highlights)
- Command interface (`/save`, `/open`, `/notes`, etc.)

### 🧠 Advanced (Future)
- AI-assisted tag suggestion
- Semantic search via LLM
- Inline annotation overlays
- Task reminders or time-aware prompts

## 🎨 UI Layout (First Tab of Side Panel)
1. **Top Menu**
   - Sidebar navigation; default to "Today" or "Current Task"
2. **Current Page Info**
   - Title, URL, tags, shortcut, notes, favicon
3. **Current Task: &task (Collapsible)**
   - Saved pages (title, tags, notes)
   - Open/Edit/Delete buttons
4. **Chatbox**
   - Input field (with `/command` parsing)
   - Popover suggestions for `/`, `@`, `#`, `&`
5. **Footer**
   - Copyright © Year

## 🧱 Architecture Principles
| Component | Notes |
|----------|-------|
| **Dexie.js** | Used for all data storage (IndexedDB wrapper) |
| **Vue 3 + TS + Vite** | Full front-end stack |
| **Side Panel UI** | Primary surface; replaces popup |
| **Background Service Worker** | Owns Dexie, search index, all logic |
| **Content Scripts** | Extract title/text and pass highlights |
| **Message Routing** | All DB/index access via `chrome.runtime.sendMessage` |

## ⚙️ Technical Constraints
- **Manifest V3** (Chrome)
- **Local-first**: No login or cloud sync for v1
- **IndexedDB-only**: No backend service required
- **Accessible**: Keyboard nav and ARIA-compliant

## 🗓️ MVP Scope (v1)
| Feature | Status |
|--------|--------|
| Save tab with tags/shortcut/task | ✅ Required |
| Side panel UI | ✅ Required |
| Omnibox shortcut + search | ✅ Required |
| Fuzzy search + suggestions | ✅ Required |
| Notes via highlight | ✅ Required |
| `/command` chat interface | ✅ Required |
| Export/import | ⏳ Optional for MVP |
| Collection/Task browser | ✅ Required |

## 🔍 Non-Goals (Not in v1)
- Cloud sync or Notion export
- AI summarization
- Inline page annotation overlays

## 📦 Deliverables
- Extension zip/CRX
- `manifest.json` (V3)
- README + claude.md
- `CLAUDE.md` for Claude/AI use
