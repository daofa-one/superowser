# Skills Roadmap for Superowser

## Currently Implemented ✅

All skills now follow the correct Claude Code structure with folders and SKILL.md files:

1. **browser-extension-patterns/** - Chrome extension architecture, contexts, message passing
   - `SKILL.md` - Main documentation

2. **vue-component-standards/** - Vue 3 Composition API patterns
   - `SKILL.md` - Main documentation
   - `templates/component.vue` - Component template
   - `templates/composable.ts` - Composable template

3. **search-algorithms/** - Fuzzy matching, ranking, context-aware search
   - `SKILL.md` - Main documentation
   - `examples.md` - Detailed examples

4. **tagging-system/** - Tags, shortcuts, and tasks/collections
   - `SKILL.md` - Main documentation

5. **omnibox-command-syntax/** - Command patterns (`` ` @, #, &, !!``)
   - `SKILL.md` - Main documentation

6. **message-protocol/** - Inter-context communication
   - `SKILL.md` - Main documentation

---

## Recommended Skills to Create

### Domain & Business Logic

#### 4. **tagging-system** (Priority: HIGH)
**Shared by**: UX Agent, Data Agent, Frontend Agent

**Contents**:
- Tag syntax and validation rules (e.g., no spaces, alphanumeric + `-_`)
- Shortcut patterns (`@shortcut` syntax)
- Task/collection patterns (`&task` syntax)
- How tags, shortcuts, and tasks relate
- Autocomplete logic for tag suggestions
- Tag merging and renaming strategies

**Why**: Core to the app's organization model - all agents need to understand this

---

#### 5. **omnibox-command-syntax** (Priority: HIGH)
**Shared by**: UX Agent, Data Agent, Frontend Agent

**Contents**:
- Complete command grammar: `` ` @, ` #, ` &, ` !!, ` query``
- Parsing logic and precedence
- Autocomplete behavior per command type
- Error handling for malformed commands
- Examples of complex queries

**Why**: Primary interaction model - needs consistent understanding across agents

---

#### 6. **notes-and-highlights** (Priority: MEDIUM)
**Shared by**: Data Agent, Frontend Agent, UX Agent

**Contents**:
- How highlights are captured from content script
- Note storage schema (linked to pages)
- Search within notes (`` ` !!`` command)
- Display patterns (📝 marker in UI)
- Editing and deleting notes
- Context preservation (which page, what task)

**Why**: Secondary but important feature - requires coordination between contexts

---

### Technical Patterns

#### 7. **message-protocol** (Priority: HIGH)
**Shared by**: Frontend Agent, Data Agent

**Contents**:
- Standard message envelope structure:
  ```typescript
  interface Message<T = any> {
    type: string;
    payload?: T;
    requestId?: string; // For async responses
  }
  ```
- All message types enum/constants
- Request/response patterns
- Error handling in messages
- Timeout handling

**Why**: Prevents message type drift between frontend and background

---

#### 8. **indexeddb-optimization** (Priority: MEDIUM)
**Shared by**: Data Agent

**Contents**:
- Dexie compound indexes
- Query optimization techniques
- When to use `.where()` vs `.filter()`
- Batch operations for performance
- Transaction management
- Storage quota handling
- Data cleanup strategies

**Why**: Critical for app performance as data grows

---

#### 9. **typescript-patterns** (Priority: MEDIUM)
**Shared by**: Frontend Agent, Data Agent

**Contents**:
- Shared type definitions location (`src/types/`)
- Interface naming conventions
- Utility types used (Partial, Pick, Omit)
- Type guards and narrowing
- Generic patterns for message handlers
- Avoiding `any` - proper unknown handling

**Why**: Ensures type safety across the codebase

---

### Quality & Testing

#### 10. **testing-strategies** (Priority: MEDIUM)
**Shared by**: Frontend Agent, Data Agent

**Contents**:
- Unit testing Vue components (Vue Test Utils)
- Mocking chrome APIs
- Testing Dexie operations (in-memory DB)
- Testing search algorithms
- Integration testing across contexts
- E2E testing extension (Playwright/Puppeteer)

**Why**: Ensures quality and prevents regressions

---

#### 11. **accessibility-standards** (Priority: MEDIUM)
**Shared by**: UX Agent, Frontend Agent

**Contents**:
- WCAG 2.1 AA requirements
- Keyboard navigation patterns
- ARIA labels and roles
- Focus management in side panel
- Screen reader testing
- Color contrast requirements
- Reduced motion support

**Why**: Makes extension usable for everyone

---

#### 12. **error-handling** (Priority: MEDIUM)
**Shared by**: All Agents

**Contents**:
- Error types and when to use them
- User-facing error messages (friendly, actionable)
- Logging strategy
- Error boundaries in Vue
- Chrome API error handling
- Recovery strategies (retry logic, fallbacks)
- Error reporting to console vs user

**Why**: Provides good UX when things go wrong

---

### Integration & Data

#### 13. **data-import-export** (Priority: LOW)
**Shared by**: Data Agent, Frontend Agent

**Contents**:
- JSON export format (complete backup)
- CSV export format (for spreadsheets)
- Import validation and conflict resolution
- Schema versioning for migrations
- Backup best practices
- Restoring data from backup

**Why**: User data portability and backup

---

#### 14. **browser-compatibility** (Priority: LOW)
**Shared by**: Frontend Agent

**Contents**:
- Chrome-specific APIs used
- Manifest V3 requirements
- Potential Firefox WebExtensions compatibility
- Fallbacks for missing APIs
- Feature detection patterns
- Polyfills if needed

**Why**: Future-proofing for cross-browser support

---

## Prioritization

### Phase 1 (Immediate) - Core Functionality
- ✅ browser-extension-patterns/
- ✅ vue-component-standards/
- ✅ search-algorithms/
- ✅ tagging-system/
- ✅ omnibox-command-syntax/
- ✅ message-protocol/

### Phase 2 (Near-term) - Quality & Performance
- 🔲 notes-and-highlights
- 🔲 indexeddb-optimization
- 🔲 typescript-patterns
- 🔲 error-handling
- 🔲 testing-strategies

### Phase 3 (Future) - Polish & Expansion
- 🔲 accessibility-standards
- 🔲 data-import-export
- 🔲 browser-compatibility

---

## How to Use Skills

### For Agents
- Reference relevant skills in your "Skills to Use" section
- Link to specific sections when providing guidance
- Update skills when patterns change

### For Developers
- Read skills to understand project patterns
- Follow patterns consistently
- Propose skill updates when discovering new patterns

### Creating a New Skill

Following the correct Claude Code structure:

1. **Create folder**: `.claude/skills/skill-name/`
2. **Create SKILL.md** with:
   - Overview
   - Core patterns with code examples
   - Usage guidelines
   - Related files
   - Common pitfalls to avoid
3. **Add supporting files** (optional):
   - `templates/` - Code templates
   - `scripts/` - Helper scripts
   - `examples.md` - Additional examples
4. Update this roadmap
5. Reference in relevant agents
