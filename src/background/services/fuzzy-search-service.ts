// Fuzzy search service using Fuse.js for better search relevance

import Fuse from 'fuse.js'
import type { PageEntry, NoteEntry, TaskEntry } from '../../shared/models'

type FuseResultMatch = Fuse.FuseResultMatch

export class FuzzySearchService {
  private pageIndex: Fuse<PageEntry>
  private noteIndex: Fuse<NoteEntry>
  private taskIndex: Fuse<TaskEntry>

  constructor() {
    // Configure Fuse.js for pages - search across multiple fields
    this.pageIndex = new Fuse<PageEntry>([], {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'url', weight: 0.2 },
        { name: 'shortcut', weight: 0.3 },
        { name: 'tags', weight: 0.1 }
      ],
      threshold: 0.4,           // 0 = perfect match, 1 = match anything
      distance: 100,            // Max character distance for matches
      includeScore: true,       // Include relevance scores
      includeMatches: true,     // Include match positions for highlighting
      shouldSort: true,         // Sort by relevance
      ignoreLocation: true,     // Don't penalize matches far from start
      useExtendedSearch: true   // Enable exact word search with quotes
    })

    // Configure Fuse.js for notes - focus on content and comments
    this.noteIndex = new Fuse<NoteEntry>([], {
      keys: [
        { name: 'content', weight: 0.6 },
        { name: 'comment', weight: 0.3 },
        { name: 'tasks', weight: 0.1 }
      ],
      threshold: 0.5,           // Slightly more lenient for notes
      distance: 200,            // Notes can be longer
      includeScore: true,
      includeMatches: true,
      shouldSort: true,
      ignoreLocation: true,
      useExtendedSearch: true
    })

    // Configure Fuse.js for tasks - simple name and description search
    this.taskIndex = new Fuse<TaskEntry>([], {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'description', weight: 0.3 }
      ],
      threshold: 0.3,           // Stricter for task names
      distance: 50,             // Task names are typically short
      includeScore: true,
      includeMatches: true,
      shouldSort: true,
      ignoreLocation: true,
      useExtendedSearch: true
    })
  }

  /**
   * Update the page index with new data
   */
  updatePageIndex(pages: PageEntry[]): void {
    this.pageIndex.setCollection(pages)
  }

  /**
   * Update the note index with new data
   */
  updateNoteIndex(notes: NoteEntry[]): void {
    this.noteIndex.setCollection(notes)
  }

  /**
   * Update the task index with new data
   */
  updateTaskIndex(tasks: TaskEntry[]): void {
    this.taskIndex.setCollection(tasks)
  }

  /**
   * Search pages with fuzzy matching
   */
  searchPages(query: string, limit = 10): Array<{ page: PageEntry; score: number; matches?: FuseResultMatch[] }> {
    const results = this.pageIndex.search(query, { limit })
    return results.map(result => ({
      page: result.item,
      score: result.score || 0,
      matches: result.matches ? [...result.matches] : undefined
    }))
  }

  /**
   * Search notes with fuzzy matching
   */
  searchNotes(query: string, limit = 10): Array<{ note: NoteEntry; score: number; matches?: FuseResultMatch[] }> {
    const results = this.noteIndex.search(query, { limit })
    return results.map(result => ({
      note: result.item,
      score: result.score || 0,
      matches: result.matches ? [...result.matches] : undefined
    }))
  }

  /**
   * Search tasks with fuzzy matching
   */
  searchTasks(query: string, limit = 10): Array<{ task: TaskEntry; score: number; matches?: FuseResultMatch[] }> {
    const results = this.taskIndex.search(query, { limit })
    return results.map(result => ({
      task: result.item,
      score: result.score || 0,
      matches: result.matches ? [...result.matches] : undefined
    }))
  }

  /**
   * Search shortcuts specifically (pages with shortcuts)
   */
  searchShortcuts(query: string, limit = 5): Array<{ shortcut: string; page: PageEntry; score: number }> {
    // Use exact shortcut matching for @ queries
    const exactQuery = query.startsWith('@') ? query.slice(1) : query

    const results = this.pageIndex.search(exactQuery, { limit: limit * 2 })
      .filter(result => result.item.shortcut) // Only pages with shortcuts
      .slice(0, limit) // Apply limit after filtering

    return results.map(result => ({
      shortcut: result.item.shortcut!,
      page: result.item,
      score: result.score || 0
    }))
  }

  /**
   * Search for tags with fuzzy matching
   */
  searchTags(query: string, allPages: PageEntry[], limit = 5): Array<{ tag: string; pages: PageEntry[]; score: number }> {
    // Extract all unique tags from pages
    const tagMap = new Map<string, PageEntry[]>()

    allPages.forEach(page => {
      page.tags.forEach(tag => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, [])
        }
        tagMap.get(tag)!.push(page)
      })
    })

    // Create a simple fuse instance for tag names
    const tagFuse = new Fuse(Array.from(tagMap.keys()), {
      threshold: 0.4,
      includeScore: true,
      shouldSort: true
    })

    const tagQuery = query.startsWith('#') ? query.slice(1) : query
    const results = tagFuse.search(tagQuery, { limit })

    return results.map(result => ({
      tag: result.item,
      pages: tagMap.get(result.item) || [],
      score: result.score || 0
    }))
  }

  /**
   * Get search statistics for debugging
   */
  getIndexStats(): { pages: number; notes: number; tasks: number } {
    // Note: Fuse.js doesn't expose collection size directly, so we estimate based on search results
    const testResults = {
      pages: this.pageIndex.search('', { limit: 9999 }).length,
      notes: this.noteIndex.search('', { limit: 9999 }).length,
      tasks: this.taskIndex.search('', { limit: 9999 }).length
    }
    return testResults
  }
}