<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// Props interface
interface Props {
  // Define your props here
  title: string;
  items?: string[];
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  save: [data: any];
  close: [];
}>();

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const data = ref<any>(null);

// Computed properties
const displayTitle = computed(() => props.title.toUpperCase());

// Methods
async function handleSave() {
  isLoading.value = true;
  error.value = null;

  try {
    // Message to background
    const response = await chrome.runtime.sendMessage({
      type: 'YOUR_MESSAGE_TYPE',
      payload: { /* your data */ }
    });

    if (response.success) {
      emit('save', response.data);
    } else {
      error.value = response.error;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred';
  } finally {
    isLoading.value = false;
  }
}

function handleClose() {
  emit('close');
}

// Lifecycle
onMounted(async () => {
  // Initialize component
  await loadData();
});

async function loadData() {
  isLoading.value = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_DATA',
      payload: {}
    });
    data.value = response.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="component-container">
    <header class="component-header">
      <h2>{{ displayTitle }}</h2>
      <button @click="handleClose" class="close-btn">×</button>
    </header>

    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="component-content">
      <!-- Your content here -->
      <button @click="handleSave">Save</button>
    </div>
  </div>
</template>

<style scoped>
.component-container {
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.close-btn:hover {
  color: #1f2937;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
}

.error {
  color: #dc2626;
  background: #fee2e2;
  border-radius: 4px;
}

.component-content {
  /* Your styles here */
}
</style>
