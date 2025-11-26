/**
 * AI automation message types and interfaces
 */

// AI Request Types
export interface AIRunPromptRequest {
  prompt: string
  context?: {
    currentTask?: string
    documentTitle?: string
    selectedText?: string
  }
  options?: {
    temperature?: number
    maxTokens?: number
    model?: string
  }
}

export interface AIExecutePromptRequest {
  prompt: string
  selectors: AISelectors
  requestId: string
}

// AI Response Types
export interface AIProgressUpdate {
  requestId: string
  status: 'opening_tab' | 'injecting_script' | 'sending_prompt' | 'waiting_response' | 'receiving_response'
  message: string
  partialContent?: string
  timestamp: number
}

export interface AIResult {
  requestId: string
  content: string
  metadata?: {
    model?: string
    tokensUsed?: number
    responseTime?: number
  }
  timestamp: number
}

export interface AIError {
  requestId: string
  reason: 'missing_selector' | 'auth_required' | 'rate_limited' | 'network_error' | 'chatgpt_error' | 'timeout' | 'content_policy_violation'
  message: string
  details?: any
  suggestedAction?: {
    type: 'override_selectors' | 'open_chatgpt' | 'retry' | 'contact_support'
    data?: any
  }
}

// AI Configuration
export interface AISelectors {
  input: string
  submitButton: string
  responseContainer: string
  conversationContainer: string
  loadingIndicator?: string
  errorIndicator?: string
  authPrompt?: string
}

export interface AIAutomationSettings {
  enabled: boolean
  reuseTab: boolean
  hiddenMode: boolean // When true, AI tab runs in background without focus
  autoCloseTab: boolean // When true, closes AI tab after successful automation
  timeout: number
  retryAttempts: number
  selectors: AISelectors
  provider: 'chatgpt' | 'claude' | 'perplexity'
}

// Default selectors for ChatGPT
export const DEFAULT_CHATGPT_SELECTORS: AISelectors = {
  input: [
    // Primary current selectors (2024/2025)
    'textarea[placeholder*="Message ChatGPT"]',
    'textarea[placeholder*="Message"]',
    'div[contenteditable="true"][data-testid="prompt-textarea"]',
    'div[contenteditable="true"]#prompt-textarea',
    // Fallback selectors
    '#prompt-textarea',
    '#prompt-textarea textarea',
    '#prompt-textarea div[contenteditable="true"]',
    'textarea[data-testid="prompt-textarea"]',
    'textarea[data-testid="composer-textarea"]',
    'div[data-testid="prompt-input"] div[contenteditable="true"]',
    'div[data-testid="prompt-textarea"] div[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="prompt-input"]',
    // Generic fallbacks
    'textarea[placeholder*="Type a message"]',
    'div[contenteditable="true"][placeholder*="Type"]'
  ].join(', '),
  submitButton: [
    // Primary current selectors
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'form button[type="submit"]',
    // Alternative selectors
    'button[aria-label*="Send message"]',
    'button[aria-label*="Send"]',
    'button svg[data-testid="send-button-icon"]',
    // Fallback selectors
    '#composer-submit-button',
    '#composer-submit-button button',
    'button[data-testid="composer-send-button"]',
    'div[data-testid="composer-send-button"] button',
    'button[aria-label*="Submit"]',
    'button[type="submit"]',
    // Generic pattern matching
    'form button:last-child'
  ].join(', '),
  responseContainer: [
    // Article-based patterns (most reliable)
    'article[data-testid*="conversation"]',
    'article[data-message-author-role="assistant"]',
    'article[data-testid="conversation-turn"]',
    // Current patterns with data-message-author-role
    '[data-message-author-role="assistant"]',
    'div[data-testid="conversation-turn-3"] [data-message-author-role="assistant"]',
    '[data-testid="conversation-turn"] div[data-message-author-role="assistant"]',
    // Alternative patterns
    '.group.w-full[data-testid*="conversation"] [data-message-author-role="assistant"]',
    'div[data-message-author-role="assistant"]'
  ].join(', '),
  conversationContainer: [
    // Current main containers
    'main',
    'div[role="main"]',
    'main div[data-testid="conversation-turns"]',
    'main [data-testid="conversation"]',
    'main div[data-testid="conversation"]',
    // Fallback patterns
    '.conversation',
    'div.flex.flex-col.pb-9',
    'div[data-testid*="conversation"]'
  ].join(', '),
  loadingIndicator: [
    '[data-testid="conversation-turn"] [data-testid="spinner"]',
    '[data-testid="free-reply-spinner"]',
    '.result-thinking',
    '.loading',
    'svg[data-testid="loading-spinner"]',
    '.animate-spin',
    'button[aria-label*="Stop"]',
    'button[data-testid*="stop"]',
    'button:has(svg[data-testid*="stop"])',
    '[data-testid*="streaming"]',
    '[data-testid*="generating"]'
  ].join(', '),
  errorIndicator: [
    '.error-message',
    '[role="alert"]',
    '[data-testid="error-message"]',
    '.text-red-500',
    '.bg-red-50',
    'div[data-testid*="error"]'
  ].join(', '),
  authPrompt: [
    '.auth-required',
    '.login-required',
    '[data-testid="login-button"]',
    'button[data-testid="sign-in-button"]',
    'a[href*="auth"]',
    'button[aria-label*="Log in"]',
    'button[aria-label*="Sign in"]',
    'a[href*="login"]',
    'a[href*="signin"]'
  ].join(', ')
}

// Message type constants
export const AI_MESSAGE_TYPES = {
  // Requests
  AI_RUN_PROMPT: 'AI_RUN_PROMPT',
  AI_EXECUTE_PROMPT: 'AI_EXECUTE_PROMPT',
  AI_GET_SETTINGS: 'AI_GET_SETTINGS',
  AI_UPDATE_SETTINGS: 'AI_UPDATE_SETTINGS',
  AI_UPDATE_SELECTORS: 'AI_UPDATE_SELECTORS',
  AI_TEST_SELECTORS: 'AI_TEST_SELECTORS',

  // Responses/Broadcasts
  AI_PROGRESS: 'AI_PROGRESS',
  AI_RESULT: 'AI_RESULT',
  AI_ERROR: 'AI_ERROR',
  AI_SETTINGS_UPDATED: 'AI_SETTINGS_UPDATED',
  AI_AUTOMATION_COMPLETE: 'AI_AUTOMATION_COMPLETE'
} as const

export type AIMessageType = typeof AI_MESSAGE_TYPES[keyof typeof AI_MESSAGE_TYPES]

// Helper function to create default AI settings
export function getDefaultAISettings(): AIAutomationSettings {
  return {
    enabled: true,
    reuseTab: true,
    hiddenMode: true, // Default to hidden mode for better UX
    autoCloseTab: false, // Don't auto-close by default (user might want to see result)
    timeout: 30000, // 30 seconds
    retryAttempts: 2,
    selectors: DEFAULT_CHATGPT_SELECTORS,
    provider: 'chatgpt'
  }
}
