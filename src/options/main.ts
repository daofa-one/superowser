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

type UserSettings = {
  preferredSearchEngine?: string
  preferredAiProvider?: string
  reuseAiTab?: boolean
  versionManagement?: VersionManagementSettings
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
