<template>
  <div class="command-shortcuts">
    <button
      v-for="shortcut in visibleShortcuts"
      :key="shortcut.id"
      class="shortcut-btn"
      :class="{
        'context-active': shortcut.contextActive,
        'shift-held': isShiftHeld
      }"
      :title="getButtonTitle(shortcut)"
      @click="executeShortcut(shortcut, $event)"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
    >
      <span class="shortcut-icon">{{ shortcut.icon }}</span>
      <span class="shortcut-label">{{ shortcut.label }}</span>
      <span v-if="isShiftHeld && shortcut.autoExecute" class="shift-indicator">⌨️</span>
    </button>

    <!-- Customize button -->
    <button class="shortcut-btn shortcut-customize" @click="$emit('customize')">
      <span class="shortcut-icon">⚙️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ChatShortcut } from './shortcuts-config'

interface Props {
  shortcuts: ChatShortcut[]
  maxVisible?: number
}

interface Emits {
  (e: 'shortcut-executed', shortcut: ChatShortcut, options: { autoExecute: boolean }): void
  (e: 'customize'): void
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 6
})

const emit = defineEmits<Emits>()

// Track shift key state globally
const isShiftHeld = ref(false)

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Shift') {
    isShiftHeld.value = true
  }
}

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Shift') {
    isShiftHeld.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

// Only show enabled shortcuts, sorted by position
const visibleShortcuts = computed(() => {
  return props.shortcuts
    .filter(shortcut => shortcut.enabled)
    .sort((a, b) => a.position - b.position)
    .slice(0, props.maxVisible)
})

const getButtonTitle = (shortcut: ChatShortcut): string => {
  const baseTitle = shortcut.description || shortcut.command
  if (shortcut.autoExecute) {
    return `${baseTitle}\n\nShift+Click to add parameters`
  }
  return baseTitle
}

const handleMouseDown = (event: MouseEvent) => {
  // Update shift state on mouse down to ensure it's current
  if (event.shiftKey) {
    isShiftHeld.value = true
  }
}

const handleMouseUp = (event: MouseEvent) => {
  // Reset shift state if not held during mouse up
  if (!event.shiftKey) {
    isShiftHeld.value = false
  }
}

const executeShortcut = (shortcut: ChatShortcut, event: MouseEvent) => {
  console.log('[TaskShortcuts] Clicked:', shortcut.id, 'shiftKey:', event?.shiftKey, 'isShiftHeld:', isShiftHeld.value)

  // If Shift key is held (check both event and our tracked state), always just fill input (don't auto-execute)
  const forceInputMode = event?.shiftKey || isShiftHeld.value || false

  // Determine if we should auto-execute:
  // - Not if shift key is held
  // - Yes if shortcut.autoExecute is true
  const shouldAutoExecute = !forceInputMode && (shortcut.autoExecute ?? false)

  console.log('[TaskShortcuts] Emitting with autoExecute:', shouldAutoExecute, 'forceInputMode:', forceInputMode)
  emit('shortcut-executed', shortcut, { autoExecute: shouldAutoExecute })
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

.shortcut-btn.shift-held {
  border-color: #f59e0b;
  background: #fffbeb;
  color: #d97706;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.shift-indicator {
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.8;
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