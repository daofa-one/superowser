/**
 * Shared messaging utilities for consistent communication between
 * sidepanel, background service, and content scripts
 */

export interface MessageRequest<TData = any> {
  type: string
  data?: TData
  requestId?: string
}

export interface MessageResponse<TData = any> {
  type: 'SUCCESS' | 'ERROR'
  data?: TData
  error?: {
    message: string
    code?: string
    details?: any
  }
  requestId?: string
}

export type MessageHandler<TData = any, TResponse = any> = (
  data: TData,
  sender?: chrome.runtime.MessageSender
) => Promise<TResponse> | TResponse

export interface MessageListener {
  type: string
  handler: MessageHandler
  cleanup?: () => void
}

// Global request ID counter for tracking requests
let requestIdCounter = 0

/**
 * Send a message request to the background service worker with proper error handling
 */
export async function sendRequest<TResponse = any, TData = any>(
  type: string,
  data?: TData,
  options: {
    timeout?: number
    retries?: number
  } = {}
): Promise<TResponse> {
  const { timeout = 10000, retries = 1 } = options
  const requestId = `req_${Date.now()}_${++requestIdCounter}`

  const request: MessageRequest<TData> = {
    type,
    data,
    requestId
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await sendMessageWithTimeout(request, timeout)

      if (!response) {
        throw new Error('No response received from background service')
      }

      if (response.type === 'ERROR') {
        throw new Error(response.error?.message || 'Request failed')
      }

      return response.data as TResponse
    } catch (error) {
      lastError = error as Error
      console.warn(`[Messaging] Request ${type} failed (attempt ${attempt + 1}/${retries + 1}):`, error)

      if (attempt < retries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  // All attempts failed
  throw new Error(`Request ${type} failed after ${retries + 1} attempts: ${lastError?.message}`)
}

/**
 * Send message with timeout support
 */
function sendMessageWithTimeout(
  message: MessageRequest,
  timeout: number
): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`))
    }, timeout)

    chrome.runtime.sendMessage(message, (response: MessageResponse) => {
      clearTimeout(timeoutId)

      const lastError = chrome.runtime.lastError
      if (lastError) {
        reject(new Error(lastError.message || 'Unknown error'))
        return
      }

      resolve(response)
    })
  })
}

/**
 * Add a background message listener with automatic cleanup
 */
export function addBackgroundListener<TData = any>(
  type: string,
  handler: (payload: TData, sender?: chrome.runtime.MessageSender) => void
): () => void {
  const messageListener = (
    message: MessageRequest<TData>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    if (message.type === type) {
      try {
        const result = handler(message.data!, sender)

        // If handler returns a promise, handle it
        if (result && typeof result === 'object' && 'then' in result) {
          (result as Promise<any>)
            .then((data: any) => sendResponse({ type: 'SUCCESS', data }))
            .catch((error: any) => sendResponse({
              type: 'ERROR',
              error: { message: error.message }
            }))
          return true // Indicates async response
        }

        // Synchronous response
        sendResponse({ type: 'SUCCESS', data: result })
      } catch (error) {
        sendResponse({
          type: 'ERROR',
          error: { message: (error as Error).message }
        })
      }
    }
  }

  chrome.runtime.onMessage.addListener(messageListener)

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(messageListener)
  }
}

/**
 * Add a listener for broadcast messages (no response expected)
 */
export function addBroadcastListener<TData = any>(
  type: string,
  handler: (payload: TData, sender?: chrome.runtime.MessageSender) => void
): () => void {
  const messageListener = (
    message: MessageRequest<TData>,
    sender: chrome.runtime.MessageSender
  ) => {
    if (message.type === type) {
      try {
        handler(message.data!, sender)
      } catch (error) {
        console.error(`[Messaging] Broadcast listener error for ${type}:`, error)
      }
    }
  }

  chrome.runtime.onMessage.addListener(messageListener)

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(messageListener)
  }
}

/**
 * Send a broadcast message (no response expected)
 */
export async function sendBroadcast<TData = any>(
  type: string,
  data?: TData
): Promise<void> {
  const message: MessageRequest<TData> = { type, data }

  try {
    chrome.runtime.sendMessage(message)
  } catch (error) {
    console.warn(`[Messaging] Failed to send broadcast ${type}:`, error)
  }
}

/**
 * Utility for content scripts to communicate with background
 */
export class ContentScriptMessenger {
  private listeners: Map<string, MessageListener> = new Map()

  /**
   * Send request from content script to background
   */
  async sendToBackground<TResponse = any, TData = any>(
    type: string,
    data?: TData,
    options?: { timeout?: number; retries?: number }
  ): Promise<TResponse> {
    return sendRequest<TResponse, TData>(type, data, options)
  }

  /**
   * Listen for messages from background to this content script
   */
  addListener<TData = any>(
    type: string,
    handler: MessageHandler<TData>
  ): () => void {
    const listener: MessageListener = { type, handler }

    const cleanup = addBackgroundListener(type, handler)
    listener.cleanup = cleanup

    this.listeners.set(type, listener)

    return () => {
      cleanup()
      this.listeners.delete(type)
    }
  }

  /**
   * Clean up all listeners
   */
  destroy(): void {
    for (const listener of this.listeners.values()) {
      listener.cleanup?.()
    }
    this.listeners.clear()
  }
}

// Export types for use in other modules
export type { MessageRequest, MessageResponse, MessageHandler, MessageListener }