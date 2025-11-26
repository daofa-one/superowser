import { ref, computed } from 'vue';

/**
 * Example composable for messaging with background service worker
 */
export function useMessages() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function sendMessage<T>(type: string, payload?: any): Promise<T | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await chrome.runtime.sendMessage({
        type,
        payload
      });

      if (response.success) {
        return response.data as T;
      } else {
        error.value = response.error;
        return null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Communication error';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    sendMessage,
    clearError: () => { error.value = null; }
  };
}

/**
 * Example composable for managing pages
 */
export function usePages() {
  const { sendMessage } = useMessages();
  const pages = ref<PageEntry[]>([]);

  async function loadPages(filter?: { task?: string; tags?: string[] }) {
    const data = await sendMessage<PageEntry[]>('GET_PAGES', filter);
    if (data) {
      pages.value = data;
    }
  }

  async function savePage(pageData: Partial<PageEntry>) {
    return await sendMessage<PageEntry>('SAVE_PAGE', pageData);
  }

  async function deletePage(id: number) {
    const result = await sendMessage('DELETE_PAGE', { id });
    if (result) {
      pages.value = pages.value.filter(p => p.id !== id);
    }
    return result;
  }

  return {
    pages: computed(() => pages.value),
    loadPages,
    savePage,
    deletePage
  };
}

// Type definitions
interface PageEntry {
  id: number;
  url: string;
  title: string;
  tags: string[];
  shortcut?: string;
  task?: string;
  created: number;
}
