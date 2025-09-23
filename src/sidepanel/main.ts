import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useSidePanelStore } from './stores/sidepanel-store';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialize side panel store
const store = useSidePanelStore();

// Simple state sync setup
chrome.runtime.onMessage.addListener((message, _sender: unknown, _sendResponse: unknown) => {
  if (message?.type === 'STATE_UPDATE') {
    store.handleStateUpdate({ path: message.path, value: message.value })
  } else if (message?.type === 'TASK_CHANGED') {
    // Navigate to Home view when a task is activated via omnibox
    setTimeout(() => {
      router.push('/').then(() => {
        store.setSelectedTab('home')
      }).catch((error) => {
        console.error('Failed to navigate to Home view after task change:', error)
      })

      // Add notification about the task change
      if (message.data?.name) {
        store.addNotification({
          type: 'success',
          message: `Switched to task: ${message.data.name}`
        })
      }
    }, 100)
  } else if (message?.type === 'OMNIBOX_RESULTS') {
    // Add a small delay to ensure the side panel is fully loaded
    setTimeout(() => {
      // Navigate to Home view when omnibox search results are received
      router.push('/').then(() => {
        store.setSelectedTab('home')
      }).catch((error) => {
        console.error('Failed to navigate to Home view:', error)
      })

      // Store the search results for display
      if (message.data?.results) {
        store.setSearchResults(message.data.results)
        store.setSearchQuery(message.data.query || '')
      }

      // Add notification to confirm the navigation
      store.addNotification({
        type: 'info',
        message: `Found ${message.data?.results?.length || 0} results for: ${message.data?.query || 'search'}`
      })
    }, 100)
  }
  return false
})

// Initialize store with data from background
store.initialize().catch(console.error);

app.mount('#app');
