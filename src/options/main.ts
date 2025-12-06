import './style.css'

type VersionManagementSettings = {
  autoSave: {
    enabled: boolean
    interval: number
    mode: 'content_change' | 'time_based' | 'smart'
    contentThreshold: number
    smartTriggers: {
      significantEdits: boolean
      milestoneMarkers: boolean
      beforeSave: boolean
      periodically: boolean
      beforeClose: boolean
    }
  }
  storage: {
    maxVersionsPerDocument: number
    autoCleanup: {
      enabled: boolean
      strategy: 'count' | 'age' | 'smart'
      keepCount: number
      maxAgeHours: number
      smartRetention: {
        keepMilestones: boolean
        keepBranches: boolean
        keepTagged: boolean
        keepRecent: number
      }
    }
    compressionEnabled: boolean
    deduplicationEnabled: boolean
  }
  ui: {
    showVersionCount: boolean
    showLastModified: boolean
    defaultVersionView: 'list' | 'timeline' | 'tree'
    enableQuickRestore: boolean
    showDiffPreview: boolean
    groupByDate: boolean
    enableKeyboardShortcuts: boolean
  }
  advanced: {
    enableVersionBranching: boolean // Future feature - UI not yet implemented
    enableSemanticTags: boolean
    autoTagging: {
      enabled: boolean
      detectMilestones: boolean
      detectBreakingChanges: boolean
      customPatterns: string[]
    }
    exportFormats: string[]
    enableAuditTrail: boolean
    enableCollaboration: boolean
  }
}

type ShortcutConfig = {
  command: string
  parameters: string
  autoExecute: boolean
  enabled: boolean
}

