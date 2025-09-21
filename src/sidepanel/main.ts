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
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'STATE_UPDATE') {
    console.log('Received state update:', message)
    // Handle state updates here
  }
  return false
})

// Initialize store with data from background
store.initialize().catch(console.error);

app.mount('#app');