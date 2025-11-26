/**
 * Constants for background service worker
 * Extracted from hardcoded values throughout the codebase
 */

export const TIMING = {
  /** Wait time for AI content script injection */
  AI_INJECTION_WAIT_MS: 1000,

  /** Timeout for AI automation operations */
  AI_TIMEOUT_MS: 30000,

  /** Debounce delay for search input */
  SEARCH_DEBOUNCE_MS: 200,

  /** Wait before auto-closing AI tab after success */
  AI_AUTO_CLOSE_DELAY_MS: 2000,

  /** Retry backoff base (multiplied by attempt number) */
  RETRY_BACKOFF_MS: 100
} as const

export const LIMITS = {
  /** Maximum number of omnibox suggestions to show */
  MAX_OMNIBOX_SUGGESTIONS: 6,

  /** Maximum recent pages to fetch */
  MAX_RECENT_PAGES: 20,

  /** Maximum notes to fetch in getAll */
  MAX_NOTES_FETCH: 1000,

  /** Default search results limit */
  DEFAULT_SEARCH_LIMIT: 20
} as const

export const MESSAGES = {
  /** Error messages */
  NO_ACTIVE_TAB: 'No active tab found',
  AI_AUTOMATION_DISABLED: 'AI automation is disabled',
  TAB_LOADING_TIMEOUT: 'Tab loading timeout',
  AI_BRIDGE_NOT_FOUND: 'AI bridge not found after injection',
  MESSAGE_TIMEOUT: 'Message timeout',
  UNKNOWN_MESSAGE_TYPE: 'Unknown message type',
  INVALID_MESSAGE_FORMAT: 'Invalid message format',

  /** Info messages */
  EXTENSION_INSTALLED: '[superowser] installed',
  BACKGROUND_STORE_INITIALIZED: '[superowser] Background store initialized',
  BACKGROUND_STORE_INIT_FAILED: '[superowser] Failed to initialize background store'
} as const

export const AI_PROVIDERS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  PERPLEXITY: 'perplexity'
} as const

export const AI_PROVIDER_URLS = {
  [AI_PROVIDERS.CHATGPT]: 'https://chatgpt.com',
  [AI_PROVIDERS.CLAUDE]: 'https://claude.ai',
  [AI_PROVIDERS.PERPLEXITY]: 'https://www.perplexity.ai'
} as const

export const RETRY_CONFIG = {
  /** Default number of retries for failed operations */
  DEFAULT_RETRIES: 2,

  /** Default timeout for async operations (ms) */
  DEFAULT_TIMEOUT_MS: 5000
} as const

/**
 * Extension contexts - helps identify where messages come from
 */
export const EXTENSION_CONTEXTS = {
  BACKGROUND: 'background',
  SIDEPANEL: 'sidepanel',
  CONTENT: 'content',
  OMNIBOX: 'omnibox',
  CHATBOX: 'chatbox'
} as const

export type ExtensionContext = typeof EXTENSION_CONTEXTS[keyof typeof EXTENSION_CONTEXTS]
