/**
 * Background service worker entry point
 * Initializes DI container, background store, and all event handlers
 */

import { DIContainer } from './container'
import { createPinia, setActivePinia } from 'pinia'
import { useBackgroundStore } from './stores/background-store'
import { MESSAGES } from './constants'

// Import handlers
import { initializeTabHandlers } from './handlers/tab-handler'
import { initializeOmniboxHandlers } from './handlers/omnibox-handler'
import { initializeMessageHandler } from './handlers/message-handler'
import { aiAutomationTabs } from './handlers/ai-automation-handler'

// Initialize dependency injection container and shared store
const container = DIContainer.getInstance()
const pinia = createPinia()
setActivePinia(pinia)
const backgroundStore = useBackgroundStore()

// Set the background store in the container for dependency injection
container.setBackgroundStore(backgroundStore)

// Initialize the background store with persisted data
backgroundStore.initialize(container).then(() => {
  console.log(MESSAGES.BACKGROUND_STORE_INITIALIZED)
}).catch(error => {
  console.error(MESSAGES.BACKGROUND_STORE_INIT_FAILED, error)
})

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log(MESSAGES.EXTENSION_INSTALLED)
})

// Handle action clicks to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id })
})

// Initialize all event handlers
initializeTabHandlers(container, aiAutomationTabs)
initializeOmniboxHandlers(container)
initializeMessageHandler(container)

// Export for other modules if needed
export { container, backgroundStore }
