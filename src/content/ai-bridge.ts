/**
 * AI Bridge Content Script
 * Automates ChatGPT (and other providers) for the /ai command.
 * Must remain standalone (no imports) so it can run as a classic content script.
 */

interface AISelectors {
  input: string
  submitButton: string
  conversationContainer: string
  responseContainer: string
  loadingIndicator?: string
  errorIndicator?: string
  authPrompt?: string
}

interface AIExecutePromptRequest {
  requestId: string
  prompt: string
  selectors: AISelectors
}

interface AIProgressUpdate {
  requestId: string
  status: string
  message: string
  partialContent?: string
  timestamp?: number
}

interface AIResult {
  requestId: string
  content: string
  timestamp?: number
}

interface AIError {
  requestId: string
  reason: 'missing_selector' | 'auth_required' | 'chatgpt_error' | 'network_error' | 'timeout' | 'unknown'
  message: string
  details?: any
}

const AI_MESSAGE_TYPES = {
  AI_EXECUTE_PROMPT: 'AI_EXECUTE_PROMPT',
  AI_PROGRESS: 'AI_PROGRESS',
  AI_RESULT: 'AI_RESULT',
  AI_ERROR: 'AI_ERROR'
} as const

// Standalone logger for content script (can't import modules)
type LogLevel = 'error' | 'warn' | 'info' | 'debug'
const createContentLogger = (componentName: string, logLevel: LogLevel = 'info') => {
  const LOG_LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }
  const shouldLog = (level: LogLevel): boolean => LOG_LEVELS[level] <= LOG_LEVELS[logLevel]
  const formatMessage = (level: LogLevel, ...args: any[]): any[] => {
    const timestamp = new Date().toISOString().slice(11, 23)
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${componentName}]`
    return [prefix, ...args]
  }
  return {
    error: (...args: any[]) => { if (shouldLog('error')) console.error(...formatMessage('error', ...args)) },
    warn: (...args: any[]) => { if (shouldLog('warn')) console.warn(...formatMessage('warn', ...args)) },
    info: (...args: any[]) => { if (shouldLog('info')) console.log(...formatMessage('info', ...args)) },
    debug: (...args: any[]) => { if (shouldLog('debug')) console.log(...formatMessage('debug', ...args)) },
    setLogLevel: (newLevel: LogLevel) => { logLevel = newLevel }
  }
}

// Initialize logger - will be updated with user's preference
let log = createContentLogger('AI Bridge', 'info')

// Initialize log level from user settings
async function initializeLogLevel() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_USER_SETTINGS',
      data: { keys: ['aiLogLevel'] }
    })
    if (response?.settings?.aiLogLevel) {
      const logLevel = response.settings.aiLogLevel === 'debug' ? 'debug' : 'info'
      log = createContentLogger('AI Bridge', logLevel)
      log.debug('Log level initialized:', logLevel)
    }
  } catch (error) {
    // Fallback to info level if we can't read settings
    log.warn('Failed to initialize log level, using default:', error)
  }
}

declare global {
  interface Window {
    superowserAIBridge?: boolean
  }
}

const AI_AUTOMATION_COMPLETE = 'AI_AUTOMATION_COMPLETE'

function sendToBackground(message: { type: string; data: any }): Promise<any> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(message, resolve)
  })
}

class AIBridge {
  private currentRequestId: string | null = null
  private responseObserver: MutationObserver | null = null
  private messageListener: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void
  private readonly elementPollInterval = 150
  private currentPromptNormalized: string | null = null
  private targetAssistantNode: Element | null = null
  private assistantSnapshot: Map<Element, string> = new Map()

  constructor() {
    this.messageListener = (message, _sender, sendResponse) => {
      if (!message || typeof message.type !== 'string') {
        return
      }

      if (message.type === AI_MESSAGE_TYPES.AI_EXECUTE_PROMPT) {
        const payload = message.data as AIExecutePromptRequest
        this.executePrompt(payload)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('[Superowser AI Bridge] executePrompt failed:', error)
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
          })
        return true
      }

      if (message.type === 'TEST_SELECTORS') {
        const payload = message.data as { selectors: AISelectors }
        this.testSelectors(payload.selectors)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }))
        return true
      }

      return
    }

    chrome.runtime.onMessage.addListener(this.messageListener)
    console.log('[Superowser AI Bridge] Initialized content script')
  }

  private async executePrompt(request: AIExecutePromptRequest): Promise<void> {
    this.currentRequestId = request.requestId

    // Initialize logging first
    await initializeLogLevel()

    try {
      log.info('Starting AI automation for request:', request.requestId)
      await this.sendProgressUpdate('waiting_interface', 'Locating interface elements...')

      const inputElement = await this.waitForElement<HTMLElement>(request.selectors.input, 15000)
      const formElement = inputElement ? (inputElement.closest('form') as HTMLFormElement | null) : null
      const submitButton = await this.waitForElement<HTMLElement>(request.selectors.submitButton, 15000)

      if (!inputElement) {
        await this.sendError('missing_selector', 'Could not find the ChatGPT prompt input element. The page layout may have changed.')
        return
      }

      if (!submitButton) {
        console.warn('[Superowser AI Bridge] Send button not found; will attempt to submit via keyboard.')
      }

      const authPrompt = request.selectors.authPrompt ? document.querySelector(request.selectors.authPrompt) : null
      if (authPrompt) {
        await this.sendError('auth_required', 'Please log in to ChatGPT and try again.', {
          details: { selector: request.selectors.authPrompt }
        })
        return
      }

      const primaryInput = this.findPrimaryInput(inputElement)

      this.setPromptValue(inputElement, request.prompt)
      this.currentPromptNormalized = this.normalizeText(request.prompt)

      await this.sendProgressUpdate('sending_prompt', 'Sending prompt to ChatGPT...')

      const monitoringReady = await this.setupResponseMonitoring(request.selectors)
      if (!monitoringReady) {
        console.error('[AI Bridge] Response monitoring setup failed')
        return
      }

      let sendTriggered = this.triggerEnterKey(primaryInput)

      if (!sendTriggered && submitButton) {
        await this.waitForSendButtonReady(submitButton)
        sendTriggered = this.triggerSendButton(submitButton)
      }

      if (!sendTriggered && formElement) {
        const submitted = this.submitFormDirectly(formElement)
        sendTriggered = submitted || sendTriggered
      }

      console.log('[Superowser AI Bridge] Send trigger result:', { sendTriggered, hasButton: !!submitButton, hasForm: !!formElement })

      if (!sendTriggered) {
        await this.sendError('chatgpt_error', 'Failed to trigger send action on ChatGPT interface.')
        return
      }

      await this.sendProgressUpdate('receiving_response', 'Waiting for ChatGPT to respond...')
    } catch (error) {
      await this.sendError('chatgpt_error', error instanceof Error ? error.message : 'Unknown error occurred', {
        details: error
      })
    }
  }

  private async setupResponseMonitoring(selectors: AISelectors): Promise<boolean> {
    try {

      let responseContainer = await this.waitForElement<Element>(selectors.conversationContainer, 7000)

      if (!responseContainer) {
        console.warn('[Superowser AI Bridge] Conversation container not found, falling back to main element')
        responseContainer = document.querySelector('main') || document.body
      }


      if (!responseContainer) {
        console.error('[AI Bridge] No response container available - cannot monitor responses')
        return false
      }

    if (this.responseObserver) {
      this.responseObserver.disconnect()
      this.responseObserver = null
    }

    let lastResponseLength = 0
    let responseComplete = false
    let responseTimeout: ReturnType<typeof setTimeout> | null = null
    this.targetAssistantNode = null
    let acceptedResponse = false
    let stableContentCount = 0
    let lastStableContent = ''
    let lastChangeTime = Date.now()

    this.assistantSnapshot.clear()
    this.captureAssistantSnapshot(responseContainer, selectors.responseContainer)

    const checkForResponse = () => {
      if (responseComplete) return



      if (!this.targetAssistantNode) {
        const assistantByPrompt = this.findAssistantForCurrentPrompt(responseContainer, selectors.responseContainer)

        if (assistantByPrompt) {
          this.targetAssistantNode = assistantByPrompt
          this.assistantSnapshot.set(assistantByPrompt, this.normalizeText(assistantByPrompt.textContent || ''))
        } else {
          const updatedAssistant = this.findUpdatedAssistantMessage(responseContainer, selectors.responseContainer)

          if (updatedAssistant) {
            this.targetAssistantNode = updatedAssistant
          } else {
            // Check if there are any assistant messages at all
            const allAssistants = responseContainer.querySelectorAll(selectors.responseContainer)

            // Debug: Try alternative selectors
            const altSelectors = [
              '[data-message-author-role="assistant"]',
              'article[data-testid*="conversation"]',
              'article[data-message-author-role="assistant"]',
              '.group.w-full [data-message-author-role="assistant"]',
              'div[data-testid="conversation-turn"] [data-message-author-role="assistant"]'
            ]

            for (const altSelector of altSelectors) {
              const altElements = responseContainer.querySelectorAll(altSelector)

              // If we find any assistant elements, try using the last one as a fallback
              if (altElements.length > 0) {
                const lastElement = altElements[altElements.length - 1]
                const lastContent = this.normalizeText(lastElement.textContent || '')

                if (this.hasSubstantialContent(lastContent)) {
                  this.targetAssistantNode = lastElement
                  this.assistantSnapshot.set(lastElement, lastContent)
                  break
                }
              }
            }

            if (!this.targetAssistantNode) {
              return
            }
          }
        }
      }

      const latestMessage = this.targetAssistantNode

      if (latestMessage) {
        // Try multiple methods to extract content from ChatGPT response
        let currentContent = ''

        // First, check if this is an article element or contains one
        const articleElement = latestMessage.tagName === 'ARTICLE' ? latestMessage : latestMessage.querySelector('article')

        if (articleElement) {
          currentContent = articleElement.textContent || ''
        } else {
          // Fallback to direct textContent if no article found
          currentContent = latestMessage.textContent || ''

          // If still empty, try looking for specific content containers
          if (!currentContent.trim()) {
            const contentSelectors = [
              '.markdown',
              '[data-message-content]',
              '.prose',
              'div[class*="markdown"]',
              'div[class*="message-content"]',
              'p',
              'div > div'
            ]

            for (const selector of contentSelectors) {
              const contentEl = latestMessage.querySelector(selector)
              if (contentEl && contentEl.textContent?.trim()) {
                currentContent = contentEl.textContent
                break
              }
            }
          }
        }

        const loadingIndicator = selectors.loadingIndicator ? document.querySelector(selectors.loadingIndicator) : null
        const isLoading = loadingIndicator !== null

        // Check for additional completion indicators
        const stopButton = document.querySelector('button[aria-label*="Stop"]') ||
                          document.querySelector('button[data-testid*="stop"]') ||
                          document.querySelector('button:has(svg[data-testid*="stop"])')
        const isGenerating = stopButton !== null

        // Regenerate button detection removed due to false positives

        // Copy button detection removed due to false positives

        // Action button detection removed due to false positives

        // Look for end-of-response marker (ChatGPT adds this at the end of responses)
        const endMarker = latestMessage.querySelector('div[data-edge="true"]') ||
                         latestMessage.querySelector('div[aria-hidden="true"][data-edge="true"]') ||
                         latestMessage.querySelector('div.pointer-events-none.h-px.w-px') ||
                         latestMessage.querySelector('div[class*="h-px"][class*="w-px"]')
        const hasEndMarker = endMarker !== null

        const isPlaceholder = this.isPlaceholderContent(currentContent)
        const hasSubstantial = this.hasSubstantialContent(currentContent)

        // Track content stability to detect when response stops changing
        const currentTime = Date.now()
        if (currentContent === lastStableContent) {
          stableContentCount++
        } else {
          stableContentCount = 0
          lastStableContent = currentContent
          lastChangeTime = currentTime
        }

        const contentStable = stableContentCount >= 3 // Content unchanged for 3 checks
        const timeSinceLastChange = currentTime - lastChangeTime
        const stableForTime = timeSinceLastChange > 2000 // Stable for 2+ seconds


        // Update progress and reset timeouts when content changes
        if (currentContent.length > lastResponseLength && hasSubstantial) {
          lastResponseLength = currentContent.length
          lastChangeTime = currentTime
          this.sendProgressUpdate('receiving_response', 'Receiving response...', currentContent).catch(() => {})

          if (responseTimeout) {
            clearTimeout(responseTimeout)
          }
          // Set a longer timeout when content is actively changing
          responseTimeout = setTimeout(() => {
            if (!responseComplete) {
              responseComplete = true
              acceptedResponse = true
              this.completeResponse(currentContent)
            }
          }, 10000) // 10 seconds for active responses
        }

        // Multiple conditions for detecting completion
        const completionIndicators = {
          noLoading: !isLoading,
          notGenerating: !isGenerating,
          hasEndMarker: hasEndMarker,
          contentStable: contentStable && stableForTime,
          hasContent: hasSubstantial && !isPlaceholder
        }

        log.debug('Completion indicators:', completionIndicators)

        // Complete if we have multiple strong indicators
        if (completionIndicators.hasContent && (
          // Strongest completion signals (definitive end markers)
          (completionIndicators.hasEndMarker) ||
          // Fallback signals
          (completionIndicators.notGenerating && completionIndicators.contentStable) ||
          (completionIndicators.noLoading && completionIndicators.contentStable)
        )) {
          if (!responseComplete) {
            responseComplete = true
            acceptedResponse = true
            this.completeResponse(currentContent)
          }
        } else if (currentContent && isPlaceholder) {
        } else {
        }

        this.assistantSnapshot.set(latestMessage, this.normalizeText(currentContent))
      } else {
      }

      const errorElement = selectors.errorIndicator ? document.querySelector(selectors.errorIndicator) : null
      if (errorElement) {
        const errorMessage = errorElement.textContent || 'An error occurred'
      responseComplete = true
      this.sendError('chatgpt_error', errorMessage).catch(() => {})
      return
    }
    }

    this.responseObserver = new MutationObserver(() => {
      checkForResponse()
    })

    this.responseObserver.observe(responseContainer, {
      childList: true,
      subtree: true,
      characterData: true
    })

    setTimeout(checkForResponse, 500)

    setTimeout(() => {
      if (!responseComplete) {
        responseComplete = true
        if (acceptedResponse && this.targetAssistantNode) {
          const fallbackContent = this.targetAssistantNode.textContent || ''

          // Only complete with fallback if it has substantial content
          if (this.hasSubstantialContent(fallbackContent)) {
            this.completeResponse(fallbackContent)
          } else {
            this.sendError('timeout', 'Timed out waiting for a meaningful response from ChatGPT.').catch(() => {})
          }
        } else {
          this.sendError('timeout', 'Timed out waiting for a response from ChatGPT.').catch(() => {})
        }
      }
    }, 60000)

    return true
    } catch (error) {
      console.error('[AI Bridge] Error setting up response monitoring:', error)
      return false
    }
  }

  private completeResponse(content: string) {
    if (!this.currentRequestId) return

    if (this.responseObserver) {
      this.responseObserver.disconnect()
      this.responseObserver = null
    }

    this.sendResult(content).catch(error => {
      console.error('[Superowser AI Bridge] Failed to send result:', error)
    })

    this.currentRequestId = null
    this.currentPromptNormalized = null
    this.targetAssistantNode = null
    this.assistantSnapshot.clear()
  }

  private async testSelectors(selectors: AISelectors): Promise<{ success: boolean; found: string[]; missing: string[]; details: any }> {
    const found: string[] = []
    const missing: string[] = []
    const details: any = {}

    const selectorEntries: Array<[string, string | undefined]> = [
      ['input', selectors.input],
      ['submitButton', selectors.submitButton],
      ['conversationContainer', selectors.conversationContainer],
      ['responseContainer', selectors.responseContainer],
      ['loadingIndicator', selectors.loadingIndicator],
      ['errorIndicator', selectors.errorIndicator],
      ['authPrompt', selectors.authPrompt]
    ]

    // Test each selector group
    for (const [name, selectorGroup] of selectorEntries) {
      if (!selectorGroup) continue

      // Split selector group and test each individual selector
      const individualSelectors = selectorGroup.split(', ')
      const selectorResults: any = {
        found: false,
        matchingSelectors: [],
        elementDetails: []
      }

      for (const selector of individualSelectors) {
        try {
          const element = this.querySelectorDeep(selector.trim())
          if (element) {
            selectorResults.found = true
            selectorResults.matchingSelectors.push(selector.trim())
            selectorResults.elementDetails.push({
              selector: selector.trim(),
              tagName: element.tagName,
              id: element.id,
              className: element.className,
              textContent: element.textContent?.slice(0, 100) + (element.textContent && element.textContent.length > 100 ? '...' : ''),
              attributes: this.getElementAttributes(element)
            })
          }
        } catch (error) {
          console.log(`[Selector Test] Error testing selector "${selector}":`, error)
        }
      }

      if (selectorResults.found) {
        found.push(name)
      } else {
        missing.push(name)
      }

      details[name] = selectorResults
    }

    // Log detailed results for debugging
    console.log('[Superowser AI Bridge] Selector test results:', {
      found,
      missing,
      details,
      url: window.location.href
    })

    const success = found.includes('input') && found.includes('submitButton')
    return { success, found, missing, details }
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {}
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]
      attrs[attr.name] = attr.value
    }
    return attrs
  }

  private async sendProgressUpdate(status: AIProgressUpdate['status'], message: string, partialContent?: string) {
    if (!this.currentRequestId) return

    const update: AIProgressUpdate = {
      requestId: this.currentRequestId,
      status,
      message,
      partialContent,
      timestamp: Date.now()
    }

    await sendToBackground({
      type: AI_MESSAGE_TYPES.AI_PROGRESS,
      data: update
    })
  }

  private setPromptValue(element: HTMLElement, value: string) {
    const normalizedValue = value ?? ''

    const targets = new Set<HTMLElement>()
    if (element) {
      targets.add(element)
      const descendants = element.querySelectorAll('textarea, input, [contenteditable="true"]')
      descendants.forEach(descendant => targets.add(descendant as HTMLElement))
    }

    let applied = false
    for (const target of targets) {
      applied = this.applyValueToElement(target, normalizedValue) || applied
    }

    if (!applied) {
      this.emitInputEvent(element, normalizedValue)
    }
  }

  private async waitForElement<T extends Element>(selector: string, timeout = 5000): Promise<T | null> {
    if (!selector || typeof selector !== 'string') {
      return null
    }

    const start = Date.now()

    while (Date.now() - start < timeout) {
      const element = this.querySelectorDeep(selector) as T | null
      if (element) {
        return element
      }
      await new Promise(resolve => setTimeout(resolve, this.elementPollInterval))
    }

    return this.querySelectorDeep(selector) as T | null
  }

  private async sendResult(content: string) {
    if (!this.currentRequestId) return

    const result: AIResult = {
      requestId: this.currentRequestId,
      content,
      timestamp: Date.now()
    }

    await sendToBackground({
      type: AI_MESSAGE_TYPES.AI_RESULT,
      data: result
    })

    await sendToBackground({
      type: AI_AUTOMATION_COMPLETE,
      data: { requestId: result.requestId, success: true }
    })
  }

  private applyValueToElement(element: HTMLElement, value: string): boolean {
    if (!element) return false

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus()
      element.value = value
      if (typeof element.setSelectionRange === 'function') {
        const end = value.length
        element.setSelectionRange(end, end)
      }
      this.emitInputEvent(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
      element.focus()
      element.innerHTML = ''
      const textNode = document.createTextNode(value)
      element.appendChild(textNode)

      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(element)
        range.collapse(false)
        selection.addRange(range)
      }

      this.emitInputEvent(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }

    return false
  }

  private emitInputEvent(target: EventTarget, value: string) {
    try {
      const inputEvent = new InputEvent('input', { bubbles: true, data: value })
      target.dispatchEvent(inputEvent)
    } catch {
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  private findPrimaryInput(element: HTMLElement): HTMLElement {
    if (!element) return element
    if (element.matches && element.matches('textarea, input, [contenteditable="true"]')) {
      return element
    }
    const descendant = element.querySelector('textarea, input, [contenteditable="true"]') as HTMLElement | null
    return descendant ?? element
  }

  private isSendButtonEnabled(button: HTMLElement): boolean {
    if (!button) return false

    const htmlButton = button as HTMLButtonElement
    if (typeof htmlButton.disabled === 'boolean' && htmlButton.disabled) {
      return false
    }

    const ariaDisabled = button.getAttribute('aria-disabled')
    if (ariaDisabled && ariaDisabled.toLowerCase() === 'true') {
      return false
    }

    const dataState = button.getAttribute('data-state')
    if (dataState && dataState.toLowerCase().includes('disabled')) {
      return false
    }

    return true
  }

  private async waitForSendButtonReady(button: HTMLElement): Promise<void> {
    await this.waitForCondition(() => this.isSendButtonEnabled(button), 4000)
  }

  private triggerSendButton(button: HTMLElement): boolean {
    if (!button) return false

    const events: Event[] = []
    if (typeof PointerEvent !== 'undefined') {
      try {
        events.push(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0 }))
      } catch {
        // Ignore if PointerEvent construction fails
      }
    }
    events.push(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
      new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }),
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    )

    let dispatched = false
    for (const event of events) {
      dispatched = button.dispatchEvent(event) || dispatched
    }

    return dispatched
  }

  private triggerEnterKey(target: HTMLElement): boolean {
    if (!target) return false

    const events = [
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
      new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
    ]

    let dispatched = false
    for (const event of events) {
      dispatched = target.dispatchEvent(event) || dispatched
    }

    return dispatched
  }

  private triggerFormSubmit(element: HTMLElement): boolean {
    if (!element) return false
    const form = element.closest('form')
    if (!form) return false
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    return form.dispatchEvent(submitEvent)
  }

  private submitFormDirectly(form: HTMLFormElement): boolean {
    if (!form) return false

    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit()
        return true
      }
    } catch (error) {
      console.log('[Superowser AI Bridge] form.requestSubmit failed:', error)
    }

    try {
      form.submit()
      return true
    } catch (error) {
      console.log('[Superowser AI Bridge] form.submit failed:', error)
    }

    return false
  }

  private async waitForCondition(check: () => boolean, timeout = 2000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        if (check()) {
          return true
        }
      } catch {
        // Ignore transient errors, e.g., element no longer attached yet
      }
      await new Promise(resolve => setTimeout(resolve, this.elementPollInterval))
    }
    return check()
  }

  private findAssistantForCurrentPrompt(container: Element, assistantSelector: string): Element | null {
    if (!this.currentPromptNormalized) {
      return null
    }

    const userMessages = container.querySelectorAll('[data-message-author-role="user"], [data-testid="user-turn"]')

    let matchingUser: Element | null = null

    userMessages.forEach((userNode, index) => {
      if (matchingUser) {
        return
      }
      const text = this.normalizeText(userNode.textContent || '')
      if (text && text === this.currentPromptNormalized) {
        matchingUser = userNode
      }
    })

    if (!matchingUser) {
      return null
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT)
    let foundUser = false

    while (walker.nextNode()) {
      const node = walker.currentNode as Element
      if (!foundUser) {
        if (node === matchingUser) {
          foundUser = true
        }
        continue
      }

      if (assistantSelector && node.matches(assistantSelector)) {
        return node
      }

      if (node.matches('[data-message-author-role="assistant"]')) {
        return node
      }
    }

    return null
  }

  private normalizeText(value: string | undefined | null): string {
    if (!value) {
      return ''
    }
    return value.replace(/\s+/g, ' ').trim()
  }

  private isPlaceholderContent(content: string): boolean {

    if (!content || content.trim().length === 0) {
      return true
    }

    const normalizedContent = content.toLowerCase().trim()

    // If content has substantial length (>100 chars), it's likely real content even if it starts with a prefix
    if (content.trim().length > 100) {

      // Check if it's ONLY the prefix with no meaningful content after
      const prefixOnlyPatterns = [
        /^chatgpt said:\s*$/i,
        /^assistant said:\s*$/i,
        /^thinking\.\.\.\s*$/i,
        /^generating response\.\.\.\s*$/i,
        /^please wait\.\.\.\s*$/i,
        /^loading\.\.\.\s*$/i,
        /^\.\.\.\s*$/i,
        /^typing\.\.\.\s*$/i
      ]

      // If it matches a prefix-only pattern, it's a placeholder
      for (const pattern of prefixOnlyPatterns) {
        if (pattern.test(content.trim())) {
          return true
        }
      }

      // If it has substantial content after the prefix, it's real content
      return false
    }

    // For shorter content, use the original strict checking
    const placeholderPatterns = [
      'chatgpt said:',
      'chatgpt said',
      'assistant said:',
      'assistant said',
      'thinking...',
      'generating response...',
      'please wait...',
      'loading...',
      '...',
      'typing...'
    ]

    // Check if content is just a placeholder
    for (const pattern of placeholderPatterns) {
      if (normalizedContent === pattern || normalizedContent.startsWith(pattern)) {
        return true
      }
    }

    // Check if content is too short to be a meaningful response (less than 10 characters)
    if (content.trim().length < 10) {
      return true
    }

    return false
  }

  private hasSubstantialContent(content: string): boolean {

    if (!content) {
      return false
    }

    const trimmed = content.trim()

    // Must have at least 15 characters of meaningful content
    if (trimmed.length < 15) {
      return false
    }

    // Must not be a placeholder
    const isPlaceholder = this.isPlaceholderContent(content)
    if (isPlaceholder) {
      return false
    }

    // Check for actual sentences or meaningful content
    // At least one word longer than 3 characters or multiple words
    const words = trimmed.split(/\s+/).filter(word => word.length > 0)

    if (words.length === 0) {
      return false
    }

    // Has either one substantial word (>3 chars) or multiple words
    const hasSubstantialWord = words.some(word => word.length > 3)
    const hasMultipleWords = words.length > 1


    return hasSubstantialWord || hasMultipleWords
  }

  private captureAssistantSnapshot(container: Element, assistantSelector: string): void {
    try {
      const nodes = container.querySelectorAll(assistantSelector || '[data-message-author-role="assistant"]')
      nodes.forEach(node => {
        this.assistantSnapshot.set(node, this.normalizeText(node.textContent || ''))
      })
    } catch (error) {
      console.log('[Superowser AI Bridge] captureAssistantSnapshot failed:', error)
    }
  }

  private findUpdatedAssistantMessage(container: Element, assistantSelector: string): Element | null {
    try {
      const selector = assistantSelector || '[data-message-author-role="assistant"]'
      const nodes = container.querySelectorAll(selector)

      for (const node of nodes) {
        const normalized = this.normalizeText(node.textContent || '')

        if (!this.assistantSnapshot.has(node)) {
          this.assistantSnapshot.set(node, normalized)
          return node
        }

        const previous = this.assistantSnapshot.get(node)
        if (normalized && normalized !== previous) {
          this.assistantSnapshot.set(node, normalized)
          return node
        }
      }
    } catch (error) {
      console.log('[Superowser AI Bridge] findUpdatedAssistantMessage failed:', error)
    }

    return null
  }

  private querySelectorDeep(selector: string): Element | null {
    try {
      const directMatch = document.querySelector(selector)
      if (directMatch) {
        return directMatch
      }

      const visited = new Set<Node>()
      const queue: Array<ParentNode> = []

      const enqueueShadowHosts = (root: ParentNode) => {
        const elements = root instanceof Document || root instanceof ShadowRoot
          ? Array.from(root.querySelectorAll('*'))
          : []
        for (const element of elements) {
          if (visited.has(element)) continue
          visited.add(element)

          if (element.shadowRoot) {
            const shadowMatch = element.shadowRoot.querySelector(selector)
            if (shadowMatch) {
              return shadowMatch
            }
            queue.push(element.shadowRoot)
          }

          if (element instanceof HTMLIFrameElement) {
            try {
              const frameDoc = element.contentDocument || element.contentWindow?.document
              if (frameDoc && !visited.has(frameDoc)) {
                visited.add(frameDoc)
                const frameMatch = frameDoc.querySelector(selector)
                if (frameMatch) {
                  return frameMatch
                }
                queue.push(frameDoc)
              }
            } catch {
              // Cross-origin frame - ignore
            }
          }
        }
        return null
      }

      queue.push(document)
      visited.add(document)

      while (queue.length > 0) {
        const root = queue.shift()
        if (!root) continue

        const rootMatch = root.querySelector?.(selector as any)
        if (rootMatch) {
          return rootMatch as Element
        }

        const shadowResult = enqueueShadowHosts(root)
        if (shadowResult) {
          return shadowResult
        }
      }
    } catch (error) {
      console.log('[Superowser AI Bridge] querySelectorDeep failed:', error)
    }

    return null
  }

  private async sendError(reason: AIError['reason'], message: string, extra?: Partial<AIError>) {
    if (!this.currentRequestId) return

    const error: AIError = {
      requestId: this.currentRequestId,
      reason,
      message,
      ...extra
    }

    console.error('[Superowser AI Bridge] sendError:', { reason, message, extra })

    await sendToBackground({
      type: AI_MESSAGE_TYPES.AI_ERROR,
      data: error
    })
  }

  destroy() {
    if (this.responseObserver) {
      this.responseObserver.disconnect()
      this.responseObserver = null
    }

    chrome.runtime.onMessage.removeListener(this.messageListener)
  }
}

function bootstrapBridge() {
  const bridgeInstance = new AIBridge()

  window.addEventListener('beforeunload', () => {
    bridgeInstance.destroy()
  })
}

(function initializeBridge() {
  if (window.superowserAIBridge) {
    console.log('[Superowser AI Bridge] Script already active, skipping bootstrap')
  } else {
    window.superowserAIBridge = true
    bootstrapBridge()
  }
})()
