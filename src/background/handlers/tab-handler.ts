/**
 * Tab event handlers for Chrome tabs API
 * Handles tab lifecycle events and notifications
 */

import { sendRuntimeMessageFireAndForget } from '../utils/message-utils'
import type { DIContainer } from '../container'

export interface TabInfo {
  id: number
  url: string
  title: string
  favicon?: string
}

/**
 * Initialize tab event listeners
 * @param container - DI container for accessing services
 * @param aiAutomationTabs - Map tracking AI automation tabs by provider
 */
export function initializeTabHandlers(
  container: DIContainer,
  aiAutomationTabs: Map<string, number>
): void {
  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    try {
      container.backgroundStore?.clearSearchTabById?.(tabId)

      // Clean up AI automation tab tracking
      for (const [provider, trackedTabId] of aiAutomationTabs.entries()) {
        if (trackedTabId === tabId) {
          aiAutomationTabs.delete(provider)
          break
        }
      }
    } catch (error) {
      console.warn('Failed to clear search tab mapping for removed tab:', error)
    }
  })

  // Notify side panel when active tab changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId)
      if (tab) {
        console.log('Tab activated:', tab.url)

        // Broadcast tab change to side panel
        sendRuntimeMessageFireAndForget({
          type: 'TAB_CHANGED',
          data: {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl
          }
        })
      }
    } catch (error) {
      console.error('Failed to get active tab:', error)
    }
  })

  // Notify side panel when tab finishes loading
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only notify when the page finishes loading and it's the active tab
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
      console.log('Tab updated:', tab.url)

      sendRuntimeMessageFireAndForget({
        type: 'TAB_UPDATED',
        data: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl
        }
      })
    }
  })
}

/**
 * Get information about the current active tab
 * @returns TabInfo or null if no active tab found
 */
export async function getCurrentTab(): Promise<TabInfo | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url || !tab.title) {
      return null
    }

    return {
      id: tab.id!,
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl
    }
  } catch (error) {
    console.error('Error getting current tab:', error)
    return null
  }
}
