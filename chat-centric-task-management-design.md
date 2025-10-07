# Chat-Centric Task Management Design

**Date:** 2025-01-23
**Status:** Design Phase
**Goal:** Eliminate dedicated Tasks view and consolidate task management into an enhanced Chat interface with customizable command shortcuts

---

## 🎯 Design Goals

### Primary Objectives
1. **Eliminate the Tasks view** - Consolidate all task management into Chat interface
2. **Rich interactive components** - Task lists/forms as Vue components within chat bubbles
3. **Customizable shortcuts** - User-configurable command buttons above chat input
4. **Leverage existing services** - Use existing `ITaskService` interface without modifications
5. **Unified UX** - Single interface for all task operations (CRUD, filtering, activation)

### User Experience Vision
- **Command-driven workflow** - Natural language + structured commands
- **Progressive disclosure** - Task details appear when needed via commands
- **One-click access** - Common operations available as customizable shortcuts
- **Context-aware** - Smart defaults based on current state (active task, page, etc.)

---

## 🏗️ Technical Architecture

### Component Consolidation Strategy

```
📁 Current State → 📁 Target State
├── views/                    ├── views/
│   ├── Home.vue             │   ├── Home.vue (✅ Keep - current task content)
│   ├── Tasks.vue            │   ├── Chat.vue (🔄 Enhanced - task management)
│   └── Chat.vue             │   └── ~~Tasks.vue~~ (❌ Remove)
├── components/              ├── components/
│   ├── TaskManager.vue      │   ├── task/ (🆕 Reusable components)
│   ├── CurrentTaskList.vue  │   │   ├── TaskList.vue
│   └── ChatBox.vue          │   │   ├── TaskCard.vue
                             │   │   ├── TaskCreator.vue
                             │   │   ├── TaskActions.vue
                             │   │   └── TaskShortcuts.vue
                             │   ├── CurrentTaskList.vue (✅ Keep)
                             │   └── ChatBox.vue (🔄 Enhanced)
```

### Shared Services Architecture

```typescript
// ✅ Use existing interfaces without modification
interface ITaskService {
  getAll(): Promise<TaskEntry[]>
  create(name: string, description?: string): Promise<TaskEntry>
  setActive(id: string): Promise<TaskEntry>
  delete(id: string): Promise<void>
  // ... existing methods
}

// 🆕 Enhanced command responses
interface ComponentResponse extends CommandResponse {
  type: 'task-list' | 'task-card' | 'task-creator' | 'text'
  componentData?: {
    tasks?: TaskEntry[]
    interactive?: boolean
    showCreateForm?: boolean
    filters?: TaskFilters
  }
}
```

---

## 🧩 Component Design

### 1. Enhanced ChatBox Component

```vue
<template>
  <div class="chat-container">
    <!-- Messages with component support -->
    <div class="messages-area">
      <div v-for="bubble in messages" :key="bubble.id" class="chat-bubble">
        <!-- Text responses -->
        <div v-if="bubble.type === 'system-response'" class="message-content">
          {{ bubble.content }}
        </div>

        <!-- Interactive task components -->
        <div v-else-if="bubble.type === 'task-list'" class="component-bubble">
          <TaskList
            :tasks="bubble.componentData.tasks"
            :interactive="bubble.componentData.interactive"
            :filters="bubble.componentData.filters"
            @task-activated="handleTaskActivation"
            @task-created="handleTaskCreation"
            @task-deleted="handleTaskDeletion"
          />
        </div>

        <div v-else-if="bubble.type === 'task-creator'" class="component-bubble">
          <TaskCreator
            @task-created="handleTaskCreation"
            @cancelled="handleCreationCancelled"
          />
        </div>
      </div>
    </div>

    <!-- 🆕 Customizable command shortcuts -->
    <TaskShortcuts
      :shortcuts="userShortcuts"
      @shortcut-executed="executeShortcut"
      @customize="openShortcutCustomizer"
    />

    <!-- Enhanced input with command suggestions -->
    <div class="chat-input-area">
      <textarea
        v-model="inputValue"
        @keydown="handleKeydown"
        placeholder="Type a command or message..."
      />
      <!-- Command suggestions dropdown -->
      <CommandSuggestions
        v-if="showSuggestions"
        :suggestions="suggestions"
        :highlighted="highlightedIndex"
        @select="selectSuggestion"
      />
    </div>
  </div>
</template>
```

### 2. Reusable Task Components

#### TaskList.vue
```vue
<template>
  <div class="task-list">
    <div class="task-list-header">
      <h3>{{ title }}</h3>
      <div class="task-stats">{{ tasks.length }} tasks</div>
    </div>

    <!-- Filtering (if interactive) -->
    <div v-if="interactive && showFilters" class="task-filters">
      <input
        v-model="filterQuery"
        placeholder="Filter tasks..."
        class="filter-input"
      />
      <select v-model="statusFilter" class="status-filter">
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <!-- Task grid/list -->
    <div class="tasks-grid">
      <TaskCard
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        :interactive="interactive"
        :compact="compact"
        @activated="$emit('task-activated', task)"
        @deleted="$emit('task-deleted', task)"
      />
    </div>

    <!-- Create new task -->
    <button v-if="interactive" class="create-task-btn" @click="$emit('create-requested')">
      + New Task
    </button>
  </div>
</template>
```

