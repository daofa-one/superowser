<template>
  <div class="document-outline">
    <div class="outline-content" v-if="headings.length > 0">
      <nav class="outline-nav">
        <a
          v-for="heading in headings"
          :key="heading.id"
          :href="`#${heading.id}`"
          :class="[
            'outline-link',
            `outline-level-${heading.level}`,
            { active: activeHeading === heading.id }
          ]"
          @click="handleHeadingClick(heading.id, $event)"
        >
          {{ heading.text }}
        </a>
      </nav>
    </div>

    <div v-else class="outline-empty">
      <p>No headings found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Heading {
  id: string
  text: string
  level: number
  element?: HTMLElement
}

interface Props {
  headings: Heading[]
  activeHeading?: string
}

interface Emits {
  (e: 'headingClick', headingId: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleHeadingClick(headingId: string, event: Event) {
  event.preventDefault()
  emit('headingClick', headingId)
}
</script>

<style scoped>
.document-outline {
  display: flex;
  flex-direction: column;
}

.outline-content {
  max-height: 300px;
  overflow-y: auto;
}

.outline-nav {
  display: flex;
  flex-direction: column;
}

.outline-link {
  display: block;
  padding: 8px 16px;
  color: rgba(0, 0, 0, 0.7);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition: all 0.2s ease-in-out;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outline-link:hover {
  background: rgba(25, 118, 210, 0.04);
  color: #1976d2;
}

.outline-link.active {
  background: rgba(25, 118, 210, 0.08);
  border-left-color: #1976d2;
  color: #1976d2;
  font-weight: 500;
}

/* Indentation for different heading levels */
.outline-level-1 {
  padding-left: 16px;
  font-weight: 500;
}

.outline-level-2 {
  padding-left: 24px;
}

.outline-level-3 {
  padding-left: 32px;
}

.outline-level-4 {
  padding-left: 40px;
}

.outline-level-5 {
  padding-left: 48px;
}

.outline-level-6 {
  padding-left: 56px;
}

.outline-empty {
  padding: 24px 16px;
  text-align: center;
}

.outline-empty p {
  margin: 0;
  color: rgba(0, 0, 0, 0.54);
  font-size: 13px;
  font-style: italic;
}

/* Custom scrollbar */
.outline-content::-webkit-scrollbar {
  width: 4px;
}

.outline-content::-webkit-scrollbar-track {
  background: transparent;
}

.outline-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.outline-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>