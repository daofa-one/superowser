# Skill: Omnibox Command Syntax

## Overview

The omnibox (Chrome's address bar) is the primary search and navigation interface for Superowser. Commands begin with a backtick (`` ` ``) and support various patterns for finding and opening saved pages.

## Command Grammar

### Activation

User types `` ` `` in the omnibox → Superowser takes over suggestions.

---

### 1. Shortcut Navigation (`` ` @shortcut``)

**Purpose**: Instantly open a saved page by its shortcut.

**Syntax**: `` ` @<shortcut>``

**Behavior**:
- Exact match only (no fuzzy matching)
- If found, navigation is instant
- If not found, show "No page with shortcut @xyz"

**Examples**:
- `` ` @gmail`` → Opens Gmail
- `` ` @docs`` → Opens Google Docs
- `` ` @ml-blog`` → Opens ML blog

**Implementation**:
```typescript
async function handleShortcutCommand(shortcut: string): Promise<SearchResult[]> {
  const page = await db.pages.where('shortcut').equals(shortcut).first();

  if (page) {
    return [{
      content: page.url,
      description: `<match>@${shortcut}</match> - ${page.title}`
    }];
  }

  return [{
    content: '',
    description: `No page with shortcut @${shortcut}`
  }];
}
```

---

### 2. Tag Search (`` ` #tag`` or `` ` #tag1 #tag2``)

**Purpose**: Find all pages with specified tag(s).

**Syntax**: `` ` #<tag>`` or `` ` #<tag1> #<tag2>``

**Behavior**:
- Returns pages that have ANY of the specified tags (OR logic)
- Sorted by recency (most recent first)
- Shows tag badges in results

**Examples**:
- `` ` #ml`` → All pages tagged with #ml
- `` ` #ml #ai`` → Pages tagged with #ml OR #ai

**Implementation**:
```typescript
async function handleTagCommand(tags: string[]): Promise<SearchResult[]> {
  const pages = await db.pages
    .where('tags')
    .anyOf(tags)
    .reverse()  // Most recent first
    .limit(10)
    .toArray();

  return pages.map(page => ({
    content: page.url,
    description: formatPageResult(page)
  }));
}

function formatPageResult(page: PageEntry): string {
  const tagsDisplay = page.tags.map(t => `<dim>#${t}</dim>`).join(' ');
  const shortcutDisplay = page.shortcut ? `<dim>@${page.shortcut}</dim>` : '';
  return `${page.title} ${tagsDisplay} ${shortcutDisplay}`;
}
```

---

### 3. Task/Collection Search (`` ` &task``)

**Purpose**: Show all pages in a specific task/collection.

**Syntax**: `` ` &<task>``

**Behavior**:
- Returns all pages with matching task
- Sorted by date added (most recent first)
- Shows task name in results

**Examples**:
- `` ` &research-project`` → All pages in research-project task
- `` ` &work`` → All work-related pages

**Implementation**:
```typescript
async function handleTaskCommand(task: string): Promise<SearchResult[]> {
  const pages = await db.pages
    .where('task')
    .equals(task)
    .reverse()
    .limit(10)
    .toArray();

  if (pages.length === 0) {
    return [{
      content: '',
      description: `No pages in task &${task}`
    }];
  }

  return pages.map(page => ({
    content: page.url,
    description: `<dim>&${task}</dim> - ${page.title}`
  }));
}
```

---

### 4. Notes Search (`` ` !!query``)

**Purpose**: Search within saved notes and highlights.

**Syntax**: `` ` !!<search query>``

**Behavior**:
- Searches note content and comments
- Returns pages that have matching notes
- Shows snippet of matched text
- Case-insensitive

**Examples**:
- `` ` !!attention mechanism`` → Notes containing "attention mechanism"
- `` ` !!TODO`` → Notes with TODO markers

**Implementation**:
```typescript
async function handleNotesCommand(query: string): Promise<SearchResult[]> {
  const notes = await db.notes.toArray();
  const lowerQuery = query.toLowerCase();

  const matchingNotes = notes.filter(note =>
    note.content.toLowerCase().includes(lowerQuery) ||
    note.comment?.toLowerCase().includes(lowerQuery)
  );

  // Get associated pages
  const pageIds = [...new Set(matchingNotes.map(n => n.pageId))];
  const pages = await db.pages.bulkGet(pageIds);

  return pages
    .filter(Boolean)
    .map(page => {
      const note = matchingNotes.find(n => n.pageId === page.id);
      const snippet = extractSnippet(note!.content, query);

      return {
        content: page.url,
        description: `📝 ${page.title} - <dim>${snippet}</dim>`
      };
    })
    .slice(0, 10);
}