type CustomButtonConfig = {
  id: string
  label: string
  icon: string
  command: string
  parameters: string
  autoExecute: boolean
  position: number
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

type LogLevelSettings = {
  background: LogLevel
  'business-logic': LogLevel
  commands: LogLevel
  ai: LogLevel
  ui: LogLevel
  authoring: LogLevel
  infrastructure: LogLevel
  'content-scripts': LogLevel
}

type UserSettings = {
  preferredSearchEngine?: string
  preferredAiProvider?: string
  reuseAiTab?: boolean
  aiHiddenMode?: boolean
  logLevels?: LogLevelSettings
  versionManagement?: VersionManagementSettings
  shortcuts?: {
    tasks: ShortcutConfig
    save: ShortcutConfig
    notes: ShortcutConfig
    search: ShortcutConfig
    ai: ShortcutConfig
  }
  customButtons?: CustomButtonConfig[]
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

// Logging Elements
const loggingToggle = document.getElementById('logging-toggle') as HTMLDivElement | null
const loggingContent = document.getElementById('logging-content') as HTMLDivElement | null
const logLevelGlobal = document.getElementById('log-level-global') as HTMLSelectElement | null
const logLevelBackground = document.getElementById('log-level-background') as HTMLSelectElement | null
const logLevelBusinessLogic = document.getElementById('log-level-business-logic') as HTMLSelectElement | null
const logLevelCommands = document.getElementById('log-level-commands') as HTMLSelectElement | null
const logLevelAi = document.getElementById('log-level-ai') as HTMLSelectElement | null
const logLevelUi = document.getElementById('log-level-ui') as HTMLSelectElement | null
const logLevelAuthoring = document.getElementById('log-level-authoring') as HTMLSelectElement | null
const logLevelInfrastructure = document.getElementById('log-level-infrastructure') as HTMLSelectElement | null
const logLevelContentScripts = document.getElementById('log-level-content-scripts') as HTMLSelectElement | null
const resetLogLevels = document.getElementById('reset-log-levels') as HTMLButtonElement | null
const loggingStatusMessage = document.getElementById('logging-status-message') as HTMLParagraphElement | null

// Shortcut Elements
const shortcuts = ['tasks', 'save', 'notes', 'search', 'ai'] as const
const shortcutElements: Record<string, {
  enabled: HTMLInputElement | null
  command: HTMLSelectElement | null
  parameters: HTMLInputElement | null
  autoExecute: HTMLInputElement | null
}> = {}

shortcuts.forEach(id => {
  shortcutElements[id] = {
    enabled: document.getElementById(`shortcut-${id}-enabled`) as HTMLInputElement | null,
    command: document.getElementById(`shortcut-${id}-command`) as HTMLSelectElement | null,
    parameters: document.getElementById(`shortcut-${id}-parameters`) as HTMLInputElement | null,
    autoExecute: document.getElementById(`shortcut-${id}-autoexecute`) as HTMLInputElement | null
  }
})

const shortcutsStatusMessage = document.getElementById('shortcuts-status-message') as HTMLParagraphElement | null

// Version Management Elements
const versionAutoSaveEnabled = document.getElementById('version-auto-save-enabled') as HTMLInputElement | null
const versionAutoSaveInterval = document.getElementById('version-auto-save-interval') as HTMLSelectElement | null
const versionAutoSaveMode = document.getElementById('version-auto-save-mode') as HTMLSelectElement | null
const versionMaxVersions = document.getElementById('version-max-versions') as HTMLSelectElement | null
const versionAutoCleanupEnabled = document.getElementById('version-auto-cleanup-enabled') as HTMLInputElement | null
const versionCleanupStrategy = document.getElementById('version-cleanup-strategy') as HTMLSelectElement | null
const versionShowCount = document.getElementById('version-show-count') as HTMLInputElement | null
const versionShowLastModified = document.getElementById('version-show-last-modified') as HTMLInputElement | null
const versionEnableShortcuts = document.getElementById('version-enable-shortcuts') as HTMLInputElement | null
const versionEnableTagging = document.getElementById('version-enable-tagging') as HTMLInputElement | null
const versionEnableCompression = document.getElementById('version-enable-compression') as HTMLInputElement | null
const versionStatusMessage = document.getElementById('version-status-message') as HTMLParagraphElement | null

// Storage impact elements
const sizePerDocument = document.getElementById('size-per-document') as HTMLSpanElement | null
const recommendedMaxDocs = document.getElementById('recommended-max-docs') as HTMLSpanElement | null
const storageWarnings = document.getElementById('storage-warnings') as HTMLDivElement | null

// Preset buttons
const presetConservative = document.getElementById('preset-conservative') as HTMLButtonElement | null
const presetPowerUser = document.getElementById('preset-power-user') as HTMLButtonElement | null
const presetMinimal = document.getElementById('preset-minimal') as HTMLButtonElement | null

// Conditional options containers
const autoSaveOptions = document.getElementById('auto-save-options') as HTMLDivElement | null
const autoSaveModeField = document.getElementById('auto-save-mode-field') as HTMLDivElement | null
const autoCleanupOptions = document.getElementById('auto-cleanup-options') as HTMLDivElement | null

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

    // Load basic settings
    const preferred = (settings.preferredSearchEngine || 'google').toLowerCase()
    engineSelect.value = ['google', 'duckduckgo', 'bing'].includes(preferred) ? preferred : 'google'

    const preferredAi = (settings.preferredAiProvider || 'chatgpt').toLowerCase()
    aiSelect.value = ['chatgpt', 'claude', 'perplexity', 'copilot', 'gemini'].includes(preferredAi)
      ? preferredAi
      : 'chatgpt'

    aiReuseToggle.checked = settings.reuseAiTab !== false

    // Load logging settings
    loadLogLevels(settings)

    // Load shortcut settings
    await loadAvailableCommands()
    loadShortcutSettings(settings.shortcuts)

    // Load custom buttons
    try {
      loadCustomButtons(settings.customButtons)
    } catch (error) {
      console.error('[Options] Failed to load custom buttons:', error)
      loadCustomButtons([]) // Load with empty array as fallback
    }

    // Load version management settings
    loadVersionManagementSettings(settings.versionManagement)
    updateStorageImpact(settings.versionManagement)
  } catch (error) {
    console.error('[Options] Failed to load settings:', error)
    showStatus(engineStatusMessage, 'Could not load settings. Using defaults.', 'error')
    engineSelect.value = 'google'
    showStatus(aiStatusMessage, 'Could not load assistant setting. Using ChatGPT.', 'error')
    aiSelect.value = 'chatgpt'
    aiReuseToggle.checked = true

    // Load defaults for logging
    loadLogLevels()

    // Load defaults for shortcuts
    await loadAvailableCommands()
    loadShortcutSettings()

    loadVersionManagementSettings() // Load defaults
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

// Logging Functions
const getDefaultLogLevels = (): LogLevelSettings => ({
  background: 'error',
  'business-logic': 'error',
  commands: 'error',
  ai: 'error',
  ui: 'error',
  authoring: 'error',
  infrastructure: 'error',
  'content-scripts': 'error'
})

const loadLogLevels = (settings?: UserSettings) => {
  const logLevels = settings?.logLevels || getDefaultLogLevels()

  if (logLevelBackground) logLevelBackground.value = logLevels.background
  if (logLevelBusinessLogic) logLevelBusinessLogic.value = logLevels['business-logic']
  if (logLevelCommands) logLevelCommands.value = logLevels.commands
  if (logLevelAi) logLevelAi.value = logLevels.ai
  if (logLevelUi) logLevelUi.value = logLevels.ui
  if (logLevelAuthoring) logLevelAuthoring.value = logLevels.authoring
  if (logLevelInfrastructure) logLevelInfrastructure.value = logLevels.infrastructure
  if (logLevelContentScripts) logLevelContentScripts.value = logLevels['content-scripts']
}

const saveLogLevels = async () => {
  try {
    const logLevels: LogLevelSettings = {
      background: (logLevelBackground?.value as LogLevel) || 'error',
      'business-logic': (logLevelBusinessLogic?.value as LogLevel) || 'error',
      commands: (logLevelCommands?.value as LogLevel) || 'error',
      ai: (logLevelAi?.value as LogLevel) || 'error',
      ui: (logLevelUi?.value as LogLevel) || 'error',
      authoring: (logLevelAuthoring?.value as LogLevel) || 'error',
      infrastructure: (logLevelInfrastructure?.value as LogLevel) || 'error',
      'content-scripts': (logLevelContentScripts?.value as LogLevel) || 'error'
    }

    await sendMessage({
      type: 'UPDATE_LOG_LEVELS',
      data: { logLevels }
    })

    showStatus(loggingStatusMessage, 'Saved. Reload extension to apply log level changes.', 'success')
  } catch (error) {
    console.error('[Options] Failed to save log levels:', error)
    showStatus(loggingStatusMessage, 'Failed to save log levels. Please try again.', 'error')
  }
}

// Collapsible toggle
if (loggingToggle && loggingContent) {
  loggingToggle.addEventListener('click', () => {
    const isExpanded = loggingContent.style.display !== 'none'
    loggingContent.style.display = isExpanded ? 'none' : 'block'

    const toggleIcon = loggingToggle.querySelector('.toggle-icon')
    if (toggleIcon) {
      toggleIcon.textContent = isExpanded ? '▶' : '▼'
    }

    const toggleLabel = loggingToggle.querySelector('.toggle-label')
    if (toggleLabel) {
      toggleLabel.textContent = isExpanded ? 'Show Logging Configuration' : 'Hide Logging Configuration'
    }
  })
}

// Global level setter
if (logLevelGlobal) {
  logLevelGlobal.addEventListener('change', async (event) => {
    const target = event.target as HTMLSelectElement
    const globalLevel = target.value as LogLevel

    if (!globalLevel) return // Empty option selected

    // Set all category dropdowns to the global level
    if (logLevelBackground) logLevelBackground.value = globalLevel
    if (logLevelBusinessLogic) logLevelBusinessLogic.value = globalLevel
    if (logLevelCommands) logLevelCommands.value = globalLevel
    if (logLevelAi) logLevelAi.value = globalLevel
    if (logLevelUi) logLevelUi.value = globalLevel
    if (logLevelAuthoring) logLevelAuthoring.value = globalLevel
    if (logLevelInfrastructure) logLevelInfrastructure.value = globalLevel
    if (logLevelContentScripts) logLevelContentScripts.value = globalLevel

    // Save the changes
    await saveLogLevels()

    // Reset global dropdown to placeholder
    target.value = ''
  })
}

// Individual category dropdowns
const categoryDropdowns = [
  logLevelBackground,
  logLevelBusinessLogic,
  logLevelCommands,
  logLevelAi,
  logLevelUi,
  logLevelAuthoring,
  logLevelInfrastructure,
  logLevelContentScripts
]

categoryDropdowns.forEach(dropdown => {
  if (dropdown) {
    dropdown.addEventListener('change', saveLogLevels)
  }
})

// Reset button
if (resetLogLevels) {
  resetLogLevels.addEventListener('click', async () => {
    if (!confirm('Reset all log levels to ERROR (production default)?')) return

    const defaults = getDefaultLogLevels()

    if (logLevelBackground) logLevelBackground.value = defaults.background
    if (logLevelBusinessLogic) logLevelBusinessLogic.value = defaults['business-logic']
    if (logLevelCommands) logLevelCommands.value = defaults.commands
    if (logLevelAi) logLevelAi.value = defaults.ai
    if (logLevelUi) logLevelUi.value = defaults.ui
    if (logLevelAuthoring) logLevelAuthoring.value = defaults.authoring
    if (logLevelInfrastructure) logLevelInfrastructure.value = defaults.infrastructure
    if (logLevelContentScripts) logLevelContentScripts.value = defaults['content-scripts']

    await saveLogLevels()
  })
}

// Shortcut Management Functions
const getDefaultShortcuts = () => ({
  tasks: { command: '/tasks', parameters: '', autoExecute: true, enabled: true },
  save: { command: '/save', parameters: '', autoExecute: false, enabled: true },
  notes: { command: '/notes', parameters: '', autoExecute: false, enabled: true },
  search: { command: '/find', parameters: '', autoExecute: false, enabled: true },
  ai: { command: '/ai', parameters: '', autoExecute: false, enabled: true }
})

const loadAvailableCommands = async () => {
  try {
    const commands = await sendMessage<Array<{ name: string; command: string; description: string; category: string }>>({
      type: 'GET_AVAILABLE_COMMANDS'
    })

    const commandOptions = commands.map(cmd =>
      `<option value="${cmd.command}">${cmd.command} - ${cmd.description}</option>`
    ).join('')

    // Populate shortcut command dropdowns
    shortcuts.forEach(id => {
      const select = shortcutElements[id]?.command
      if (!select) return
      select.innerHTML = commandOptions
    })

    // Populate custom button command dropdown
    if (customButtonCommand) {
      customButtonCommand.innerHTML = commandOptions
    }
  } catch (error) {
    console.error('[Options] Failed to load available commands:', error)
  }
}

const loadShortcutSettings = async (settings?: UserSettings['shortcuts']) => {
  const config = settings || getDefaultShortcuts()

  shortcuts.forEach(id => {
    const elements = shortcutElements[id]
    const cfg = config[id]

    if (!elements || !cfg) return

    if (elements.enabled) elements.enabled.checked = cfg.enabled
    if (elements.command) elements.command.value = cfg.command
    if (elements.parameters) elements.parameters.value = cfg.parameters
    if (elements.autoExecute) elements.autoExecute.checked = cfg.autoExecute
  })
}

const saveShortcutSettings = async () => {
  try {
    const config: UserSettings['shortcuts'] = {
      tasks: {
        command: shortcutElements.tasks.command?.value || '/tasks',
        parameters: shortcutElements.tasks.parameters?.value || '',
        autoExecute: shortcutElements.tasks.autoExecute?.checked ?? true,
        enabled: shortcutElements.tasks.enabled?.checked ?? true
      },
      save: {
        command: shortcutElements.save.command?.value || '/save',
        parameters: shortcutElements.save.parameters?.value || '',
        autoExecute: shortcutElements.save.autoExecute?.checked ?? false,
        enabled: shortcutElements.save.enabled?.checked ?? true
      },
      notes: {
        command: shortcutElements.notes.command?.value || '/notes',
        parameters: shortcutElements.notes.parameters?.value || '',
        autoExecute: shortcutElements.notes.autoExecute?.checked ?? false,
        enabled: shortcutElements.notes.enabled?.checked ?? true
      },
      search: {
        command: shortcutElements.search.command?.value || '/find',
        parameters: shortcutElements.search.parameters?.value || '',
        autoExecute: shortcutElements.search.autoExecute?.checked ?? false,
        enabled: shortcutElements.search.enabled?.checked ?? true
      },
      ai: {
        command: shortcutElements.ai.command?.value || '/ai',
        parameters: shortcutElements.ai.parameters?.value || '',
        autoExecute: shortcutElements.ai.autoExecute?.checked ?? false,
        enabled: shortcutElements.ai.enabled?.checked ?? true
      }
    }

    await sendMessage({
      type: 'UPDATE_SHORTCUT_SETTINGS',
      data: { shortcuts: config }
    })

    showStatus(shortcutsStatusMessage, 'Shortcut buttons saved successfully!', 'success')
  } catch (error) {
    console.error('[Options] Failed to save shortcut settings:', error)
    showStatus(shortcutsStatusMessage, 'Failed to save shortcuts. Please try again.', 'error')
  }
}

// Add change listeners for all shortcut controls
shortcuts.forEach(id => {
  const elements = shortcutElements[id]
  if (!elements) return

  const fields = ['enabled', 'command', 'parameters', 'autoExecute'] as const
  fields.forEach(field => {
    const element = elements[field]
    if (element) {
      element.addEventListener('change', saveShortcutSettings)
    }
  })
})

// Custom Buttons Management
const customButtonsList = document.getElementById('custom-buttons-list') as HTMLDivElement | null
const addCustomButtonBtn = document.getElementById('add-custom-button') as HTMLButtonElement | null
const customButtonForm = document.getElementById('custom-button-form') as HTMLDivElement | null
const customButtonFormTitle = document.getElementById('custom-button-form-title') as HTMLHeadingElement | null
const customButtonLabel = document.getElementById('custom-button-label') as HTMLInputElement | null
const customButtonIcon = document.getElementById('custom-button-icon') as HTMLInputElement | null
const customButtonCommand = document.getElementById('custom-button-command') as HTMLSelectElement | null
const customButtonParameters = document.getElementById('custom-button-parameters') as HTMLInputElement | null
const customButtonPosition = document.getElementById('custom-button-position') as HTMLInputElement | null
const customButtonAutoExecute = document.getElementById('custom-button-autoexecute') as HTMLInputElement | null
const saveCustomButtonBtn = document.getElementById('save-custom-button') as HTMLButtonElement | null
const cancelCustomButtonBtn = document.getElementById('cancel-custom-button') as HTMLButtonElement | null
const customButtonsStatusMessage = document.getElementById('custom-buttons-status-message') as HTMLParagraphElement | null

let customButtons: any[] = []
let editingButtonId: string | null = null

const generateButtonId = () => `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

const renderCustomButtons = () => {
  if (!customButtonsList) return

  if (customButtons.length === 0) {
    customButtonsList.innerHTML = '<p style="color: #64748b; font-size: 14px; margin: 12px 0;">No custom buttons yet. Click "Add Custom Button" to create one.</p>'
    return
  }

  // Sort by position
  const sorted = [...customButtons].sort((a, b) => a.position - b.position)

  customButtonsList.innerHTML = sorted.map(button => `
    <div class="custom-button-card" data-id="${button.id}">
      <div class="custom-button-info">
        <div class="custom-button-header">
          <span class="custom-button-icon">${button.icon}</span>
          <span class="custom-button-label">${button.label}</span>
        </div>
        <div class="custom-button-details">
          ${button.command}${button.parameters ? ' ' + button.parameters : ''} • Position: ${button.position} • ${button.autoExecute ? 'Auto-execute' : 'Fill input'}
        </div>
      </div>
      <div class="custom-button-actions">
        <button class="edit-button" data-id="${button.id}">Edit</button>
        <button class="delete-button" data-id="${button.id}">Delete</button>
      </div>
    </div>
  `).join('')

  // Add event listeners
  customButtonsList.querySelectorAll('.edit-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-id')
      if (id) editCustomButton(id)
    })
  })

  customButtonsList.querySelectorAll('.delete-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-id')
      if (id) deleteCustomButton(id)
    })
  })
}

const showCustomButtonForm = (editing = false) => {
  if (!customButtonForm || !customButtonFormTitle) return

  customButtonFormTitle.textContent = editing ? 'Edit Custom Button' : 'New Custom Button'
  customButtonForm.style.display = 'block'

  if (!editing) {
    // Reset form
    if (customButtonLabel) customButtonLabel.value = ''
    if (customButtonIcon) customButtonIcon.value = ''
    if (customButtonCommand) customButtonCommand.selectedIndex = 0
    if (customButtonParameters) customButtonParameters.value = ''
    if (customButtonPosition) customButtonPosition.value = customButtons.length.toString()
    if (customButtonAutoExecute) customButtonAutoExecute.checked = false
  }
}

const hideCustomButtonForm = () => {
  if (!customButtonForm) return
  customButtonForm.style.display = 'none'
  editingButtonId = null
}

const editCustomButton = (id: string) => {
  const button = customButtons.find(b => b.id === id)
  if (!button) return

  editingButtonId = id

  if (customButtonLabel) customButtonLabel.value = button.label
  if (customButtonIcon) customButtonIcon.value = button.icon
  if (customButtonCommand) customButtonCommand.value = button.command
  if (customButtonParameters) customButtonParameters.value = button.parameters || ''
  if (customButtonPosition) customButtonPosition.value = button.position.toString()
  if (customButtonAutoExecute) customButtonAutoExecute.checked = button.autoExecute

  showCustomButtonForm(true)
}

const deleteCustomButton = async (id: string) => {
  if (!confirm('Are you sure you want to delete this custom button?')) return

  customButtons = customButtons.filter(b => b.id !== id)
  await saveCustomButtons()
  renderCustomButtons()
  showStatus(customButtonsStatusMessage, 'Custom button deleted successfully!', 'success')
}

const saveCustomButtons = async () => {
  try {
    await sendMessage({
      type: 'UPDATE_USER_SETTINGS',
      data: { customButtons }
    })
  } catch (error) {
    console.error('[Options] Failed to save custom buttons:', error)
    throw error
  }
}

const loadCustomButtons = (buttons?: any[]) => {
  // Ensure buttons is always an array
  customButtons = Array.isArray(buttons) ? buttons : []
  renderCustomButtons()
}

// Event listeners for custom buttons
if (addCustomButtonBtn) {
  addCustomButtonBtn.addEventListener('click', () => {
    editingButtonId = null
    showCustomButtonForm(false)
  })
}

if (cancelCustomButtonBtn) {
  cancelCustomButtonBtn.addEventListener('click', hideCustomButtonForm)
}

if (saveCustomButtonBtn) {
  saveCustomButtonBtn.addEventListener('click', async () => {
    // Validate inputs
    if (!customButtonLabel?.value.trim()) {
      showStatus(customButtonsStatusMessage, 'Please enter a label', 'error')
      return
    }
    if (!customButtonIcon?.value.trim()) {
      showStatus(customButtonsStatusMessage, 'Please enter an icon', 'error')
      return
    }
    if (!customButtonCommand?.value) {
      showStatus(customButtonsStatusMessage, 'Please select a command', 'error')
      return
    }

    const button = {
      id: editingButtonId || generateButtonId(),
      label: customButtonLabel.value.trim(),
      icon: customButtonIcon.value.trim(),
      command: customButtonCommand.value,
      parameters: customButtonParameters?.value.trim() || '',
      position: parseInt(customButtonPosition?.value || '0'),
      autoExecute: customButtonAutoExecute?.checked ?? false
    }

    if (editingButtonId) {
      // Update existing
      const index = customButtons.findIndex(b => b.id === editingButtonId)
      if (index >= 0) {
        customButtons[index] = button
      }
    } else {
      // Add new
      customButtons.push(button)
    }

    try {
      await saveCustomButtons()
      renderCustomButtons()
      hideCustomButtonForm()
      showStatus(customButtonsStatusMessage, 'Custom button saved successfully!', 'success')
    } catch (error) {
      showStatus(customButtonsStatusMessage, 'Failed to save custom button. Please try again.', 'error')
    }
  })
}

// Version Management Functions
const getDefaultVersionSettings = (): VersionManagementSettings => ({
  autoSave: {
    enabled: true,
    interval: 300000, // 5 minutes
    mode: 'smart',
    contentThreshold: 100,
    smartTriggers: {
      significantEdits: true,
      milestoneMarkers: true,
      beforeSave: true,
      periodically: true,
      beforeClose: true
    }
  },
  storage: {
    maxVersionsPerDocument: 50,
    autoCleanup: {
      enabled: true,
      strategy: 'smart',
      keepCount: 20,
      maxAgeHours: 2160, // 90 days
      smartRetention: {
        keepMilestones: true,
        keepBranches: true,
        keepTagged: true,
        keepRecent: 10
      }
    },
    compressionEnabled: true,
    deduplicationEnabled: true
  },
  ui: {
    showVersionCount: true,
    showLastModified: true,
    defaultVersionView: 'list',
    enableQuickRestore: true,
    showDiffPreview: true,
    groupByDate: false,
    enableKeyboardShortcuts: true
  },
  advanced: {
    enableVersionBranching: false, // Future feature - disabled until UI is implemented
    enableSemanticTags: true,
    autoTagging: {
      enabled: true,
      detectMilestones: true,
      detectBreakingChanges: false,
      customPatterns: []
    },
    exportFormats: ['json', 'markdown'],
    enableAuditTrail: true,
    enableCollaboration: false
  }
})

const loadVersionManagementSettings = (settings?: VersionManagementSettings) => {
  const vmSettings = settings || getDefaultVersionSettings()

  // Auto-save settings
  if (versionAutoSaveEnabled) versionAutoSaveEnabled.checked = vmSettings.autoSave.enabled
  if (versionAutoSaveInterval) versionAutoSaveInterval.value = vmSettings.autoSave.interval.toString()
  if (versionAutoSaveMode) versionAutoSaveMode.value = vmSettings.autoSave.mode

  // Storage settings
  if (versionMaxVersions) versionMaxVersions.value = vmSettings.storage.maxVersionsPerDocument.toString()
  if (versionAutoCleanupEnabled) versionAutoCleanupEnabled.checked = vmSettings.storage.autoCleanup.enabled
  if (versionCleanupStrategy) versionCleanupStrategy.value = vmSettings.storage.autoCleanup.strategy

  // UI settings
  if (versionShowCount) versionShowCount.checked = vmSettings.ui.showVersionCount
  if (versionShowLastModified) versionShowLastModified.checked = vmSettings.ui.showLastModified
  if (versionEnableShortcuts) versionEnableShortcuts.checked = vmSettings.ui.enableKeyboardShortcuts

  // Advanced settings
  if (versionEnableTagging) versionEnableTagging.checked = vmSettings.advanced.enableSemanticTags
  if (versionEnableCompression) versionEnableCompression.checked = vmSettings.storage.compressionEnabled

  // Update conditional visibility
  updateConditionalFields()
}

const updateConditionalFields = () => {
  // Auto-save options visibility
  if (autoSaveOptions && versionAutoSaveEnabled) {
    autoSaveOptions.classList.toggle('enabled', versionAutoSaveEnabled.checked)
  }
  if (autoSaveModeField && versionAutoSaveEnabled) {
    autoSaveModeField.classList.toggle('enabled', versionAutoSaveEnabled.checked)
  }

  // Auto-cleanup options visibility
  if (autoCleanupOptions && versionAutoCleanupEnabled) {
    autoCleanupOptions.classList.toggle('enabled', versionAutoCleanupEnabled.checked)
  }
}

const getCurrentVersionSettings = (): VersionManagementSettings => {
  const defaults = getDefaultVersionSettings()

  return {
    autoSave: {
      enabled: versionAutoSaveEnabled?.checked ?? defaults.autoSave.enabled,
      interval: parseInt(versionAutoSaveInterval?.value ?? defaults.autoSave.interval.toString()),
      mode: (versionAutoSaveMode?.value as any) ?? defaults.autoSave.mode,
      contentThreshold: defaults.autoSave.contentThreshold,
      smartTriggers: defaults.autoSave.smartTriggers
    },
    storage: {
      maxVersionsPerDocument: parseInt(versionMaxVersions?.value ?? defaults.storage.maxVersionsPerDocument.toString()),
      autoCleanup: {
        enabled: versionAutoCleanupEnabled?.checked ?? defaults.storage.autoCleanup.enabled,
        strategy: (versionCleanupStrategy?.value as any) ?? defaults.storage.autoCleanup.strategy,
        keepCount: defaults.storage.autoCleanup.keepCount,
        maxAgeHours: defaults.storage.autoCleanup.maxAgeHours,
        smartRetention: defaults.storage.autoCleanup.smartRetention
      },
      compressionEnabled: versionEnableCompression?.checked ?? defaults.storage.compressionEnabled,
      deduplicationEnabled: defaults.storage.deduplicationEnabled
    },
    ui: {
      showVersionCount: versionShowCount?.checked ?? defaults.ui.showVersionCount,
      showLastModified: versionShowLastModified?.checked ?? defaults.ui.showLastModified,
      defaultVersionView: defaults.ui.defaultVersionView,
      enableQuickRestore: defaults.ui.enableQuickRestore,
      showDiffPreview: defaults.ui.showDiffPreview,
      groupByDate: defaults.ui.groupByDate,
      enableKeyboardShortcuts: versionEnableShortcuts?.checked ?? defaults.ui.enableKeyboardShortcuts
    },
    advanced: {
      enableVersionBranching: defaults.advanced.enableVersionBranching, // Future feature
      enableSemanticTags: versionEnableTagging?.checked ?? defaults.advanced.enableSemanticTags,
      autoTagging: {
        enabled: defaults.advanced.autoTagging.enabled,
        detectMilestones: defaults.advanced.autoTagging.detectMilestones,
        detectBreakingChanges: defaults.advanced.autoTagging.detectBreakingChanges,
        customPatterns: defaults.advanced.autoTagging.customPatterns
      },
      exportFormats: defaults.advanced.exportFormats,
      enableAuditTrail: defaults.advanced.enableAuditTrail,
      enableCollaboration: defaults.advanced.enableCollaboration
    }
  }
}

const persistVersionManagementSettings = async (settings: Partial<VersionManagementSettings>) => {
  try {
    await sendMessage({
      type: 'UPDATE_VERSION_MANAGEMENT_SETTINGS',
      data: settings
    })
    showStatus(versionStatusMessage, 'Version management settings saved successfully.', 'success')
    updateStorageImpact()
  } catch (error) {
    console.error('[Options] Failed to save version management settings:', error)
    showStatus(versionStatusMessage, 'Failed to save settings. Please try again.', 'error')
  }
}

const updateStorageImpact = (settings?: VersionManagementSettings) => {
  const vmSettings = settings || getCurrentVersionSettings()

  // Calculate storage impact
  const avgDocumentSize = 50000 // 50KB average
  const compressionRatio = vmSettings.storage.compressionEnabled ? 0.6 : 1.0
  const versionOverhead = 2000 // 2KB metadata per version

  const estimatedSizePerDocument = (
    (avgDocumentSize * compressionRatio + versionOverhead) *
    vmSettings.storage.maxVersionsPerDocument
  )

  const availableStorage = 100 * 1024 * 1024 // 100MB typical extension storage
  const recommendedMaxDocuments = Math.floor(availableStorage * 0.8 / estimatedSizePerDocument)

  // Update UI
  if (sizePerDocument) {
    const sizeMB = (estimatedSizePerDocument / (1024 * 1024)).toFixed(1)
    sizePerDocument.textContent = `~${sizeMB} MB`
  }

  if (recommendedMaxDocs) {
    recommendedMaxDocs.textContent = `~${recommendedMaxDocuments}`
  }

  // Show warnings
  if (storageWarnings) {
    storageWarnings.innerHTML = ''
    const warnings: string[] = []

    if (vmSettings.storage.maxVersionsPerDocument > 100) {
      warnings.push('High version count may impact performance')
    }

    if (!vmSettings.storage.autoCleanup.enabled) {
      warnings.push('Manual cleanup required to prevent storage overflow')
    }

    if (vmSettings.autoSave.enabled && vmSettings.autoSave.interval < 60000) {
      warnings.push('Frequent auto-save may create many versions')
    }

    warnings.forEach(warning => {
      const warningEl = document.createElement('div')
      warningEl.className = 'warning-item'
      warningEl.textContent = warning
      storageWarnings.appendChild(warningEl)
    })
  }
}

const applyPreset = (presetName: 'conservative' | 'power-user' | 'minimal') => {
  let presetSettings: VersionManagementSettings

  switch (presetName) {
    case 'conservative':
      presetSettings = getDefaultVersionSettings() // Already conservative
      break

    case 'power-user':
      presetSettings = {
        ...getDefaultVersionSettings(),
        autoSave: {
          ...getDefaultVersionSettings().autoSave,
          interval: 60000 // 1 minute
        },
        storage: {
          ...getDefaultVersionSettings().storage,
          maxVersionsPerDocument: 100
        },
        advanced: {
          ...getDefaultVersionSettings().advanced,
          enableVersionBranching: true // Future feature - would be enabled for power users
        }
      }
      break

    case 'minimal':
      presetSettings = {
        ...getDefaultVersionSettings(),
        autoSave: {
          ...getDefaultVersionSettings().autoSave,
          enabled: false
        },
        storage: {
          ...getDefaultVersionSettings().storage,
          maxVersionsPerDocument: 10,
          autoCleanup: {
            ...getDefaultVersionSettings().storage.autoCleanup,
            keepCount: 5
          }
        },
        ui: {
          ...getDefaultVersionSettings().ui,
          showVersionCount: false,
          showLastModified: false,
          enableKeyboardShortcuts: false
        },
        advanced: {
          ...getDefaultVersionSettings().advanced,
          enableSemanticTags: false,
          autoTagging: {
            ...getDefaultVersionSettings().advanced.autoTagging,
            enabled: false
          }
        }
      }
      break
  }

  loadVersionManagementSettings(presetSettings)
  persistVersionManagementSettings(presetSettings)

  // Update preset button states
  document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('applied'))
  document.getElementById(`preset-${presetName}`)?.classList.add('applied')
}

// Event listeners for version management
if (versionAutoSaveEnabled) {
  versionAutoSaveEnabled.addEventListener('change', () => {
    updateConditionalFields()
    persistVersionManagementSettings({ autoSave: { ...getCurrentVersionSettings().autoSave, enabled: versionAutoSaveEnabled.checked }})
  })
}

if (versionAutoSaveInterval) {
  versionAutoSaveInterval.addEventListener('change', () => {
    persistVersionManagementSettings({ autoSave: { ...getCurrentVersionSettings().autoSave, interval: parseInt(versionAutoSaveInterval.value) }})
  })
}

if (versionAutoSaveMode) {
  versionAutoSaveMode.addEventListener('change', () => {
    persistVersionManagementSettings({ autoSave: { ...getCurrentVersionSettings().autoSave, mode: versionAutoSaveMode.value as any }})
  })
}

if (versionMaxVersions) {
  versionMaxVersions.addEventListener('change', () => {
    persistVersionManagementSettings({ storage: { ...getCurrentVersionSettings().storage, maxVersionsPerDocument: parseInt(versionMaxVersions.value) }})
  })
}

if (versionAutoCleanupEnabled) {
  versionAutoCleanupEnabled.addEventListener('change', () => {
    updateConditionalFields()
    persistVersionManagementSettings({ storage: { ...getCurrentVersionSettings().storage, autoCleanup: { ...getCurrentVersionSettings().storage.autoCleanup, enabled: versionAutoCleanupEnabled.checked } }})
  })
}

if (versionCleanupStrategy) {
  versionCleanupStrategy.addEventListener('change', () => {
    persistVersionManagementSettings({ storage: { ...getCurrentVersionSettings().storage, autoCleanup: { ...getCurrentVersionSettings().storage.autoCleanup, strategy: versionCleanupStrategy.value as any } }})
  })
}

// UI preference listeners
if (versionShowCount) {
  versionShowCount.addEventListener('change', () => {
    persistVersionManagementSettings({ ui: { ...getCurrentVersionSettings().ui, showVersionCount: versionShowCount.checked }})
  })
}

if (versionShowLastModified) {
  versionShowLastModified.addEventListener('change', () => {
    persistVersionManagementSettings({ ui: { ...getCurrentVersionSettings().ui, showLastModified: versionShowLastModified.checked }})
  })
}

if (versionEnableShortcuts) {
  versionEnableShortcuts.addEventListener('change', () => {
    persistVersionManagementSettings({ ui: { ...getCurrentVersionSettings().ui, enableKeyboardShortcuts: versionEnableShortcuts.checked }})
  })
}

// Advanced feature listeners
if (versionEnableTagging) {
  versionEnableTagging.addEventListener('change', () => {
    persistVersionManagementSettings({ advanced: { ...getCurrentVersionSettings().advanced, enableSemanticTags: versionEnableTagging.checked }})
  })
}

if (versionEnableCompression) {
  versionEnableCompression.addEventListener('change', () => {
    persistVersionManagementSettings({ storage: { ...getCurrentVersionSettings().storage, compressionEnabled: versionEnableCompression.checked }})
  })
}

// Preset button listeners
if (presetConservative) {
  presetConservative.addEventListener('click', () => applyPreset('conservative'))
}

if (presetPowerUser) {
  presetPowerUser.addEventListener('click', () => applyPreset('power-user'))
}

if (presetMinimal) {
  presetMinimal.addEventListener('click', () => applyPreset('minimal'))
}

loadSettings()
