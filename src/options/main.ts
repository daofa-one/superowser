import './style.css'

type UserSettings = {
  preferredSearchEngine?: string
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
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement | null

if (!engineSelect) {
  throw new Error('Search engine select element not found')
}

const showStatus = (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
  if (!statusMessage) return
  statusMessage.textContent = message
  statusMessage.dataset.tone = tone
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
  } catch (error) {
    console.error('[Options] Failed to load settings:', error)
    showStatus('Could not load settings. Using defaults.', 'error')
    engineSelect.value = 'google'
  }
}

const persistSettings = async (engine: string) => {
  try {
    await sendMessage<UserSettings>({
      type: 'UPDATE_USER_SETTINGS',
      data: { preferredSearchEngine: engine }
    })
    showStatus(`Saved. /search will use ${engine} by default.`, 'success')
  } catch (error) {
    console.error('[Options] Failed to save settings:', error)
    showStatus('Failed to save setting. Please try again.', 'error')
  }
}

engineSelect.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value
  persistSettings(value)
})

loadSettings()
