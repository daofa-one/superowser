<template>
  <div class="command-shortcuts">
    <button
      v-for="shortcut in visibleShortcuts"
      :key="shortcut.id"
      class="shortcut-btn"
      :class="{ 'context-active': shortcut.contextActive }"
      :title="shortcut.description || shortcut.command"
      @click="executeShortcut(shortcut)"
    >
      <span class="shortcut-icon">{{ shortcut.icon }}</span>
      <span class="shortcut-label">{{ shortcut.label }}</span>
    </button>

    <!-- Customize button -->
    <button class="shortcut-btn shortcut-customize" @click="$emit('customize')">
      <span class="shortcut-icon">⚙️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatShortcut } from './shortcuts-config'

interface Props {
  shortcuts: ChatShortcut[]
  maxVisible?: number
}

interface Emits {
  (e: 'shortcut-executed', shortcut: ChatShortcut): void
  (e: 'customize'): void
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 6
})

const emit = defineEmits<Emits>()

// Only show enabled shortcuts, sorted by position
const visibleShortcuts = computed(() => {
  return props.shortcuts
    .filter(shortcut => shortcut.enabled)
    .sort((a, b) => a.position - b.position)
    .slice(0, props.maxVisible)
})

const executeShortcut = (shortcut: ChatShortcut) => {
  emit('shortcut-executed', shortcut)
}
</script>

<style scoped>
.command-shortcuts {
  display: flex;
  gap: 4px;
  padding: 4px 0 0 0;
  background: transparent;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* Hide scrollbar for Webkit browsers */
.command-shortcuts::-webkit-scrollbar {
  display: none;
}

.shortcut-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.shortcut-btn:hover {
  border-color: #3b82f6;
  background: #f0f6ff;
  color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.shortcut-btn.context-active {
  border-color: #10b981;
  background: #ecfdf5;
  color: #10b981;
}

.shortcut-customize {
  border-color: #d1d5db;
  background: #f9fafb;
  color: #6b7280;
}

.shortcut-customize:hover {
  border-color: #9ca3af;
  background: #f3f4f6;
  color: #4b5563;
}

.shortcut-icon {
  font-size: 14px;
  line-height: 1;
}

.shortcut-label {
  font-size: 11px;
  line-height: 1;
}

/* Compact view for smaller screens */
@media (max-width: 400px) {
  .shortcut-label {
    display: none;
  }

  .shortcut-btn {
    padding: 8px;
    min-width: 32px;
    justify-content: center;
  }
}
</style>