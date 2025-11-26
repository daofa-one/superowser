/**
 * Message utilities for safe communication between extension contexts
 */

import { RETRY_CONFIG, MESSAGES } from '../constants'

/**
 * Safely send a runtime message with retry logic and timeout
 * @param payload - Message payload to send
 * @param options - Optional retry and timeout configuration
 * @returns Promise resolving to response data, or null if all retries fail
 */
export async function sendRuntimeMessageSafe<T = any>(
  payload: any,
  options: {
    retries?: number
    timeout?: number
    suppressErrors?: boolean
  } = {}
): Promise<T | null> {
  const {
    retries = RETRY_CONFIG.DEFAULT_RETRIES,
    timeout = RETRY_CONFIG.DEFAULT_TIMEOUT_MS,
    suppressErrors = false
  } = options

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await Promise.race<T>([
        chrome.runtime.sendMessage(payload),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(MESSAGES.MESSAGE_TIMEOUT)), timeout)
        )
      ])

      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if this is an expected disconnection error
      const isDisconnectionError =
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('message port closed')

      if (isDisconnectionError && suppressErrors) {
        // Silently fail for expected disconnection scenarios
        return null
      }

      // If this is the last retry, throw or return null based on suppressErrors
      if (attempt === retries) {
        if (!suppressErrors) {
          console.error(
            `[Message Failed] After ${retries} retries:`,
            errorMessage,
            payload.type
          )
        }
        return null
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }

  return null
}

/**
 * Send a runtime message without waiting for response
 * Used for fire-and-forget notifications
 * @param payload - Message payload to send
 */
export function sendRuntimeMessageFireAndForget(payload: any): void {
  try {
    chrome.runtime.sendMessage(payload, () => {
      const error = chrome.runtime.lastError
      if (error && error.message) {
        const message = error.message
        // Silently ignore common disconnection errors that are expected
        if (
          message.includes('Receiving end does not exist') ||
          message.includes('Could not establish connection') ||
          message.includes('The message port closed before a response was received')
        ) {
          return
        }
        console.warn('[superowser] Failed to deliver runtime message:', message)
      }
    })
  } catch (error) {
    // Only log unexpected errors, not connection issues
    if (
      error instanceof Error &&
      !error.message.includes('message port closed') &&
      !error.message.includes('Receiving end does not exist')
    ) {
      console.warn('[superowser] Runtime message dispatch failed:', error)
    }
  }
}

/**
 * Escape special XML characters for Chrome omnibox suggestions
 * @param text - Text to escape
 * @returns Escaped text safe for XML
 */
export function escapeForXML(text: string): string {
  if (typeof text !== 'string') return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
