import { ITabManagementService } from '../../shared/services/interfaces'

export class TabManagementService implements ITabManagementService {
  /**
   * Closes all tabs showing the authoring workspace for a specific document
   */
  async closeDocumentTabs(documentId: string): Promise<void> {
    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({})

      // Find tabs that are showing the authoring workspace for this document
      const authoringTabs = tabs.filter(tab => {
        if (!tab.url) return false

        // Check if it's an authoring workspace URL
        const authoringPattern = chrome.runtime.getURL('/authoring/index.html')
        if (!tab.url.startsWith(authoringPattern)) return false

        // Check if it has the specific document ID
        try {
          const url = new URL(tab.url)
          return url.searchParams.get('documentId') === documentId
        } catch {
          return false
        }
      })

      // Close all matching tabs
      if (authoringTabs.length > 0) {
        const tabIds = authoringTabs
          .map(tab => tab.id!)
          .filter(id => id !== undefined)

        if (tabIds.length > 0) {
          await chrome.tabs.remove(tabIds)
        }
      }
    } catch (error) {
      console.error('Failed to close document tabs:', error)
      // Don't throw error - this is cleanup operation and shouldn't fail the main operation
    }
  }

  /**
   * Closes a specific authoring workspace tab for a document (alias for closeDocumentTabs)
   */
  async closeAuthoringWorkspaceTab(documentId: string): Promise<void> {
    return this.closeDocumentTabs(documentId)
  }

  /**
   * Gets all currently open authoring workspace tabs
   */
  async getOpenAuthoringTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({})
      const authoringPattern = chrome.runtime.getURL('/authoring/index.html')

      return tabs.filter(tab =>
        tab.url && tab.url.startsWith(authoringPattern)
      )
    } catch (error) {
      console.error('Failed to get open authoring tabs:', error)
      return []
    }
  }
}