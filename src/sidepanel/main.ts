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
  } else if (message?.type === 'COMMAND_NAVIGATION') {
    // Handle command navigation responses
    setTimeout(() => {
      // Navigate to the specified view
      const target = (message.data?.target || 'home').toLowerCase()
      const navigationMap: Record<string, { path: string; tab: 'home' | 'tasks' | 'chat' }> = {
        home: { path: '/', tab: 'home' },
        tasks: { path: '/tasks', tab: 'tasks' },
        chat: { path: '/chat', tab: 'chat' }
      }
      const destination = navigationMap[target] || navigationMap.home

      router.push(destination.path).then(() => {
        store.setSelectedTab(destination.tab)
      }).catch((error) => {
        console.error('Failed to navigate after command:', error)
      })

      // Add notification about the command result
      if (message.data?.message) {
        store.addNotification({
          type: 'success',
          message: message.data.message
        })
      }

    }, 100)
  } else if (message?.type === 'COMMAND_RESPONSE') {
    // Handle other command responses
    setTimeout(() => {
      if (message.data?.content) {
        store.addNotification({
          type: message.data.success ? 'success' : 'error',
          message: message.data.content
        })
      }

      // Refresh the store to get updated data
      store.initialize().catch(console.error)
    }, 100)
  } else if (message?.type === 'OMNIBOX_RESULTS') {
    // Add a small delay to ensure the side panel is fully loaded
    setTimeout(() => {
      const results = Array.isArray(message.data?.results) ? message.data.results : []
      const hasCommandResult = results.some(result => result?.type === 'command')

      if (hasCommandResult) {
        router.push('/chat').then(() => {
          store.setSelectedTab('chat')
        }).catch(error => {
          console.error('Failed to navigate to Chat view for command results:', error)
        })

        if (message.data?.message) {
          store.addNotification({
            type: 'info',
            message: message.data.message
          })
        }
      } else {
        // Navigate to Home view when omnibox search results are received
        router.push('/').then(() => {
          store.setSelectedTab('home')
        }).catch((error) => {
          console.error('Failed to navigate to Home view:', error)
        })

        // Store the search results for display
        store.setSearchResults(results)
        store.setSearchQuery(message.data?.query || '')

        if (results.length) {
          store.addNotification({
            type: 'info',
            message: `Found ${results.length} results for: ${message.data?.query || 'search'}`
          })
        }
      }
    }, 100)
  }
  return false
})

// Initialize store with data from background
store.initialize().catch(console.error);

app.mount('#app');
