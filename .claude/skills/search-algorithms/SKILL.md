# Skill: Search and Retrieval Algorithms

## Overview

Search, fuzzy matching, and ranking algorithms used in Superowser for finding pages, notes, and collections.

## Search Strategies

### 1. Exact Shortcut Match

Highest priority - instant navigation:

```typescript
// Pattern: ` @shortcut
async function findByShortcut(shortcut: string): Promise<PageEntry | null> {
  return db.pages.where('shortcut').equals(shortcut).first();
}
```

**Ranking**: Always first result if exists.

### 2. Tag-Based Search

```typescript
// Pattern: ` #tag or ` #tag1 #tag2
async function findByTags(tags: string[]): Promise<PageEntry[]> {
  return db.pages
    .where('tags')
    .anyOf(tags)
    .toArray();
}
```

**Ranking**: More matching tags = higher rank.

### 3. Task/Collection Search

```typescript
// Pattern: ` &task
async function findByTask(task: string): Promise<PageEntry[]> {
  return db.pages
    .where('task')
    .equals(task)
    .sortBy('created'); // Most recent first
}
```

### 4. Notes/Highlight Search

```typescript
// Pattern: ` !! query
async function searchNotes(query: string): Promise<NoteEntry[]> {
  const notes = await db.notes.toArray();
  return notes
    .filter(note =>
      note.content.toLowerCase().includes(query.toLowerCase()) ||
      note.comment?.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => b.created - a.created);
}
```

### 5. Fuzzy Full-Text Search

```typescript
// Pattern: ` query
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 1.0;

  // Starts with
  if (t.startsWith(q)) return 0.9;

  // Contains as word
  if (new RegExp(`\\b${q}\\b`).test(t)) return 0.8;

  // Contains anywhere
  if (t.includes(q)) return 0.7;

  // Levenshtein distance for typo tolerance
  const distance = levenshteinDistance(q, t);
  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - (distance / maxLen);

  return similarity > 0.6 ? similarity * 0.6 : 0;
}

async function fuzzySearch(query: string): Promise<RankedResult[]> {
  const pages = await db.pages.toArray();

  return pages
    .map(page => ({
      page,
      score: Math.max(
        fuzzyMatch(query, page.title) * 2.0,  // Title most important
        fuzzyMatch(query, page.url) * 1.0,
        ...page.tags.map(tag => fuzzyMatch(query, tag) * 1.5)
      )
    }))
    .filter(result => result.score > 0.4)
    .sort((a, b) => b.score - a.score);
}
```

## Ranking Factors

### Base Score Components

1. **Text Match Quality** (0-1.0)
   - Exact: 1.0
   - Starts with: 0.9
   - Word boundary: 0.8
   - Contains: 0.7
   - Fuzzy (60%+ similar): 0.4-0.6

2. **Field Weight Multipliers**
   - Title: 2.0x
   - Tags: 1.5x
   - URL: 1.0x
   - Notes: 0.8x

3. **Recency Boost**
   ```typescript
   const daysSinceCreated = (Date.now() - page.created) / (1000 * 60 * 60 * 24);
   const recencyBoost = Math.max(0, 1 - (daysSinceCreated / 365)); // Decay over 1 year
   finalScore = baseScore * (1 + recencyBoost * 0.3);
   ```

4. **Frequency Boost** (if tracking access)
   ```typescript
   const accessBoost = Math.log(1 + page.accessCount) * 0.1;
   finalScore = baseScore * (1 + accessBoost);
   ```

## Context-Aware Ranking

### Working Set Detection

Pages in the current task get priority:

```typescript
async function contextAwareSearch(query: string, currentTask?: string): Promise<RankedResult[]> {
  const results = await fuzzySearch(query);

  return results.map(result => ({
    ...result,
    score: result.page.task === currentTask
      ? result.score * 1.5  // Boost current task pages
      : result.score
  })).sort((a, b) => b.score - a.score);
}
```

### Recent Pages Boost

```typescript
const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
if (page.created > recentThreshold) {
  score *= 1.2;
}
```

## Performance Optimization

### Indexed Queries

Use Dexie indexes for common patterns:

```typescript
// Good: Uses index
db.pages.where('tags').anyOf(['ml', 'ai']).toArray();

// Avoid: Full table scan
db.pages.filter(p => p.tags.includes('ml') || p.tags.includes('ai')).toArray();
```

### Pagination

```typescript
async function searchWithPagination(query: string, limit = 20, offset = 0) {
  const results = await fuzzySearch(query);
  return results.slice(offset, offset + limit);
}
```

## Levenshtein Distance

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

## Related Files

- `src/background/search.ts` - Search implementation
- `src/background/omnibox.ts` - Omnibox handler
- `src/background/database.ts` - Dexie schema and indexes
