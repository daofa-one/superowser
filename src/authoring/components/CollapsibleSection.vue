<template>
  <div class="collapsible-section" :class="{ collapsed: !isExpanded }">
    <button
      class="section-header"
      @click="toggleExpanded"
      @mousedown.prevent
      :aria-expanded="isExpanded"
      :aria-controls="`section-${sectionId}`"
      tabindex="-1"
    >
      <div class="section-title">
        <div class="section-icon" v-if="icon">
          <svg v-if="icon === 'outline'" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1H2V3zm0 3h12v1H2V6zm0 3h12v1H2V9zm0 3h12v1H2v-1z"/>
          </svg>
          <svg v-else-if="icon === 'pages'" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2h8l2 2v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
          </svg>
          <svg v-else-if="icon === 'notes'" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 2v8h10V4H3z"/>
          </svg>
        </div>
        <h4>{{ title }}</h4>
        <span v-if="count !== undefined" class="section-count">{{ count }}</span>
      </div>
      <div class="expand-icon" :class="{ rotated: isExpanded }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 4l4 4-4 4V4z"/>
        </svg>
      </div>
    </button>

    <div
      :id="`section-${sectionId}`"
      class="section-content"
      :style="contentStyle"
    >
      <div ref="contentRef" class="section-inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'

interface Props {
  title: string
  icon?: string
  count?: number
  defaultExpanded?: boolean
  sectionId: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: true
})

const isExpanded = ref(props.defaultExpanded)
const contentRef = ref<HTMLElement>()
const contentHeight = ref(0)

const contentStyle = computed(() => ({
  maxHeight: isExpanded.value ? `${contentHeight.value}px` : '0px',
  overflow: 'hidden',
  transition: 'max-height 0.3s ease-in-out'
}))

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function updateContentHeight() {
  if (contentRef.value) {
    contentHeight.value = contentRef.value.scrollHeight
  }
}

// Update height when expanded state changes
watch(isExpanded, async () => {
  if (isExpanded.value) {
    await nextTick()
    updateContentHeight()
  }
})

// Update height when content changes
const resizeObserver = new ResizeObserver(() => {
  if (isExpanded.value) {
    updateContentHeight()
  }
})

onMounted(() => {
  updateContentHeight()
  if (contentRef.value) {
    resizeObserver.observe(contentRef.value)
  }
})
</script>

<style scoped>
.collapsible-section {
  background: white;
  border: 1px solid #e2e8f0;
  margin-bottom: 1px;
  transition: all 0.2s ease-in-out;
}

.collapsible-section:hover {
  border-color: #cbd5e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  position: relative;
}

.section-header:hover {
  background: #f5f5f5;
}

.section-header:focus {
  outline: none !important;
  background: #f0f0f0;
}

.section-header:focus-visible {
  outline: none !important;
}

.section-header:active {
  background: #eeeeee;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.section-icon {
  color: rgba(0, 0, 0, 0.54);
  display: flex;
  align-items: center;
}

.section-title h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.87);
  flex: 1;
}

.section-count {
  background: rgba(25, 118, 210, 0.1);
  color: #1976d2;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.expand-icon {
  color: rgba(0, 0, 0, 0.54);
  transition: transform 0.2s ease-in-out;
  display: flex;
  align-items: center;
}

.expand-icon.rotated {
  transform: rotate(90deg);
}

.section-content {
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
  border-top: 1px solid #e2e8f0;
  background: white;
}

.section-inner {
  padding: 16px;
}

.collapsed .section-content {
  border-top: none;
}

/* Custom scrollbar for content */
.section-content::-webkit-scrollbar {
  width: 4px;
}

.section-content::-webkit-scrollbar-track {
  background: transparent;
}

.section-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.section-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>