#### TaskCard.vue
```vue
<template>
  <div class="task-card" :class="{ active: task.isActive, compact }">
    <div class="task-info">
      <h4 class="task-name">{{ task.name }}</h4>
      <p v-if="task.description && !compact" class="task-description">
        {{ task.description }}
      </p>
      <div class="task-meta">
        <span class="page-count">{{ task.pageCount || 0 }} pages</span>
        <span class="note-count">{{ task.noteCount || 0 }} notes</span>
        <span v-if="task.isActive" class="active-badge">Active</span>
      </div>
    </div>

    <div v-if="interactive" class="task-actions">
      <button
        v-if="!task.isActive"
        class="btn-activate"
        @click="$emit('activated', task)"
      >
        Activate
      </button>
      <button
        class="btn-delete"
        @click="$emit('deleted', task)"
      >
        Delete
      </button>
    </div>
  </div>
</template>
```

---

## 🔁 Command Flow Updates

### Task Command Integration
- `/tasks` returns both text summary and `task-list` component when used in chat.
- `/newtask` with no name returns `task-creator` component for inline creation.
- `/settask` updates chat history with confirmation bubble.

### Component Event Handling
- Task components emit events (`task-activated`, `task-deleted`, etc.) handled by ChatBox.
- ChatBox dispatches corresponding commands to background via messaging layer.
- Responses are added to chat history as structured entries with `componentData`.

---

## 🤖 Command Templates & Responses

### `/tasks` response (chat)
```
> /tasks --search="project"

Found 3 task(s) matching "project"

[TaskList component rendered]
```

### `/newtask` response (chat)
```
> /newtask

Create a new task

[TaskCreator component rendered]
```

### `/settask` response
```
> /settask "Project Alpha"

✅ Switched to task: Project Alpha
```

---

## 🗺️ Example Conversation Flow

```
User: /tasks --status=active
System:
  - "4 active tasks"
  - [TaskList component]
User: /newtask "Launch Plan" --description="Q3 launch checkpoints"
System: "✅ Created task: Launch Plan (now active)"
User: /tasks --search=launch
System:
  - "Found 1 task matching launch"
  - [TaskList component filtered]
```

---

## 🧪 Testing Considerations
- Unit tests for TaskList, TaskCard, TaskCreator components
- Command integration tests for `/tasks`, `/newtask`, `/settask`
- Snapshot tests for chat bubbles with component rendering
- Ensure chat history persistence includes component metadata

---

## 🛠️ Tooling & Dependencies
- Vue 3 + script setup + Composition API for components
- Pinia store for shared chat/task state
- Existing messaging utilities for command dispatch
- Optional: Vue Draggable for future shortcut customization

---

## 💬 Future Enhancements
- Drag-and-drop reordering of task cards within chat
- Task grouping by tags or project within chat bubble
- Inline note linking while viewing task cards
- Smart reminders when tasks have stale updates

---

## 📈 Metrics & Success Criteria
- Reduction in navigation events to Tasks view (>70%)
- Increase in `/tasks` command usage (baseline +25%)
- Task creation via chat vs modal (>50%)
- User feedback on “single interface” satisfaction

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] **Enhance ChatBox component structure**
  - Support for component bubbles
  - Message type routing
  - Component event handling
- [ ] **Create base reusable components**
  - TaskList.vue (basic version)
  - TaskCard.vue (basic version)
  - TaskShortcuts.vue (static shortcuts)
- [ ] **Update task commands**
  - Modify `/tasks` to return component data
  - Test component rendering in chat

### Phase 2: Rich Interactions (Week 3-4)
- [ ] **Complete task component features**
  - Interactive task cards with actions
  - Inline task creation
  - Task filtering and search
  - Task activation from chat
- [ ] **Enhanced command responses**
  - Component-based `/newtask`
  - Component-based `/search` for tasks
  - Error handling for component commands

### Phase 3: Customization (Week 5-6)
- [ ] **Customizable shortcuts**
  - Options page integration
  - User shortcut management
  - Drag & drop reordering
  - Custom shortcut creation
- [ ] **Advanced features**
  - Context-aware shortcuts
  - Keyboard shortcuts
  - Shortcut categories/grouping
  - Import/export shortcut configs

### Phase 4: Polish & Optimization (Week 7-8)
- [ ] **Performance optimization**
  - Component lazy loading
  - Virtual scrolling for large task lists
  - Debounced search/filtering
- [ ] **Advanced UX features**
  - Command autocomplete improvements
  - Smart command suggestions
  - Undo/redo for task operations
  - Bulk task operations
- [ ] **Testing & documentation**
  - Component unit tests
  - E2E workflow tests
  - User documentation
  - Migration guide

### Phase 5: Clean up
- [ ] **Remove Tasks view**
  - Remove Tasks.vue and TaskManager.vue
  - Update navigation
  - Ensure all functionality works in Chat

---

## 🎨 Visual Design
- Light/dark mode-compatible components
- Consistent spacing & typography with design system
- Chat bubbles adapt height based on component content
- Shortcut bar mirrors command palette styling

## 🔐 Security & Permissions
- Continue using background service worker for privileged operations
- Chat interface acts as controller; no direct DB access
- Commands validated server-side before execution
- Shortcut customization stored in user settings (persisted via Dexie)

## 📦 Deliverables
- Updated ChatBox.vue with component rendering
- New task components under `components/task/`
- Updated command implementations (task commands)
- Shared types for component data responses
- Documentation on new chat-centric workflow

