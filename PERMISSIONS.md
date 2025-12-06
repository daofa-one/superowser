# Chrome Permissions Explanation

This document explains all permissions requested by Superowser and why they are necessary for the extension's core functionality.

---

## Overview

Superowser is a **privacy-first, local-only** browser extension. All permissions are used solely for local functionality - **no data is ever transmitted to external servers**.

**Key Principle**: Every permission is essential for core features. We request the minimum permissions necessary to provide full functionality.

---

## Requested Permissions

### 🗄️ `storage`
**Purpose**: Store extension settings and user data locally

**Why Required**:
- Store user preferences (active task, UI settings)
- Persist extension configuration
- Sync settings across extension components (side panel, background worker, omnibox)

**Data Stored**:
- Active task name
- UI preferences
- Extension settings from options page
- Logger configuration

**Storage Location**: `chrome.storage.local` (stored locally on your device only)

**Privacy**: No data leaves your device. This is standard Chrome extension local storage.

---

### 💾 `unlimitedStorage`
**Purpose**: Allow large collections of saved pages without storage limits

**Why Required**:
- Chrome extensions have a default quota limit (~10MB for `chrome.storage.local`, ~5MB for IndexedDB)
- Users may save hundreds or thousands of pages with metadata
- Each saved page includes: URL, title, favicon, tags, timestamps, notes
- Without this permission, users would hit storage limits quickly

**Typical Usage**:
- 100 pages ≈ 1-2 MB
- 1,000 pages ≈ 10-20 MB
- 10,000 pages ≈ 100-200 MB

**Privacy**: This permission only allows *more* local storage - data still never leaves your device.

---

### 🗂️ `tabs`
**Purpose**: Access information about browser tabs

**Why Required**:
- Get current tab URL when saving a page
- Get current tab title when saving a page
- Detect when user switches tabs to update "current page" display
- Open saved pages in new or existing tabs
- Switch to existing tab if page is already open

**What We Access**:
- Tab URL
- Tab title
- Tab ID
- Tab favicon URL

**What We DON'T Access**:
- Tab content (page HTML/text)
- Browsing history beyond current tab
- Tabs in incognito windows (unless explicitly granted)

**Privacy**: Only current tab information is accessed, and only when you interact with the extension.

---

### 🎯 `activeTab`
**Purpose**: Access the currently active tab's basic information

**Why Required**:
- Get active tab title and URL when you click "Save"
- Display current page information in side panel
- Determine if current page is already saved

**Scope**: Only affects the currently active tab, and only when you interact with the extension

**Privacy**: More restrictive than `tabs` - only accesses data when you explicitly use the extension.

---

### ⚙️ `background`
**Purpose**: Run a background service worker

**Why Required**:
- Handle omnibox search queries
- Maintain IndexedDB database connection
- Process messages from side panel and content scripts
- Manage search index for fast fuzzy search
- Handle page saving and retrieval logic

**What It Does**:
- Runs continuously to respond to omnibox input
- Manages all data storage operations
- No network requests or data transmission

**Privacy**: Background worker operates entirely locally. No external communication.

---

### 🖱️ `contextMenus`
**Purpose**: Add right-click menu options (future feature)

**Why Required**:
- **Future feature**: Right-click selected text → "Save to Superowser"
- **Future feature**: Right-click link → "Save link to Superowser"

**Current Status**: Permission requested but feature not yet implemented

**Privacy**: When implemented, will only save data locally based on your explicit right-click action.

---

### 🎨 `favicon`
**Purpose**: Access website favicons (icons)

**Why Required**:
- Display website icons next to saved pages in side panel
- Show favicons in omnibox search results
- Visual identification of saved pages

**What We Access**:
- Only favicons from pages you explicitly save
- Favicons are cached locally

**Privacy**: Chrome provides favicon URLs - we don't access page content. Icons are stored locally.

---

### 📱 `sidePanel`
**Purpose**: Display the extension's side panel interface

**Why Required**:
- Show the main Superowser UI in Chrome's side panel
- Provide access to saved pages, tasks, notes, and chat interface
- This is the primary interface for the extension

**What It Does**:
- Opens side panel when you click the extension icon
- Displays Vue 3 UI for managing pages and tasks

**Privacy**: Side panel runs entirely locally in your browser.

---

