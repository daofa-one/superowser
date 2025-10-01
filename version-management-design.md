# Version Management System Design

## Enhanced DocumentVersionEntry Schema

```typescript
export interface DocumentVersionEntry {
  id: string
  documentId: string
  parentVersionId?: string
  title?: string
  summary?: string
  content: string
  createdAt: Date
  createdBy: 'user' | 'ai' | 'import'

  // NEW: Version Management Fields
  alias?: string                    // User-friendly name ("Final Draft", "Review v2")
  tags?: VersionTag[]              // Semantic labels for workflow states
  isProtected?: boolean            // Prevent auto-pruning
  milestone?: boolean              // Mark as significant save point
  note?: string                    // Extended description/comments
  contentHash?: string             // Quick diff detection
  size?: number                    // Content length for pruning decisions

  sources?: Array<{
    noteId?: string
    pageId?: string
    snippet?: string
  }>
}

export type VersionTag =
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'checkpoint'
  | 'backup'
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal: Basic aliasing and pruning**

#### 1.1 Schema Migration
- Add optional fields to DocumentVersionEntry
- Create migration script for existing versions
- Update Dexie repository methods

#### 1.2 Backend Services
```typescript
// New methods in DocumentVersionService
updateVersionMetadata(versionId: string, updates: {
  alias?: string
  tags?: VersionTag[]
  isProtected?: boolean
  note?: string
}): Promise<DocumentVersionEntry>

bulkDeleteVersions(
  documentId: string,
  criteria: {
    keepLast?: number
    beforeDate?: Date
    excludeProtected?: boolean
    excludeTags?: VersionTag[]
  }
): Promise<number> // returns count deleted

getVersionsByTags(documentId: string, tags: VersionTag[]): Promise<DocumentVersionEntry[]>
```

#### 1.3 Basic UI Components
- Version item context menu (rename, tag, protect, delete)
- Bulk operations toolbar
- Simple tag filtering

### Phase 2: Advanced Features (Week 2)
**Goal: Diff comparison and smart operations**

#### 2.1 Diff/Compare System
```typescript
interface VersionComparison {
  left: DocumentVersionEntry
  right: DocumentVersionEntry
  changes: {
    additions: number
    deletions: number
    modifications: number
  }
  diff: string // Monaco diff model compatible
}

compareVersions(leftId: string, rightId: string): Promise<VersionComparison>
```

#### 2.2 Smart Auto-Save
```typescript
interface AutoSaveHeuristics {
  significantChangeThreshold: number // % content change
  idleTimeThreshold: number // ms since last edit
  forceSaveKeywords: string[] // trigger words like "SAVE:", "TODO:"
}

shouldCreateMilestone(
  previousContent: string,
  currentContent: string,
  timeSinceLastSave: number,
  heuristics: AutoSaveHeuristics
): boolean
```

#### 2.3 Enhanced UI
- Monaco diff editor modal
- Version timeline visualization
- Advanced filtering (date ranges, content search)

### Phase 3: Export & Collaboration (Week 3)
**Goal: Sharing and workflow integration**

#### 3.1 Version Export
```typescript
exportVersion(
  versionId: string,
  format: 'markdown' | 'pdf' | 'html',
  options: {
    includeMetadata?: boolean
    customTemplate?: string
  }
): Promise<Blob>
```

#### 3.2 Batch Operations UI
- "Keep last N versions" with preview
- "Archive old drafts" workflow
- "Export milestone versions" bulk action

## UI/UX Design Patterns

### Version History Panel
```
┌─ Document Versions ─────────────────┐
│ 🔍 Search: [___] 🏷️ Tags: [All▼]    │
│ ⚙️ Bulk: Keep 25▼ 🗑️ Clean Old     │
├─────────────────────────────────────┤
│ 📍 Final Draft v2 · approved · 2h   │
│    User saved · Protected · 1.2KB   │
│    [⚡Diff] [📋Copy] [⭐Protect] [⋯] │
├─────────────────────────────────────┤
│ 📝 Working copy · draft · 15min     │
│    Auto-save · 1.1KB               │
│    [⚡Diff] [📋Copy] [🏷️Tag] [⋯]    │
├─────────────────────────────────────┤
│ 📍 Review v1 · review · 1 day       │
│    User saved · Protected · 1.0KB   │
│    [⚡Diff] [📋Copy] [⭐Protect] [⋯] │
└─────────────────────────────────────┘
```

### Context Menu Actions
- 🏷️ **Add Tag** → Quick tag selector (draft/review/approved)
- ✏️ **Rename** → Inline edit for alias field
- 📝 **Add Note** → Textarea for extended description
- ⭐ **Protect** → Toggle isProtected flag
- ⚡ **Compare with Current** → Open diff modal
- 📋 **Duplicate as New** → Create copy in new document
- 🗑️ **Delete** → Confirm deletion (blocked if protected)

### Bulk Operations Toolbar
- **Keep Last N**: Smart pruning with preview
- **Clean Drafts**: Remove untagged auto-saves older than X days
- **Archive Old**: Move versions older than date to archive status
- **Export Tagged**: Bulk export all versions with specific tags

## User Settings Integration

### Version Management Settings Schema
```typescript
interface VersionManagementSettings {
  // Auto-Save Configuration
  autoSaveInterval: 30 | 60 | 120 | 300 | 0 // seconds, 0 = manual only
  createMilestones: boolean
  milestoneIdleTime: 300 | 900 | 1800 // seconds (5min, 15min, 30min)
  significantChangeThreshold: 0.1 | 0.25 | 0.5 // percentage of content change

