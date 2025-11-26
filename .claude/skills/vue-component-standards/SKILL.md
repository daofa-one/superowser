# Skill: Vue Component Standards

## Overview

Standards and patterns for Vue 3 components in the Superowser extension.

## Component Structure

### Composition API Pattern

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// Props
interface Props {
  pageId: number;
  tags?: string[];
}
const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  save: [data: PageData];
  close: [];
}>();

// State
const isLoading = ref(false);
const error = ref<string | null>(null);

// Computed
const displayTags = computed(() => props.tags?.join(', ') || 'No tags');

// Methods
async function handleSave() {
  isLoading.value = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PAGE',
      payload: { /* ... */ }
    });
    emit('save', response);
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(async () => {
  // Initialize
});
</script>

<template>
  <div class="component-container">
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Content -->
    </div>
  </div>
</template>

<style scoped>
.component-container {
  /* Scoped styles */
}
</style>
```

## Key Principles

### 1. TypeScript First

- Always use `<script setup lang="ts">`
- Define interfaces for props and emits
- Type all function parameters and returns

### 2. Message Passing

All data operations go through background:

```typescript
// Good: Centralized message handler
async function sendMessage<T>(type: string, payload?: any): Promise<T> {
  return chrome.runtime.sendMessage({ type, payload });
}

const pages = await sendMessage<PageEntry[]>('GET_PAGES', { task: 'research' });
```

### 3. State Management

**No Vuex/Pinia needed** - Background service worker is the source of truth:

```typescript
// Component-local state only
const localFilter = ref('');
const cachedPages = ref<PageEntry[]>([]);

// Fetch from background when needed
async function refreshData() {
  cachedPages.value = await sendMessage('GET_PAGES');
}
```

### 4. Component Organization

```
sidepanel/
├── components/
│   ├── PageCard.vue        # Presentational
│   ├── TagInput.vue        # Reusable input
│   ├── ChatBox.vue         # Feature component
│   └── TaskList.vue        # Feature component
├── composables/
│   ├── useMessages.ts      # Shared message logic
│   ├── useSearch.ts        # Search helpers
│   └── useTags.ts          # Tag management
└── SidePanel.vue           # Root component
```

### 5. Composables for Shared Logic

```typescript
// composables/useMessages.ts
export function useMessages() {
  async function savePage(data: Partial<PageEntry>) {
    return chrome.runtime.sendMessage({
      type: 'SAVE_PAGE',
      payload: data
    });
  }

  async function searchPages(query: string) {
    return chrome.runtime.sendMessage({
      type: 'SEARCH_PAGES',
      payload: { query }
    });
  }

  return { savePage, searchPages };
}

// In component
const { savePage, searchPages } = useMessages();
```

## Styling

### Scoped CSS

Always use scoped styles to avoid conflicts:

```vue
<style scoped>
.page-card {
  /* Only affects this component */
}
</style>
```

### CSS Variables for Theming

```css
:root {
  --color-primary: #3b82f6;
  --color-text: #1f2937;
  --spacing-md: 1rem;
}

.component {
  color: var(--color-text);
  padding: var(--spacing-md);
}
```

## Testing Considerations

- Test component logic in isolation
- Mock `chrome.runtime.sendMessage` in tests
- Use Vue Test Utils for component testing

## Related Files

- `src/sidepanel/` - All Vue components
- `src/types/` - Shared TypeScript interfaces
- `vite.config.ts` - Build configuration