### 🔍 `omnibox`
**Purpose**: Enable address bar search with backtick (`` ` ``) trigger

**Why Required**:
- Core feature: Type `` ` `` in Chrome's address bar to search saved pages
- Enable all 6 search patterns (@shortcut, #tag, &task, !!notes, /command, general search)
- Provide instant fuzzy search results

**What It Does**:
- Registers `` ` `` as the omnibox keyword
- Processes your search queries locally
- Returns matching pages from local database

**Privacy**: All search happens locally. No queries sent to external servers.

---

### 🔧 `scripting`
**Purpose**: Inject scripts into web pages (for AI automation only)

**Why Required**:
- **AI automation feature**: Interact with ChatGPT, Claude, and Perplexity for automation
- Bridge between AI chat interfaces and extension commands
- Extract page content for saving metadata

**Scope**: Limited to specific authorized sites:
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://www.perplexity.ai/*`

**What It Does**:
- Injects `ai-bridge.js` script only on authorized AI sites
- Enables AI-assisted task automation
- No access to other websites unless explicitly authorized

**Privacy**:
- Only operates on AI sites you actively use
- No data sent to external servers
- You control when AI automation is used

**Note**: This is an experimental feature. You can disable it in settings if not needed.

---

## Host Permissions

### 🌐 `*://*/*` and `<all_urls>`
**Purpose**: Access any website's content for metadata extraction

**Why Required**:
- Extract page title when you save a page
- Get page URL and metadata
- Access favicon URLs
- Future: Extract page content for full-text search
- Future: Capture highlighted text as notes

**What We Access**:
- Page title (from `<title>` tag)
- Page URL
- Favicon URL
- Optionally: Selected text (when you explicitly save it)

**What We DON'T Access**:
- Browsing history
- Pages you haven't saved
- Form data or passwords
- Cookies or authentication tokens
- Personal information

**When We Access**:
- Only when you explicitly click "Save" in the side panel
- Only for the current active tab
- Only when side panel is open

**Privacy**: We never transmit page content anywhere. All data stays local.

---

## Web Accessible Resources

### `authoring/index.html` and `assets/*`
**Purpose**: Load extension pages and assets

**Why Required**:
- Display the document authoring interface
- Load CSS, JavaScript, and images for the extension UI
- Required for Vue 3 components to function

**Privacy**: These are extension files, not user data.

---

### `assets/ai-bridge.js`
**Purpose**: AI automation bridge script

**Why Required**:
- Injected only into ChatGPT, Claude, and Perplexity pages
- Enables AI-assisted automation features
- Communicates between AI chat interface and extension

**Scope**: Only accessible on:
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://www.perplexity.ai/*`

**Privacy**: Script runs locally in browser. No external communication.

---

## Content Security Policy

```
script-src 'self'; object-src 'self';
```

**Purpose**: Restrict what scripts can run in the extension

**Why Required**:
- Security hardening
- Only allow scripts from the extension itself
- Prevent injection attacks
- Required for Chrome Web Store compliance

**Privacy**: This protects you by ensuring no external scripts can run in the extension.

---

## Permission Comparison

| Permission | When Used | What's Accessed | Data Transmitted |
|------------|-----------|-----------------|------------------|
| `storage` | Always | Extension settings | None (local only) |
| `unlimitedStorage` | When saving many pages | Local IndexedDB | None (local only) |
| `tabs` | When saving/opening pages | Current tab info | None |
| `activeTab` | When side panel open | Active tab URL/title | None |
| `background` | Always | N/A (runs locally) | None |
| `contextMenus` | Future feature | N/A | None |
| `favicon` | When displaying pages | Favicon URLs | None |
| `sidePanel` | When you open side panel | N/A | None |
| `omnibox` | When searching (`` ` ``) | Your search query | None (local search) |
| `scripting` | AI automation only | Page content (AI sites) | None |
| `*://*/*` | When saving page | Page metadata | None |

---

## Privacy Guarantees

✅ **No external servers** - All data processing happens locally
✅ **No analytics** - We don't track your usage
✅ **No telemetry** - No data sent to developers
✅ **No third-party services** - No external dependencies
✅ **No cloud storage** - Everything stays on your device
✅ **No account required** - No personal information collected
✅ **Open source** - You can audit the code yourself

See [PRIVACY.md](./PRIVACY.md) for complete privacy policy.

---

## Reducing Permissions

**Can I use Superowser with fewer permissions?**

Unfortunately, no. Each permission is essential for core functionality:

- **Without `storage`**: Can't save any settings
- **Without `tabs`**: Can't save or open pages
- **Without `omnibox`**: Can't search from address bar (core feature)
- **Without `sidePanel`**: No user interface
- **Without `*://*/*`**: Can't extract page metadata when saving

**Optional Permissions**:
- `scripting`: Only needed for AI automation. Can be avoided by not using AI features.
- `contextMenus`: Future feature, not yet used

---

## Auditing the Extension

You can verify our privacy claims:

1. **Inspect the code**: Extension is open source (link TBD)
2. **Monitor network**: Use Chrome DevTools Network tab - no external requests
3. **Check storage**: Inspect `chrome.storage.local` and IndexedDB in DevTools
4. **Review permissions**: See exactly what we request in `manifest.json`

---

## Questions?

If you have concerns about any permission, please:

- **File an issue**: [GitHub Issues](https://github.com/daofa-one/superowser/issues)
- **Email us**: [Your email]
- **Read the code**: [GitHub Repository](https://github.com/daofa-one/superowser)

We're committed to transparency and minimal permissions.

---

**Last Updated**: 2024-12-05
**Extension Version**: 0.0.3