  // Storage Management
  maxVersionsPerDocument: 25 | 50 | 100 | -1 // -1 = unlimited
  autoCleanup: boolean
  keepVersionsDays: 7 | 30 | 90 | -1 // -1 = forever
  protectUserSaves: boolean // auto-protect manual saves

  // UI Preferences
  defaultView: 'recent' | 'all' | 'tagged'
  showSizes: boolean
  groupByDay: boolean
  enableAnimations: boolean

  // Advanced Features
  enableHashing: boolean
  autoTagDrafts: boolean
  defaultTags: string[]
  enableCompression: boolean
  lazyLoadContent: boolean
}

// Default settings profiles
const VERSION_MANAGEMENT_DEFAULTS = {
  conservative: {
    autoSaveInterval: 120,
    createMilestones: true,
    milestoneIdleTime: 900,
    significantChangeThreshold: 0.25,
    maxVersionsPerDocument: 50,
    autoCleanup: true,
    keepVersionsDays: 30,
    protectUserSaves: true,
    defaultView: 'recent',
    showSizes: false,
    groupByDay: true,
    enableAnimations: true,
    enableHashing: true,
    autoTagDrafts: true,
    defaultTags: ['draft', 'review', 'final'],
    enableCompression: false,
    lazyLoadContent: true
  },
  powerUser: {
    autoSaveInterval: 30,
    createMilestones: true,
    milestoneIdleTime: 300,
    significantChangeThreshold: 0.1,
    maxVersionsPerDocument: 100,
    autoCleanup: false,
    keepVersionsDays: 90,
    protectUserSaves: true,
    defaultView: 'all',
    showSizes: true,
    groupByDay: false,
    enableAnimations: true,
    enableHashing: true,
    autoTagDrafts: true,
    defaultTags: ['draft', 'review', 'approved', 'published', 'checkpoint'],
    enableCompression: true,
    lazyLoadContent: false
  },
  minimal: {
    autoSaveInterval: 300,
    createMilestones: false,
    milestoneIdleTime: 1800,
    significantChangeThreshold: 0.5,
    maxVersionsPerDocument: 25,
    autoCleanup: true,
    keepVersionsDays: 7,
    protectUserSaves: false,
    defaultView: 'recent',
    showSizes: false,
    groupByDay: true,
    enableAnimations: false,
    enableHashing: false,
    autoTagDrafts: false,
    defaultTags: ['draft'],
    enableCompression: false,
    lazyLoadContent: true
  }
} as const
```

### Options Page Implementation

#### Version Management Section UI
```vue
<template>
  <div class="version-management-settings">
    <div class="settings-header">
      <h3>📝 Version Management</h3>
      <div class="profile-selector">
        <label>Quick Setup:</label>
        <select v-model="selectedProfile" @change="applyProfile">
          <option value="">Custom</option>
          <option value="conservative">Balanced (Recommended)</option>
          <option value="powerUser">Power User</option>
          <option value="minimal">Minimal</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>💾 Auto-Save Behavior</h4>
      <div class="setting-row">
        <label>Save interval:</label>
        <select v-model="settings.autoSaveInterval">
          <option :value="0">Manual only</option>
          <option :value="30">30 seconds</option>
          <option :value="60">1 minute</option>
          <option :value="120">2 minutes</option>
          <option :value="300">5 minutes</option>
        </select>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.createMilestones">
          Create milestones after idle time
        </label>
      </div>

      <div class="setting-row" v-if="settings.createMilestones">
        <label>Milestone trigger:</label>
        <select v-model="settings.milestoneIdleTime">
          <option :value="300">5 minutes</option>
          <option :value="900">15 minutes</option>
          <option :value="1800">30 minutes</option>
        </select>
      </div>

      <div class="setting-row">
        <label>Significant change threshold:</label>
        <select v-model="settings.significantChangeThreshold">
          <option :value="0.1">10% content change</option>
          <option :value="0.25">25% content change</option>
          <option :value="0.5">50% content change</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>🗄️ Storage Management</h4>
      <div class="setting-row">
        <label>Max versions per document:</label>
        <select v-model="settings.maxVersionsPerDocument">
          <option :value="25">25 versions</option>
          <option :value="50">50 versions</option>
          <option :value="100">100 versions</option>
          <option :value="-1">Unlimited</option>
        </select>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.autoCleanup">
          Auto-cleanup old versions
        </label>
      </div>

      <div class="setting-row" v-if="settings.autoCleanup">
        <label>Keep versions for:</label>
        <select v-model="settings.keepVersionsDays">
          <option :value="7">7 days</option>
          <option :value="30">30 days</option>
          <option :value="90">90 days</option>
          <option :value="-1">Forever</option>
        </select>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.protectUserSaves">
          Always protect manual saves
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h4>🎨 Display Options</h4>
      <div class="setting-row">
        <label>Default view:</label>
        <select v-model="settings.defaultView">
          <option value="recent">Recent only</option>
          <option value="all">All versions</option>
          <option value="tagged">Tagged only</option>
        </select>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.showSizes">
          Show version file sizes
        </label>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.groupByDay">
          Group versions by day
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h4>⚙️ Advanced</h4>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.enableHashing">
          Enable content deduplication
        </label>
        <small>Prevents saving identical versions</small>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.autoTagDrafts">
          Auto-tag draft versions
        </label>
      </div>

      <div class="setting-row">
        <label>Default tags:</label>
        <div class="tag-editor">
          <span v-for="tag in settings.defaultTags" :key="tag" class="tag">
            {{ tag }}
            <button @click="removeTag(tag)">×</button>
          </span>
          <input
            v-model="newTag"
            @keydown.enter="addTag"
            placeholder="Add tag..."
            class="tag-input"
          >
        </div>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="settings.enableCompression">
          Compress large versions (>5KB)
        </label>
      </div>
    </div>

    <div class="settings-actions">
      <button @click="resetToDefaults" class="secondary">Reset to Defaults</button>
      <button @click="saveSettings" class="primary">Save Changes</button>
    </div>

    <div class="storage-impact" v-if="storageEstimate">
      <h4>💽 Storage Impact</h4>
      <p>Current settings will use approximately <strong>{{ storageEstimate.size }}</strong>
         for {{ storageEstimate.documents }} documents with {{ storageEstimate.versions }} versions.</p>
      <div class="recommendation" v-if="storageEstimate.recommendation">
        💡 {{ storageEstimate.recommendation }}
      </div>
    </div>
  </div>
