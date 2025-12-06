# Superowser

> A browser extension to help you save, organize, and quickly retrieve web pages

**Version:** 0.0.3
**Status:** In Development

---

## 🎯 Overview

Superowser is a Chrome extension that replaces reliance on overcrowded tabs and browser history with structured, searchable storage. Save pages with tags and shortcuts, organize them into tasks/collections, and retrieve them instantly using Chrome's omnibox (address bar) with powerful fuzzy search.

**Key Philosophy:**
- **Local-first**: All data stored locally on your device (IndexedDB + chrome.storage)
- **Privacy-focused**: No cloud sync, no external servers, no tracking
- **Keyboard-driven**: Fast omnibox search using backtick (`` ` ``) trigger
- **Structured organization**: Tags, shortcuts, tasks, and collections

---

## ✨ Features

### 🧺 Collecting
- Save individual pages with tags, shortcuts (@), and task/collection (&)
- Capture all open tabs into a named collection
- Copy text and save as notes for later searching
- Autocomplete suggestions for tags and shortcuts
- "Close after save" toggle for tab management

### 🔍 Retrieving
**Omnibox Search** (type `` ` `` in Chrome address bar):
- `` ` @shortcut`` → Open saved page by shortcut (e.g., `` ` @docs``)
- `` ` #tag`` → Filter pages by tag (e.g., `` ` #javascript``)
- `` ` &task`` → Show pages in a task/collection (e.g., `` ` &project``)
- `` ` !!query`` → Search within saved notes and highlights
- `` ` /command`` → Execute chat commands
- `` ` query`` → Fuzzy full-text search across all pages

**Smart Suggestions:**
- Shows favicon, title, tags, shortcut, date, and collection
- Fuzzy matching (e.g., `@mlblog` matches `@ml_blog`)
- Context-aware ranking (recent, frequent, working set)

### 🧹 Managing
- Edit metadata (tags, shortcuts, collections) in side panel
- Batch delete/archive pages
- Rename and merge collections
- View and manage notes with comments
- Export/import all data (JSON format)
- Detect unused pages for cleanup

---

## 📥 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store listing
2. Click "Add to Chrome"
3. Grant required permissions
4. Click the extension icon to open the side panel

### Manual Installation (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/daofa-one/superowser.git
   cd superowser
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist/` folder

---

## 🚀 Usage

### Opening the Side Panel
Click the Superowser icon in your Chrome toolbar to open the side panel.

### Using Omnibox Search

