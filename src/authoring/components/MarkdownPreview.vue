<template>
  <div class="preview-pane" :style="previewPaneStyle">
    <div class="preview-header">
      <h3>Preview</h3>
      <button class="close-preview" @click="$emit('close')" title="Close preview">×</button>
    </div>
    <div
      ref="previewContentRef"
      class="preview-content"
      v-html="renderedContent"
      @scroll="handlePreviewScroll"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  renderedContent: string
  previewPaneStyle: Record<string, any>
}

interface Emits {
  (e: 'close'): void
  (e: 'scroll'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const previewContentRef = defineModel<HTMLElement>('previewContentRef')

function handlePreviewScroll() {
  emit('scroll')
}
</script>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  background: white;
  border-left: 1px solid #e2e8f0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.preview-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.close-preview {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #718096;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-preview:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.preview-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #2d3748;
}

/* Markdown content styling */
:deep(.preview-content h1),
:deep(.preview-content h2),
:deep(.preview-content h3),
:deep(.preview-content h4),
:deep(.preview-content h5),
:deep(.preview-content h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
  color: #1a202c;
}

:deep(.preview-content h1) {
  font-size: 2em;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.3em;
}

:deep(.preview-content h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.3em;
}

:deep(.preview-content h3) {
  font-size: 1.25em;
}

:deep(.preview-content h4) {
  font-size: 1em;
}

:deep(.preview-content p) {
  margin-bottom: 1em;
}

:deep(.preview-content ul),
:deep(.preview-content ol) {
  padding-left: 2em;
  margin-bottom: 1em;
}

:deep(.preview-content li) {
  margin-bottom: 0.25em;
}

:deep(.preview-content blockquote) {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 4px solid #e2e8f0;
  color: #4a5568;
  font-style: italic;
}

:deep(.preview-content code) {
  background: #f7fafc;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
}

:deep(.preview-content pre) {
  background: #f7fafc;
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}

:deep(.preview-content pre code) {
  background: none;
  padding: 0;
}

:deep(.preview-content table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

:deep(.preview-content th),
:deep(.preview-content td) {
  border: 1px solid #e2e8f0;
  padding: 0.5em;
  text-align: left;
}

:deep(.preview-content th) {
  background: #f7fafc;
  font-weight: 600;
}

:deep(.preview-content a) {
  color: #3182ce;
  text-decoration: none;
}

:deep(.preview-content a:hover) {
  text-decoration: underline;
}

:deep(.preview-content img) {
  max-width: 100%;
  height: auto;
}

/* Mermaid styling */
:deep(.mermaid-container) {
  margin: 1.5em 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

:deep(.mermaid-diagram) {
  padding: 20px;
  text-align: center;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
}

:deep(.mermaid-controls) {
  padding: 8px 12px;
  background: #f7fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

:deep(.mermaid-export-btn) {
  background: #3182ce;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.mermaid-export-btn:hover) {
  background: #2c5aa0;
}
</style>