</template>
```

#### Settings Integration with Backend
```typescript
// Extend existing UserSettings interface
interface UserSettings {
  preferredSearchEngine: string
  preferredAiProvider: string
  reuseAiTab: boolean

  // NEW: Version Management Settings
  versionManagement: VersionManagementSettings
}

// Update background store
class BackgroundStore {
  async updateVersionManagementSettings(
    settings: Partial<VersionManagementSettings>
  ): Promise<void> {
    this.user.settings.versionManagement = {
      ...this.user.settings.versionManagement,
      ...settings
    }
    await this.persistUserData()

    // Trigger auto-cleanup if settings changed
    if (settings.autoCleanup !== undefined || settings.maxVersionsPerDocument !== undefined) {
      await this.triggerVersionCleanup()
    }
  }

  private async triggerVersionCleanup(): Promise<void> {
    const settings = this.user.settings.versionManagement
    if (!settings.autoCleanup) return

    // Run cleanup for all documents
    const documents = await container.documentsUseCases.listAllDocuments()
    for (const doc of documents) {
      await container.documentsUseCases.cleanupVersions(doc.id, {
        keepLast: settings.maxVersionsPerDocument,
        beforeDate: settings.keepVersionsDays > 0
          ? new Date(Date.now() - settings.keepVersionsDays * 24 * 60 * 60 * 1000)
          : undefined,
        excludeProtected: true
      })
    }
  }
}
```

#### Settings Validation and Recommendations
```typescript
interface StorageEstimate {
  size: string // "2.5 MB"
  documents: number
  versions: number
  recommendation?: string
}

