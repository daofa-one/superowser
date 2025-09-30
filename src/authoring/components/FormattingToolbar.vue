<template>
  <div class="formatting-toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Bold (Ctrl+B)"
        @click="$emit('formatText', 'bold')"
      >
        <strong>B</strong>
      </button>
      <button
        class="toolbar-btn"
        title="Italic (Ctrl+I)"
        @click="$emit('formatText', 'italic')"
      >
        <em>I</em>
      </button>
      <button
        class="toolbar-btn"
        title="Strikethrough"
        @click="$emit('formatText', 'strikethrough')"
      >
        <s>S</s>
      </button>
    </div>

    <div class="toolbar-separator"></div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Heading 1"
        @click="$emit('formatText', 'h1')"
      >
        H1
      </button>
      <button
        class="toolbar-btn"
        title="Heading 2"
        @click="$emit('formatText', 'h2')"
      >
        H2
      </button>
      <button
        class="toolbar-btn"
        title="Heading 3"
        @click="$emit('formatText', 'h3')"
      >
        H3
      </button>
    </div>

    <div class="toolbar-separator"></div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Unordered List"
        @click="$emit('formatText', 'ul')"
      >
        • List
      </button>
      <button
        class="toolbar-btn"
        title="Ordered List"
        @click="$emit('formatText', 'ol')"
      >
        1. List
      </button>
      <button
        class="toolbar-btn"
        title="Checkbox List"
        @click="$emit('formatText', 'checkbox')"
      >
        ☑ Task
      </button>
    </div>

    <div class="toolbar-separator"></div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Link (Ctrl+K)"
        @click="$emit('formatText', 'link')"
      >
        🔗 Link
      </button>
      <button
        class="toolbar-btn"
        title="Code Block"
        @click="$emit('formatText', 'code')"
      >
        &lt;/&gt; Code
      </button>
      <button
        class="toolbar-btn"
        title="Quote"
        @click="$emit('formatText', 'quote')"
      >
        💬 Quote
      </button>
      <button
        class="toolbar-btn"
        title="Mermaid Diagram"
        @click="$emit('formatText', 'mermaid')"
      >
        📊 Diagram
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'formatText', format: string): void
}

defineEmits<Emits>()
</script>

<style scoped>
.formatting-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.formatting-toolbar::-webkit-scrollbar {
  display: none;
}

.toolbar-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  height: 32px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 0;
  box-sizing: border-box;
}

.toolbar-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.toolbar-btn:active {
  background: #e5e7eb;
  border-color: #6b7280;
}

.toolbar-btn strong,
.toolbar-btn em,
.toolbar-btn s {
  font-style: normal;
  text-decoration: none;
  font-weight: inherit;
}

.toolbar-btn strong {
  font-weight: 700;
}

.toolbar-btn em {
  font-style: italic;
}

.toolbar-btn s {
  text-decoration: line-through;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: #d1d5db;
  margin: 0 4px;
}
</style>