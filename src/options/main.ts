import './style.css'

type UserSettings = {
  preferredSearchEngine?: string
  preferredAiProvider?: string
  reuseAiTab?: boolean
}

type SuccessResponse<T> = {
  type: 'SUCCESS'
  data: T
}

type ErrorResponse = {
  type: 'ERROR'
  error: { message: string }
}

type RuntimeResponse<T> = SuccessResponse<T> | ErrorResponse

const engineSelect = document.getElementById('search-engine-select') as HTMLSelectElement | null
const engineStatusMessage = document.getElementById('search-status-message') as HTMLParagraphElement | null
const aiSelect = document.getElementById('ai-provider-select') as HTMLSelectElement | null
const aiStatusMessage = document.getElementById('ai-status-message') as HTMLParagraphElement | null
const aiReuseToggle = document.getElementById('ai-reuse-toggle') as HTMLInputElement | null

if (!engineSelect) {
  throw new Error('Search engine select element not found')
}

if (!aiSelect) {
  throw new Error('AI provider select element not found')
}

if (!aiReuseToggle) {
  throw new Error('AI tab reuse toggle element not found')
}

const showStatus = (element: HTMLParagraphElement | null, message: string, tone: 'info' | 'success' | 'error' = 'info') => {
  if (!element) return
  element.textContent = message
  element.dataset.tone = tone
}

const sendMessage = async <T>(request: any): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: RuntimeResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!response) {
        reject(new Error('No response from background'))
        return
      }

      if (response.type === 'ERROR') {
        reject(new Error(response.error?.message || 'Request failed'))
      } else {
        resolve(response.data)
      }
    })
  })
}

const loadSettings = async () => {
  try {
    const settings = await sendMessage<UserSettings>({ type: 'GET_USER_SETTINGS' })
    const preferred = (settings.preferredSearchEngine || 'google').toLowerCase()
    engineSelect.value = ['google', 'duckduckgo', 'bing'].includes(preferred) ? preferred : 'google'

    const preferredAi = (settings.preferredAiProvider || 'chatgpt').toLowerCase()
    aiSelect.value = ['chatgpt', 'claude', 'perplexity', 'copilot', 'gemini'].includes(preferredAi)
      ? preferredAi
      : 'chatgpt'

    aiReuseToggle.checked = settings.reuseAiTab !== false
  } catch (error) {
    console.error('[Options] Failed to load settings:', error)
    showStatus(engineStatusMessage, 'Could not load settings. Using defaults.', 'error')
    engineSelect.value = 'google'
    showStatus(aiStatusMessage, 'Could not load assistant setting. Using ChatGPT.', 'error')
    aiSelect.value = 'chatgpt'
    aiReuseToggle.checked = true
  }
}

const persistSettings = async (engine: string) => {
  try {
    await sendMessage<UserSettings>({
      type: 'UPDATE_USER_SETTINGS',
      data: { preferredSearchEngine: engine }
    })
    showStatus(engineStatusMessage, `Saved. /search will use ${engine} by default.`, 'success')
  } catch (error) {
    console.error('[Options] Failed to save settings:', error)
    showStatus(engineStatusMessage, 'Failed to save setting. Please try again.', 'error')
  }
}

engineSelect.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value
  persistSettings(value)
})

const persistAiProvider = async (provider: string) => {
  try {
    await sendMessage<UserSettings>({
      type: 'UPDATE_USER_SETTINGS',
      data: { preferredAiProvider: provider }
    })
    const label = provider.charAt(0).toUpperCase() + provider.slice(1)
    showStatus(aiStatusMessage, `Saved. /ai will open ${label}.`, 'success')
  } catch (error) {
    console.error('[Options] Failed to save AI provider:', error)
    showStatus(aiStatusMessage, 'Failed to save assistant. Please try again.', 'error')
  }
}

aiSelect.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value
  persistAiProvider(value)
})

const persistAiReuse = async (reuse: boolean) => {
  try {
    await sendMessage<UserSettings>({
      type: 'UPDATE_USER_SETTINGS',
      data: { reuseAiTab: reuse }
    })
    const message = reuse
      ? 'Saved. /ai will reuse an existing assistant tab when available.'
      : 'Saved. /ai will always open a new assistant tab.'
    showStatus(aiStatusMessage, message, 'success')
  } catch (error) {
    console.error('[Options] Failed to save AI tab behaviour:', error)
    showStatus(aiStatusMessage, 'Failed to update tab behaviour. Please try again.', 'error')
  }
}

aiReuseToggle.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement
  persistAiReuse(target.checked)
})

loadSettings()
