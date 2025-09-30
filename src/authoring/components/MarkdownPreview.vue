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
  padding: 24px 32px;
  overflow-y: auto;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.87);
  background: #ffffff;
  max-width: none;
}

/* Material Design Typography */
:deep(.preview-content h1),
:deep(.preview-content h2),
:deep(.preview-content h3),
:deep(.preview-content h4),
:deep(.preview-content h5),
:deep(.preview-content h6) {
  margin: 1.25em 0 0.5em 0;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-weight: 400;
  line-height: 1.25;
  color: rgba(0, 0, 0, 0.87);
  scroll-margin-top: 80px;
}

:deep(.preview-content h1) {
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin-top: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding-bottom: 8px;
}

:deep(.preview-content h2) {
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin-top: 2em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: 6px;
}

:deep(.preview-content h3) {
  font-size: 1.5rem;
  font-weight: 400;
  margin-top: 1.6em;
}

:deep(.preview-content h4) {
  font-size: 1.25rem;
  font-weight: 500;
  margin-top: 1.6em;
}

:deep(.preview-content h5) {
  font-size: 1rem;
  font-weight: 500;
  margin-top: 1.6em;
}

:deep(.preview-content h6) {
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 1.6em;
  color: rgba(0, 0, 0, 0.54);
}

:deep(.preview-content p) {
  margin: 0 0 16px 0;
  line-height: 1.6;
}

:deep(.preview-content ul),
:deep(.preview-content ol) {
  margin: 0 0 16px 0;
  padding-left: 24px;
}

:deep(.preview-content ul) {
  list-style-type: disc;
}

:deep(.preview-content ol) {
  list-style-type: decimal;
}

:deep(.preview-content li) {
  margin-bottom: 4px;
  line-height: 1.6;
}

:deep(.preview-content li p) {
  margin-bottom: 8px;
}

:deep(.preview-content blockquote) {
  margin: 24px 0;
  padding: 12px 0 12px 24px;
  border-left: 4px solid rgba(33, 150, 243, 0.4);
  background: rgba(33, 150, 243, 0.04);
  border-radius: 0 4px 4px 0;
  color: rgba(0, 0, 0, 0.7);
  font-style: normal;
}

:deep(.preview-content blockquote p:last-child) {
  margin-bottom: 0;
}

:deep(.preview-content code) {
  background: rgba(175, 184, 193, 0.2);
  color: #e91e63;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Roboto Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
  font-weight: 400;
}

:deep(.preview-content pre) {
  background: #f8f8f8;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 16px;
  overflow-x: auto;
  margin: 20px 0;
  font-family: 'Roboto Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
  line-height: 1.5;
}

:deep(.preview-content pre code) {
  background: none;
  color: rgba(0, 0, 0, 0.87);
  padding: 0;
  border-radius: 0;
}

:deep(.preview-content table) {
  border-collapse: collapse;
  width: 100%;
  margin: 20px 0;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}

:deep(.preview-content th),
:deep(.preview-content td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
}

:deep(.preview-content th) {
  background: #f5f5f5;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.87);
}

:deep(.preview-content tbody tr:hover) {
  background: rgba(0, 0, 0, 0.04);
}

:deep(.preview-content a) {
  color: #1976d2;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease-in-out;
}

:deep(.preview-content a:hover) {
  color: #0d47a1;
  border-bottom-color: #1976d2;
}

:deep(.preview-content a:focus) {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

:deep(.preview-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin: 16px 0;
}

:deep(.preview-content hr) {
  border: none;
  height: 1px;
  background: rgba(0, 0, 0, 0.12);
  margin: 32px 0;
}

/* Material Design admonitions/callouts */
:deep(.preview-content .admonition) {
  margin: 20px 0;
  padding: 12px 16px;
  border-radius: 4px;
  border-left: 4px solid;
  background: rgba(68, 138, 255, 0.04);
  border-left-color: #448aff;
}

:deep(.preview-content .admonition-title) {
  font-weight: 500;
  margin-bottom: 8px;
  color: rgba(0, 0, 0, 0.87);
}

/* Material Design Mermaid styling */
:deep(.mermaid-container) {
  margin: 24px 0;
  border-radius: 4px;
  overflow: hidden;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}

:deep(.mermaid-diagram) {
  padding: 24px;
  text-align: center;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

:deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

:deep(.mermaid-controls) {
  padding: 12px 16px;
  background: #f5f5f5;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  justify-content: flex-end;
}

:deep(.mermaid-export-btn) {
  background: #1976d2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.mermaid-export-btn:hover) {
  background: #0d47a1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

:deep(.mermaid-export-btn:focus) {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}
</style>