function calculateStorageEstimate(
  settings: VersionManagementSettings,
  currentUsage: {
    documentCount: number
    averageVersionsPerDoc: number
    averageVersionSize: number
  }
): StorageEstimate {
  const estimatedVersions = Math.min(
    currentUsage.averageVersionsPerDoc,
    settings.maxVersionsPerDocument > 0 ? settings.maxVersionsPerDocument : 100
  )

  const totalVersions = currentUsage.documentCount * estimatedVersions
  const estimatedSize = totalVersions * currentUsage.averageVersionSize

  const sizeFormatted = formatBytes(estimatedSize)

  let recommendation
  if (estimatedSize > 50 * 1024 * 1024) { // >50MB
    recommendation = "Consider reducing max versions or enabling compression for large storage."
  } else if (settings.autoSaveInterval < 60 && !settings.autoCleanup) {
    recommendation = "Frequent auto-saves without cleanup may accumulate many versions."
  }

  return {
    size: sizeFormatted,
    documents: currentUsage.documentCount,
    versions: totalVersions,
    recommendation
  }
}
```

## Database Schema Updates

### Migration Strategy
```typescript
// Version 4 Migration
async function migrateToVersionManagement() {
  const versions = await db.documentVersions.toArray()

  for (const version of versions) {
    const size = version.content?.length || 0
    const contentHash = await generateHash(version.content)

    await db.documentVersions.update(version.id, {
      size,
      contentHash,
      isProtected: false,
      milestone: false,
      tags: [], // Start with empty tags
    })
  }
}
```

### Performance Considerations
- **Indexing**: Add indexes on `tags`, `isProtected`, `createdAt`
- **Lazy Loading**: Load version content only when needed
- **Compression**: Consider LZ-string for storing large content
- **Pagination**: Implement cursor-based pagination for large version lists

## Integration Points

### With Existing Systems
1. **Auto-save**: Enhance to respect milestone heuristics
2. **Command Palette**: Add version management commands
3. **Export System**: Extend to support version-specific exports
4. **Search**: Include version aliases and notes in search

### Future Collaboration Features
1. **User Attribution**: Extend `createdBy` for multi-user scenarios
2. **Comments**: Version-level collaborative comments
3. **Approvals**: Workflow states with reviewer assignments
4. **Branching**: Support for parallel version branches

## Success Metrics

### Phase 1 Success Criteria
- [ ] Users can rename versions with meaningful aliases
- [ ] Bulk pruning reduces storage by 30%+ for heavy users
- [ ] Version tagging improves workflow organization
- [ ] Zero performance regression on save operations

### Phase 2 Success Criteria
- [ ] Diff comparison helps users understand changes
- [ ] Smart auto-save reduces manual save frequency
- [ ] Advanced filtering improves version navigation
- [ ] Milestone detection accurately identifies significant saves

### Phase 3 Success Criteria
- [ ] Version export supports common workflows
- [ ] Batch operations reduce version management overhead
- [ ] System scales to 100+ versions per document
- [ ] User adoption of version management features >60%

## Technical Implementation Notes

### Monaco Diff Integration
```typescript
// Diff modal component
const diffEditor = monaco.editor.createDiffEditor(container, {
  enableSplitViewResizing: false,
  renderSideBySide: true,
  readOnly: true,
  originalEditable: false,
  modifiedEditable: false
})

diffEditor.setModel({
  original: monaco.editor.createModel(leftVersion.content, 'markdown'),
  modified: monaco.editor.createModel(rightVersion.content, 'markdown')
})
```

### Content Hashing
```typescript
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) // First 16 chars for storage efficiency
}
```

### Smart Pruning Algorithm
```typescript
function calculatePruningScore(version: DocumentVersionEntry): number {
  let score = 0

  // Protect recent versions
  const ageInDays = (Date.now() - version.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (ageInDays < 7) score += 100

  // Protect tagged/aliased versions
  if (version.alias || version.tags?.length) score += 50
  if (version.isProtected) score += 1000
  if (version.milestone) score += 200

  // Protect larger changes
  if (version.size && version.size > 1000) score += 20

  // Protect user-created over auto-saves
  if (version.createdBy === 'user') score += 30

  return score
}
```