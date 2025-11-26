# Skill: Tagging System

## Overview

The tagging system is the core organizational structure in Superowser. It consists of three interconnected concepts: **tags**, **shortcuts**, and **tasks/collections**.

## Core Concepts

### 1. Tags (`#tag`)

**Purpose**: Categorize and filter pages by topic or category.

**Syntax Rules**:
- Alphanumeric + hyphens + underscores only: `[a-zA-Z0-9_-]+`
- No spaces (use hyphens or underscores instead)
- Case-insensitive for searching
- Multiple tags per page supported

**Examples**:
- Valid: `#ml`, `#machine-learning`, `#ml_papers`, `#2024`
- Invalid: `#machine learning` (space), `#ml!` (special char)

**Storage**:
```typescript
interface PageEntry {
  id: number;
  url: string;
  title: string;
  tags: string[];  // Array of tag strings (without # prefix)
  // ...
}
```

**Searching**:
```typescript
// Find pages with tag
await db.pages.where('tags').equals('ml').toArray();

// Find pages with any of multiple tags
await db.pages.where('tags').anyOf(['ml', 'ai']).toArray();
```

---

### 2. Shortcuts (`@shortcut`)

**Purpose**: Quick, memorable aliases for frequently accessed pages.

**Syntax Rules**:
- Same as tags: `[a-zA-Z0-9_-]+`
- Must be unique per page (one shortcut per page, no duplicates)
- Case-insensitive
- Optional (pages don't need shortcuts)

**Examples**:
- `@gmail` → opens Gmail
- `@docs` → opens Google Docs
- `@ml-blog` → opens specific ML blog post

**Storage**:
```typescript
interface PageEntry {
  shortcut?: string;  // Optional, unique
}

// Dexie index
this.version(1).stores({
  pages: '++id, url, shortcut, *tags, task'
  //                 ^^^^^^^^ indexed for fast lookup
});
```

**Searching**:
```typescript
// Exact match only (fastest)
const page = await db.pages.where('shortcut').equals('gmail').first();
if (page) {
  chrome.tabs.create({ url: page.url });
}
```

**Validation**:
```typescript
async function isShortcutAvailable(shortcut: string, excludePageId?: number): Promise<boolean> {
  const existing = await db.pages.where('shortcut').equals(shortcut).first();
  return !existing || existing.id === excludePageId;
}
```

---

### 3. Tasks/Collections (`&task`)

**Purpose**: Group related pages into a named workspace or project.

**Syntax Rules**:
- Same as tags: `[a-zA-Z0-9_-]+`
- Multiple pages can share the same task
- Optional (pages can be taskless)
- Represents "current working context"

**Examples**:
- `&research-project` → All pages for a research project
- `&vacation-planning` → Travel-related pages
- `&work` → Work-related pages

**Storage**:
```typescript
interface PageEntry {
  task?: string;  // Optional, non-unique
}
```

**Active Task Pattern**:
```typescript
// UI maintains "current task" state
let currentTask: string | null = null;

// Filter pages by current task
async function getCurrentTaskPages(): Promise<PageEntry[]> {
  if (!currentTask) return [];
  return db.pages.where('task').equals(currentTask).toArray();
}

// Context-aware search boosts current task results
function applyTaskBoost(page: PageEntry, score: number): number {
  return page.task === currentTask ? score * 1.5 : score;
}
```

---

## Relationships

### Tags vs Shortcuts
- **Tags**: Many-to-many (page can have multiple tags, tag can apply to multiple pages)
- **Shortcuts**: One-to-one (each page has at most one unique shortcut)

### Tags vs Tasks
- **Tags**: Topic-based categorization (`#ml`, `#tutorial`)
- **Tasks**: Project/context-based grouping (`&research-project`)
- Pages can have both: `#ml` page in `&research-project` task

### Typical Usage Pattern
```typescript
interface SavePageRequest {
  url: string;
  title: string;
  tags: string[];         // e.g., ['ml', 'paper', 'attention']
  shortcut?: string;      // e.g., 'attention-paper'
  task?: string;          // e.g., 'research-project'
}
```

---

## Autocomplete Logic

### Tag Autocomplete

Show suggestions based on:
1. Existing tags in database (frequency-sorted)
2. Fuzzy match against user input
3. Tags from current task (boosted)

```typescript
async function suggestTags(input: string): Promise<string[]> {
  const allPages = await db.pages.toArray();

  // Extract all unique tags with frequency
  const tagFrequency = new Map<string, number>();
  allPages.forEach(page => {
    page.tags.forEach(tag => {
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
    });
  });

  // Filter by fuzzy match and sort by frequency
  return Array.from(tagFrequency.entries())
    .filter(([tag]) => tag.toLowerCase().includes(input.toLowerCase()))
    .sort((a, b) => b[1] - a[1])  // Descending frequency
    .map(([tag]) => tag)
    .slice(0, 10);  // Top 10 suggestions
}
```

### Shortcut Autocomplete

Only show if searching with `@` prefix:
```typescript
async function suggestShortcuts(input: string): Promise<PageEntry[]> {
  if (!input.startsWith('@')) return [];

  const query = input.slice(1).toLowerCase();
  const pages = await db.pages.where('shortcut').notEqual('').toArray();

  return pages
    .filter(page => page.shortcut?.toLowerCase().includes(query))
    .slice(0, 10);
}
```

### Task Autocomplete

Show existing tasks:
```typescript
async function suggestTasks(input: string): Promise<string[]> {
  const allPages = await db.pages.toArray();
  const tasks = new Set(allPages.map(p => p.task).filter(Boolean) as string[]);

  return Array.from(tasks)
    .filter(task => task.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 10);
}
```

---

## UI Patterns

### Displaying Tags
```vue
<template>
  <div class="tags">
    <span v-for="tag in page.tags" :key="tag" class="tag">
      #{{ tag }}
    </span>
  </div>
</template>

<style scoped>
.tag {
  background: #e0e7ff;
  color: #3730a3;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
}
</style>
```

### Editing Tags (Input with Autocomplete)
```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

const tagInput = ref('');
const selectedTags = ref<string[]>([]);
const suggestions = ref<string[]>([]);

async function updateSuggestions() {
  if (tagInput.value.length > 0) {
    suggestions.value = await suggestTags(tagInput.value);
  } else {
    suggestions.value = [];
  }
}

function addTag(tag: string) {
  if (!selectedTags.value.includes(tag)) {
    selectedTags.value.push(tag);
  }
  tagInput.value = '';
  suggestions.value = [];
}
</script>
```

---

## Common Pitfalls

### ❌ Don't store `#` prefix in database
```typescript
// Bad
page.tags = ['#ml', '#ai'];

// Good
page.tags = ['ml', 'ai'];
```

### ❌ Don't allow duplicate shortcuts
```typescript
// Always validate before saving
const existing = await db.pages.where('shortcut').equals(newShortcut).first();
if (existing && existing.id !== page.id) {
  throw new Error('Shortcut already in use');
}
```

### ❌ Don't forget case-insensitive search
```typescript
// Bad
db.pages.where('tags').equals('ML')  // Won't match 'ml'

// Good
// Store lowercase, search lowercase
page.tags = userInput.map(t => t.toLowerCase());
```

---

## Related Files

- `src/types/page.ts` - PageEntry interface
- `src/background/database.ts` - Dexie schema with indexes
- `src/background/search.ts` - Search and autocomplete logic
- `src/sidepanel/components/TagInput.vue` - Tag input component
- `CLAUDE.md` - User-facing documentation on tagging system