**Step 1:** Type backtick (`` ` ``) in Chrome's address bar
**Step 2:** Type your search pattern

**Examples:**

| Input | Action |
|-------|--------|
| `` ` @docs`` | Open page saved with shortcut `@docs` |
| `` ` #vue #typescript`` | Find pages tagged with both `vue` and `typescript` |
| `` ` &project-alpha`` | Show all pages in the `project-alpha` collection |
| `` ` !!api authentication`` | Search for "api authentication" in saved notes |
| `` ` /save`` | Open chat with `/save` command |
| `` ` react hooks`` | Fuzzy search for pages about React hooks |

### Chat Commands

Type commands in the side panel chat interface:

| Command | Description |
|---------|-------------|
| `/save` | Save current tab with tags/shortcut/task |
| `/open` | Open by shortcut or task |
| `/notes` | Show notes by tag/task |
| `/search` | Fuzzy search across pages |
| `/task` | Set active task |
| `/help` | Show command reference |

### Saving Pages

**Quick Save:**
1. Open side panel
2. View current page info
3. Add tags (e.g., `javascript`, `tutorial`)
4. Add shortcut (e.g., `@react-guide`)
5. Assign to task/collection (e.g., `&learning`)
6. Click "Save" (optionally close tab after saving)

**Batch Save:**
Use chat command `/save-tabs collection-name` to save all open tabs

### Managing Collections

**View Collections:**
Navigate to Tasks view in side panel to see all collections

**Open Collection:**
- Via omnibox: `` ` &collection-name``
- Via chat: `/open &collection-name`
- Via side panel: Click task name to expand

---

## 🔐 Privacy

Superowser is designed with privacy as a core principle:

- ✅ **All data stored locally** on your device only
- ✅ **No cloud storage** or external servers
- ✅ **No data transmission** over the internet
- ✅ **No tracking or analytics** sent externally
- ✅ **You control all your data** - delete anytime
- ✅ **No account required** - no personal information collected

See [PRIVACY.md](./PRIVACY.md) for complete privacy policy.

---

## 🛠️ Development

### Tech Stack

- **UI Framework**: Vue 3 (Composition API) + TypeScript
- **Build Tool**: Vite + @crxjs/vite-plugin
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Search**: Fuse.js (fuzzy search)
- **Styling**: Vuetify 3 + Custom CSS
- **Editor**: Monaco Editor (for authoring)
- **Markdown**: markdown-it + Mermaid diagrams

### Scripts

```bash
# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run all tests (type check + lint + build)
pnpm test
```

### Project Structure

```
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ manifest.config.ts       # Chrome MV3 manifest
├─ PRIVACY.md              # Privacy policy
├─ CHANGELOG.md            # Version history
├─ public/
│  └─ icons/               # Extension icons (16/32/48/128)
├─ sidepanel/              # Side panel HTML entry
│  └─ index.html
├─ authoring/              # Document authoring interface
│  └─ index.html
├─ options/                # Extension options page
│  └─ index.html
└─ src/
   ├─ background/
   │  ├─ index.ts          # Service worker entry
   │  ├─ handlers/         # Message handlers
   │  ├─ commands/         # Command processors
   │  ├─ services/         # Business logic (PageService, TaskService, etc.)
   │  └─ storage/          # Dexie database definitions
   ├─ content/
   │  └─ index.ts          # Content script
   ├─ sidepanel/
   │  ├─ main.ts           # Vue app entry
   │  ├─ App.vue           # Root component
   │  ├─ router/           # Vue Router config
   │  ├─ views/            # Page views (Home, Tasks, Notes, Chat, Help)
   │  └─ components/       # Reusable components
   ├─ authoring/           # Document editor
   │  └─ main.ts
   ├─ options/             # Settings page
   │  └─ main.ts
   └─ shared/
      ├─ messaging/        # Message types and utilities
      ├─ types/            # TypeScript types
      └─ utils/            # Shared utilities
```

---

## 🧠 Architecture

### Message-Passing Architecture

Superowser uses Chrome's message-passing system for all communication:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Side Panel │ ◄─────► │ Background       │ ◄─────► │  Omnibox    │
│  (Vue UI)   │         │ Service Worker   │         │  Handler    │
└─────────────┘         └──────────────────┘         └─────────────┘
                               │
                               │ Owns
                               ▼
                        ┌──────────────┐
                        │  Dexie DB    │
                        │  (IndexedDB) │
                        └──────────────┘
```

- **Side Panel**: Vue 3 UI for managing pages, tasks, and notes
- **Background Service Worker**: Handles all storage operations, search indexing, and business logic
- **Omnibox Handler**: Processes address bar inputs and returns search results
- **Content Script**: Extracts page metadata and handles highlights (TODO)

**Key Principle**: No direct database access from UI components - all goes through background service worker.

---

## 📊 Storage

### Data Model

**Pages (SavedPage):**
- URL, title, favicon
- Tags (string[])
- Shortcut (string, e.g., `@docs`)
- Task/Collection (string, e.g., `&project`)
- Access count, last accessed timestamp
- Creation and update timestamps

**Notes (NoteEntry):**
- Content (highlighted text)
- Comments
- Tags
- Associated task
- Source URL
- Timestamps

**Tasks (Task):**
- Name (unique identifier)
- Associated pages
- Creation date

**Documents (DocumentEntry):**
- Title, content (Markdown)
- Tags, associated task
- Timestamps

### Storage Limits

- Uses `unlimitedStorage` permission for large collections
- No hard limit on number of saved pages
- Optional automatic cleanup of unused pages (90+ days)

---

## 🔑 Permissions

Superowser requests these Chrome permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Store pages, notes, and settings locally |
| `unlimitedStorage` | Support large collections of saved pages |
| `tabs` | Access current tab information when saving |
| `activeTab` | Get active tab title and URL |
| `contextMenus` | Future: Right-click menu for saving highlights |
| `sidePanel` | Display the extension's side panel interface |
| `omnibox` | Enable `` ` `` search in Chrome's address bar |
| `scripting` | Optional: AI automation on authorized sites |
| `favicon` | Display website icons alongside saved pages |
| `*://*/*` | Access page content for saving metadata |

See [PERMISSIONS.md](./PERMISSIONS.md) for detailed justifications.

---

## 🐛 Troubleshooting

### Omnibox not working
- Ensure you type the backtick (`` ` ``) key in the address bar
- The backtick key is typically located above Tab, left of number 1
- Wait for the "Search Superowser" prompt to appear

### Side panel not opening
- Check that the extension is enabled in `chrome://extensions/`
- Try reloading the extension
- Check browser console for errors

### Pages not saving
- Verify storage permissions are granted
- Check available disk space
- Try exporting data and reimporting

### Search results not appearing
- Rebuild search index by closing and reopening the extension
- Check that pages are actually saved (view in Tasks)

---

## 🗺️ Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox support
- [ ] Enhanced note-taking with rich text
- [ ] Graph view of connections between pages
- [ ] Browser history import
- [ ] Bookmark import
- [ ] Collection sharing (export/import)
- [ ] Advanced search filters
- [ ] Custom keyboard shortcuts
- [ ] Dark mode

---

## 📄 License

[License TBD - Add your license here]

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/daofa-one/superowser/issues)
- **Email**: [Your support email]
- **Documentation**: See Help view in side panel

---

## 🙏 Acknowledgments

Built with:
- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework
- [Vuetify](https://vuetifyjs.com/) - Material Design component library
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [Fuse.js](https://fusejs.io/) - Fuzzy search library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Mermaid](https://mermaid.js.org/) - Diagram and flowchart rendering

---

**Made with ❤️ by Superowser Team**