function extractSnippet(text: string, query: string, contextLength = 50): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, contextLength) + '...';

  const start = Math.max(0, index - contextLength / 2);
  const end = Math.min(text.length, index + query.length + contextLength / 2);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}
```

---

### 5. Fuzzy Full-Text Search (`` ` query``)

**Purpose**: Search across titles, URLs, and tags using fuzzy matching.

**Syntax**: `` ` <search query>`` (no prefix)

**Behavior**:
- Fuzzy matches against title, URL, tags
- Ranked by relevance (see `search-algorithms.md`)
- Context-aware (boosts current task)
- Typo-tolerant

**Examples**:
- `` ` machine learning`` → Pages about machine learning
- `` ` mlblog`` → Matches "ml-blog", "mlblg", etc.

**Implementation**:
```typescript
async function handleFuzzySearch(query: string): Promise<SearchResult[]> {
  const pages = await db.pages.toArray();
  const currentTask = await getCurrentTask();

  const rankedResults = pages
    .map(page => ({
      page,
      score: calculateScore(query, page, currentTask)
    }))
    .filter(r => r.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return rankedResults.map(r => ({
    content: r.page.url,
    description: formatPageResult(r.page)
  }));
}

// See search-algorithms.md for calculateScore implementation
```

---

## Command Precedence

When parsing omnibox input, check in this order:

1. **Shortcut** (`` ` @``) - Highest priority, exact match
2. **Tag** (`` ` #``) - Medium priority
3. **Task** (`` ` &``) - Medium priority
4. **Notes** (`` ` !!``) - Medium priority
5. **Fuzzy search** - Default fallback

```typescript
function parseOmniboxInput(input: string): ParsedCommand {
  const trimmed = input.trim();

  // Check for shortcut
  if (trimmed.startsWith('@')) {
    return {
      type: 'shortcut',
      value: trimmed.slice(1)
    };
  }

  // Check for tag (can be multiple)
  if (trimmed.includes('#')) {
    const tags = trimmed.match(/#([a-zA-Z0-9_-]+)/g)?.map(t => t.slice(1)) || [];
    return {
      type: 'tag',
      value: tags
    };
  }

  // Check for task
  if (trimmed.startsWith('&')) {
    return {
      type: 'task',
      value: trimmed.slice(1)
    };
  }

  // Check for notes search
  if (trimmed.startsWith('!!')) {
    return {
      type: 'notes',
      value: trimmed.slice(2).trim()
    };
  }

  // Default: fuzzy search
  return {
    type: 'fuzzy',
    value: trimmed
  };
}
```

---

## Autocomplete Behavior

As user types, show suggestions dynamically:

### Typing `` ` @`` → Suggest shortcuts
- Show recently used shortcuts
- Fuzzy match against existing shortcuts
- Format: `@shortcut - Page Title`

### Typing `` ` #`` → Suggest tags
- Show popular tags
- Fuzzy match against existing tags
- Show page count per tag

### Typing `` ` &`` → Suggest tasks
- Show active tasks
- Sort by page count
- Format: `&task (5 pages)`

### Typing `` ` !!`` → Show recent notes
- Last 10 notes created
- Group by page

### Typing `` ` query`` → Show fuzzy results
- Real-time search as user types
- Ranked results
- Update on each keystroke (debounced 200ms)

---

## Result Formatting

Chrome omnibox supports basic XML-like formatting:

```typescript
function formatSuggestion(page: PageEntry): string {
  // <match>text</match> - Bold highlight
  // <dim>text</dim> - Dimmed/gray text
  // <url>text</url> - URL formatting

  const title = page.title;
  const tags = page.tags.map(t => `<dim>#${t}</dim>`).join(' ');
  const shortcut = page.shortcut ? `<dim>@${page.shortcut}</dim>` : '';
  const task = page.task ? `<dim>&${page.task}</dim>` : '';

  return `${title} ${tags} ${shortcut} ${task}`.trim();
}
```

---

## Error Handling

### No results found
```typescript
return [{
  content: '',  // Empty = non-navigable
  description: 'No pages found matching "<match>' + query + '</match>"'
}];
```

### Invalid command
```typescript
return [{
  content: '',
  description: 'Invalid command. Try: @shortcut, #tag, &task, !!notes, or search query'
}];
```

---

## Performance Considerations

- **Debounce input**: Wait 200ms after last keystroke before searching
- **Limit results**: Max 10 suggestions per query
- **Cache**: Cache recent searches for 1 minute
- **Index usage**: Always use Dexie indexes for tag/shortcut/task queries

---

## Related Files

- `src/background/omnibox.ts` - Omnibox handler implementation
- `src/background/search.ts` - Search logic
- `src/types/commands.ts` - Command type definitions
- `CLAUDE.md` - User-facing documentation
