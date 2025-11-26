# Search Algorithm Examples

## Example 1: Basic Fuzzy Match

```typescript
const query = "ml";
const candidates = [
  "Machine Learning Blog",
  "My Learning Notes",
  "Email Client"
];

candidates.forEach(text => {
  const score = fuzzyMatch(query, text);
  console.log(`"${text}": ${score}`);
});

// Output:
// "Machine Learning Blog": 0.9 (starts with 'M' + contains 'L')
// "My Learning Notes": 0.8 (word boundary match on 'L')
// "Email Client": 0.0 (no match)
```

## Example 2: Ranked Search Results

```typescript
const query = "attention paper";
const pages = [
  {
    id: 1,
    title: "Attention Is All You Need",
    tags: ["ml", "paper", "transformer"],
    url: "arxiv.org/abs/1706.03762"
  },
  {
    id: 2,
    title: "Self-Attention Networks",
    tags: ["ml", "paper"],
    url: "example.com/self-attention"
  },
  {
    id: 3,
    title: "Research Papers Archive",
    tags: ["paper", "archive"],
    url: "example.com/papers"
  }
];

const results = fuzzySearch("attention paper", pages);
// Results ranked by relevance:
// 1. "Attention Is All You Need" (score: 1.8)
// 2. "Self-Attention Networks" (score: 1.5)
// 3. "Research Papers Archive" (score: 0.7)
```

## Example 3: Context-Aware Ranking

```typescript
const currentTask = "ml-research";
const query = "transformer";

const pages = [
  { title: "Transformer Architecture", task: "ml-research" },
  { title: "Data Transformer Tool", task: "data-eng" },
  { title: "Electrical Transformers", task: null }
];

// Without context boost:
// 1. "Transformer Architecture" (score: 1.0)
// 2. "Data Transformer Tool" (score: 1.0)
// 3. "Electrical Transformers" (score: 1.0)

// With context boost (1.5x for current task):
// 1. "Transformer Architecture" (score: 1.5)
// 2. "Data Transformer Tool" (score: 1.0)
// 3. "Electrical Transformers" (score: 1.0)
```

## Example 4: Tag-Based Search with Ranking

```typescript
const tags = ["ml", "paper"];
const pages = [
  { title: "Attention Paper", tags: ["ml", "paper", "nlp"] },     // 2 matches
  { title: "ML Resources", tags: ["ml", "tutorial"] },            // 1 match
  { title: "Research Notes", tags: ["paper", "notes"] },          // 1 match
  { title: "JavaScript Tutorial", tags: ["js", "tutorial"] }      // 0 matches
];

const results = findByTags(tags, pages);
// Ranked by number of matching tags:
// 1. "Attention Paper" (2 tags match)
// 2. "ML Resources" (1 tag matches)
// 3. "Research Notes" (1 tag matches)
```

## Example 5: Levenshtein Distance for Typo Tolerance

```typescript
const shortcuts = ["gmail", "docs", "calendar", "ml-blog"];
const query = "mlblog"; // User typo (missing hyphen)

shortcuts.forEach(shortcut => {
  const distance = levenshteinDistance(query, shortcut);
  const similarity = 1 - (distance / Math.max(query.length, shortcut.length));
  console.log(`${shortcut}: distance=${distance}, similarity=${similarity.toFixed(2)}`);
});

// Output:
// gmail: distance=6, similarity=0.14
// docs: distance=6, similarity=0.14
// calendar: distance=8, similarity=0.00
// ml-blog: distance=1, similarity=0.86  ← Close match despite typo!
```

## Example 6: Multi-Field Search

```typescript
interface PageEntry {
  title: string;
  url: string;
  tags: string[];
  notes?: string;
}

function multiFieldSearch(query: string, page: PageEntry): number {
  const titleScore = fuzzyMatch(query, page.title) * 2.0;    // Weight: 2.0
  const urlScore = fuzzyMatch(query, page.url) * 1.0;        // Weight: 1.0
  const tagScores = page.tags.map(tag =>
    fuzzyMatch(query, tag) * 1.5                             // Weight: 1.5
  );
  const maxTagScore = Math.max(0, ...tagScores);
  const notesScore = page.notes
    ? fuzzyMatch(query, page.notes) * 0.8                    // Weight: 0.8
    : 0;

  return Math.max(titleScore, urlScore, maxTagScore, notesScore);
}

const page = {
  title: "Machine Learning Basics",
  url: "example.com/ml-tutorial",
  tags: ["ml", "tutorial", "beginner"],
  notes: "Great intro to ML concepts"
};

const score = multiFieldSearch("ml", page);
// Highest score comes from tags ("ml" exact match) × 1.5 = 1.5
```

## Example 7: Pagination with Search

```typescript
async function searchWithPagination(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ results: RankedResult[], total: number }> {
  // Get all results
  const allResults = await fuzzySearch(query);

  // Calculate pagination
  const offset = (page - 1) * pageSize;
  const paginatedResults = allResults.slice(offset, offset + pageSize);

  return {
    results: paginatedResults,
    total: allResults.length
  };
}

// Usage:
const { results, total } = await searchWithPagination("ml", 1, 10);
console.log(`Showing ${results.length} of ${total} results`);
```

## Performance Tips

1. **Use Dexie indexes for exact matches**
   ```typescript
   // Good: Uses index
   db.pages.where('tags').equals('ml').toArray();

   // Slow: Full table scan
   db.pages.filter(p => p.tags.includes('ml')).toArray();
   ```

2. **Debounce search input**
   ```typescript
   let searchTimeout: number;
   input.addEventListener('input', (e) => {
     clearTimeout(searchTimeout);
     searchTimeout = setTimeout(() => {
       performSearch(e.target.value);
     }, 200); // Wait 200ms after last keystroke
   });
   ```

3. **Limit result count**
   ```typescript
   // Only process top 100, then slice to top 20 for display
   const topResults = fuzzySearch(query)
     .slice(0, 100)
     .sort((a, b) => b.score - a.score)
     .slice(0, 20);
   ```
