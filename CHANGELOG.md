# Changelog

All notable changes to Superowser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.3] - 2024-12-05

### Added
- **Help View**: Comprehensive help documentation in side panel with accordion sections
  - Getting Started guide
  - Omnibox trigger instructions with visual guides
  - Search patterns reference (all 6 patterns documented)
  - Chat commands reference
  - Tips & tricks section
- **Data Management**: Full export/import functionality
  - Export all data (pages, notes, tasks, documents) to JSON format
  - Import data with version validation
  - Backup and restore capabilities
- **Privacy Policy**: Created comprehensive PRIVACY.md
  - GDPR and CCPA compliance documentation
  - Clear data collection and storage policies
  - User rights and control documentation
- **Documentation**: Expanded README.md to 400+ lines
  - Installation instructions
  - Usage examples with omnibox patterns
  - Architecture diagrams
  - Development guides
  - Troubleshooting section
  - Roadmap
- **Manifest Metadata**: Added author and homepage URL

### Fixed
- Help documentation accuracy (removed references to unimplemented right-click feature)
- Console.log statements removed from message handler for cleaner production builds

### Changed
- Updated documentation to reflect actual features (copy text to save notes instead of right-click)
- Improved message handler error logging (kept console.error for actual errors)

### Removed
- AI test handlers (AI_TEST_AUTOMATION, AI_TEST_INJECTION) from production code
- Debug logging statements from critical message handling paths

### Security
- Improved privacy documentation for Chrome Web Store compliance
- Local-only storage emphasis in all user-facing documentation

---

## [0.0.2] - 2024-11-XX

### Added
- **Chat Box Interface**: Conversational UI for executing commands
  - Natural language input support
  - Command autocomplete with parameter suggestions
  - Customizable shortcut buttons
  - Support for `/save`, `/open`, `/task`, `/notes`, `/search` commands
- **AI Automation**: Experimental AI-powered page interaction
  - AI automation from chat box
  - Configurable logger utility with level control from options page
- **Document Authoring**: Full-featured document editor
  - Monaco editor integration for Markdown
  - Version management with diff view
  - Document status tracking
  - Export to SVG for diagrams
  - Preview and markdown sync
  - Reference panel with note counts and previews
- **Task Management Improvements**:
  - Task lists view with filtering
  - Add pages to tasks via UI
  - Set and persist active task
  - Task switching from omnibox search results
  - Improved task list styling
- **Notes Features**:
  - Add notes linked to current page and task
  - Search notes from omnibox using `!!` pattern
  - Context menu to delete notes
  - Edit notes functionality
  - Dedicated Notes view
  - Note filtering and organization
- **Page Management**:
  - Visual indicators for saved vs unsaved pages
  - Switch to existing tab if already opened
  - Page action buttons with focus-based visibility
  - Smooth page content transitions
  - Page metadata display improvements

### Fixed
- Connection errors in background service worker
- Async function event handler issues
- Lint errors across codebase
- Shortcut prefix double-input bug
- Tag management in notes
- Autocomplete for exact matches
- Search all pages when no context provided

### Changed
- Refactored background script architecture for better maintainability
- Updated logo and branding
- Improved UI spacing and text sizing
- Limited task name length in dropdown menus
- Enhanced task and notes view styling
- Better transition to Home view from omnibox searches

---

## [0.0.1] - 2024-XX-XX

### Added
- **Core Features**:
  - Side panel UI with Vue 3 and Vuetify
  - Omnibox integration with backtick (`` ` ``) trigger
  - IndexedDB storage via Dexie.js
  - Fuzzy search with Fuse.js
- **Page Saving**:
  - Save pages with tags and shortcuts
  - Assign pages to tasks/collections
  - Access tracking (count and timestamp)
- **Search Patterns**:
  - `@shortcut` - Open by shortcut
  - `#tag` - Filter by tag
  - `&task` - Show task/collection
  - General fuzzy search
- **Basic UI Components**:
  - Menu navigation
  - Current page info display
  - Task list display
  - Footer
- **Storage Models**:
  - SavedPage schema
  - Task schema
  - NoteEntry schema
  - DocumentEntry schema
- **Chrome Extension Structure**:
  - Manifest V3 configuration
  - Background service worker
  - Content script placeholder
  - Side panel entry points

### Infrastructure
- Vite build system with @crxjs/vite-plugin
- TypeScript configuration
- ESLint and Prettier setup
- Development mode with hot reload

---

## Unreleased Features (Roadmap)

- [ ] Chrome Web Store publication
- [ ] Firefox support
- [ ] Enhanced note-taking with rich text editor
- [ ] Graph view of page connections
- [ ] Browser history import
- [ ] Bookmark import
- [ ] Collection sharing (export/import specific collections)
- [ ] Advanced search filters and operators
- [ ] Custom keyboard shortcuts
- [ ] Dark mode theme
- [ ] Right-click context menu for saving highlights
- [ ] Automatic page archival and cleanup suggestions
- [ ] Statistics and analytics dashboard

---

## Version History

- **0.0.3** - Chrome Web Store preparation (current)
- **0.0.2** - Chat interface and document authoring
- **0.0.1** - Initial release with core features

---

[0.0.3]: https://github.com/daofa-one/superowser/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/daofa-one/superowser/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/daofa-one/superowser/releases/tag/v0.0.1
