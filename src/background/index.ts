import { DIContainer } from './container'
import {
  RequestMessage,
  ResponseMessage,
  SuccessResponse,
  ErrorResponse,
  TabInfo,
  isRequestMessage
} from './messaging/message-types'
import { useBackgroundStore } from './stores/background-store'
import { createPinia, setActivePinia } from 'pinia'
import { escapeForXML } from '../shared/utils'
import { formatCommandResponseForChat } from '../shared/commands/formatters'
import {
  AIRunPromptRequest,
  AIExecutePromptRequest,
  AIProgressUpdate,
  AIResult,
  AIError,
  AIAutomationSettings,
  getDefaultAISettings,
  AI_MESSAGE_TYPES
} from '../shared/messaging/ai-types'

// Default version management settings
function getDefaultVersionSettings() {
  return {
    autoSave: {
      enabled: true,
      interval: 300, // 5 minutes
      minChanges: 50
    },
    cleanup: {
      enabled: false,
      keepVersions: 25
    },
    ui: {
      versionNaming: 'timestamp',
      showMetadata: true,
      compareMode: 'sideBySide'
    }
  }
}

// AI automation tab management
const aiAutomationTabs = new Map<string, number>() // provider -> tabId

// Track active automation requests for contextual logging and chat history
const aiAutomationRequests = new Map<string, {
    prompt: string
    provider: string
    task?: string
}>()

// Initialize dependency injection container and shared store
const container = DIContainer.getInstance()
const pinia = createPinia()
setActivePinia(pinia)
const backgroundStore = useBackgroundStore()

// Set the background store in the container for dependency injection
container.setBackgroundStore(backgroundStore)

const sendRuntimeMessageSafe = (payload: any) => {
    try {
        chrome.runtime.sendMessage(payload, () => {
            const error = chrome.runtime.lastError
            if (error && error.message) {
                const message = error.message
                // Silently ignore common disconnection errors that are expected
                if (message.includes('Receiving end does not exist') ||
                    message.includes('Could not establish connection') ||
                    message.includes('The message port closed before a response was received')) {
                    return
                }
                console.warn('[superowser] Failed to deliver runtime message:', message)
            }
        })
    } catch (error) {
        // Only log unexpected errors, not connection issues
        if (error instanceof Error &&
            !error.message.includes('message port closed') &&
            !error.message.includes('Receiving end does not exist')) {
            console.warn('[superowser] Runtime message dispatch failed:', error)
        }
    }
}

const normalizeUrl = (value: string) => {
  try {
        const url = new URL(value)
        const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/'

        return {
            origin: url.origin.toLowerCase(),
            path: normalizePath(url.pathname),
            search: url.search || '',
            hash: url.hash || ''
        }
    } catch {
        return null
    }
}

const urlsMatch = (first: string, second: string): boolean => {
    const a = normalizeUrl(first)
    const b = normalizeUrl(second)

    if (!a || !b) {
        return first === second
    }

    return (
        a.origin === b.origin &&
        a.path === b.path &&
        a.search === b.search &&
        a.hash === b.hash
    )
}

const focusOrOpenUrl = async (targetUrl: string) => {
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find(tab => {
        const candidateUrl = tab.url || (tab as any).pendingUrl;
        if (!candidateUrl) {
            return false;
        }
        return urlsMatch(candidateUrl, targetUrl);
    });

    if (existingTab) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
        await chrome.tabs.update(existingTab.id!, { active: true });
        return existingTab;
    }

    return chrome.tabs.create({
        url: targetUrl,
        active: true
    });
}

// AI automation utilities
async function getAISettings(): Promise<AIAutomationSettings> {
    const userSettings = backgroundStore.user.settings
    const defaultSettings = getDefaultAISettings()
    const aiAutomationSettings = userSettings?.aiAutomation || defaultSettings

    // Always focus the assistant tab so users know automation is running

    return aiAutomationSettings
}

async function findOrCreateAITab(provider: 'chatgpt' | 'claude' | 'perplexity'): Promise<chrome.tabs.Tab> {
    const settings = await getAISettings()
    console.log('[AI Automation] Settings:', { reuseTab: settings.reuseTab })

    const providerUrls = {
        chatgpt: 'https://chatgpt.com',
        claude: 'https://claude.ai',
        perplexity: 'https://www.perplexity.ai'
    }

    const targetUrl = providerUrls[provider]

    // Check if we should reuse existing tab
    if (settings.reuseTab) {
        const existingTabId = aiAutomationTabs.get(provider)
        if (existingTabId) {
            try {
                const tab = await chrome.tabs.get(existingTabId)
                if (tab && tab.url?.includes(targetUrl)) {
                    console.log('[AI Automation] Reusing existing tab and focusing it')
                    // Always focus the tab so users know automation is running
                    await chrome.tabs.update(existingTabId, { active: true })
                    await chrome.windows.update(tab.windowId!, { focused: true })
                    return tab
                }
            } catch {
                // Tab no longer exists, remove from tracking
                aiAutomationTabs.delete(provider)
            }
        }

        // Fallback: scan current tabs that match provider URL
        try {
            const candidateTabs = await chrome.tabs.query({})
            const matchingTab = candidateTabs.find(tab => {
                const candidateUrl = tab.url || (tab as any).pendingUrl
                if (!candidateUrl) return false
                try {
                    const hostname = new URL(candidateUrl).hostname
                    const targetHostname = new URL(targetUrl).hostname
                    return hostname === targetHostname || hostname.endsWith(`.${targetHostname}`)
                } catch {
                    return candidateUrl.includes(targetUrl)
                }
            })

            if (matchingTab && matchingTab.id != null) {
                aiAutomationTabs.set(provider, matchingTab.id)
                // Always focus the tab so users know automation is running
                await chrome.tabs.update(matchingTab.id, { active: true })
                await chrome.windows.update(matchingTab.windowId!, { focused: true })
                console.log('[AI Automation] Reusing detected provider tab:', matchingTab.id)
                return matchingTab
            }
        } catch (error) {
            console.warn('[AI Automation] Failed to query existing tabs for reuse:', error)
        }
    }

    // Create new tab and always focus it so users know automation is running
    console.log('[AI Automation] Creating focused tab for:', targetUrl)
    const tab = await focusOrOpenUrl(targetUrl)

    aiAutomationTabs.set(provider, tab.id!)
    console.log('[AI Automation] Tab created:', { id: tab.id, active: tab.active })
    return tab
}

async function injectAIContentScript(tabId: number): Promise<void> {
    try {
        console.log(`[AI Injection] Starting injection for tab ${tabId}`)

        // Check if content script is already injected
        const checkResults = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => ({
                hasBridge: window.hasOwnProperty('superowserAIBridge'),
                bridgeValue: (window as any).superowserAIBridge,
                url: window.location.href
            })
        })

        const checkResult = checkResults[0]?.result
        console.log(`[AI Injection] Pre-injection check:`, checkResult)

        if (checkResult?.hasBridge) {
            console.log(`[AI Injection] Script already injected for tab ${tabId}`)
            return // Already injected
        }

        // Inject the AI automation content script with predictable filename
        console.log(`[AI Injection] Injecting ai-bridge.js for tab ${tabId}`)

        try {
            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId },
                files: ['assets/ai-bridge.js']
            })
            console.log(`[AI Injection] Injection results:`, injectionResults)
        } catch (injectionError) {
            console.error(`[AI Injection] Failed to inject script:`, injectionError)
            throw injectionError
        }

        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Verify injection was successful
        const verifyResults = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => ({
                hasBridge: window.hasOwnProperty('superowserAIBridge'),
                bridgeValue: (window as any).superowserAIBridge,
                url: window.location.href,
                scriptTags: Array.from(document.querySelectorAll('script')).length
            })
        })

        const verifyResult = verifyResults[0]?.result
        console.log(`[AI Injection] Post-injection verification:`, verifyResult)

        if (!verifyResult?.hasBridge) {
            throw new Error(`AI bridge not found after injection. URL: ${verifyResult?.url}`)
        }

        console.log(`[AI Injection] Successfully injected and verified for tab ${tabId}`)
    } catch (error) {
        console.error(`[AI Injection] Failed for tab ${tabId}:`, error)
        throw new Error(`Failed to inject AI content script: ${error}`)
    }
}

async function sendProgressUpdate(requestId: string, status: AIProgressUpdate['status'], message: string, partialContent?: string): Promise<void> {
    const progressUpdate: AIProgressUpdate = {
        requestId,
        status,
        message,
        partialContent,
        timestamp: Date.now()
    }

    sendRuntimeMessageSafe({
        type: AI_MESSAGE_TYPES.AI_PROGRESS,
        data: progressUpdate
    })
}

// Initialize the background store with persisted data
backgroundStore.initialize(container).then(() => {
    console.log('[superowser] Background store initialized');
}).catch(error => {
    console.error('[superowser] Failed to initialize background store:', error);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[superowser] installed');
});

chrome.tabs.onRemoved.addListener((tabId) => {
    try {
        backgroundStore.clearSearchTabById?.(tabId)

        // Clean up AI automation tab tracking
        for (const [provider, trackedTabId] of aiAutomationTabs.entries()) {
            if (trackedTabId === tabId) {
                aiAutomationTabs.delete(provider)
                break
            }
        }
    } catch (error) {
        console.warn('Failed to clear search tab mapping for removed tab:', error)
    }
});


// Omnibox event handlers
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try {
        if (text.trim()) {
            const trimmed = text.trim();
            let omniboxSuggestions: chrome.omnibox.SuggestResult[] = [];

            // Check for command input (starts with /)
            if (trimmed.startsWith('/')) {
                try {
                    // Create command context for omnibox
                    const commandContext = container.commandService.createContext('omnibox', {
                        activeTask: container.analyticsService.getCurrentContext().activeTask,
                        recentTags: container.analyticsService.getCurrentContext().recentTags
                    })

                    // Get command suggestions
                    const suggestions = await container.commandService.getSuggestions(trimmed, commandContext)

                    omniboxSuggestions = suggestions.map(suggestion => {
                        const safeText = escapeForXML(suggestion.text)
                        const safeDisplay = escapeForXML(suggestion.display)
                        const safeDescription = escapeForXML(suggestion.description)

                        return {
                            content: suggestion.text,
                            description: `<match>${safeDisplay}</match> - ${safeDescription}${suggestion.category ? ` | <dim>${suggestion.category}</dim>` : ''}`
                        }
                    })
                } catch (commandError) {
                    console.error('Error getting command suggestions:', commandError)
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: 'Error loading command suggestions'
                    }]
                }
            }
            // Context-aware suggestions based on what user is typing
            else if (trimmed.startsWith('@')) {
                // Shortcut suggestions with page info
                const query = trimmed.slice(1);
                try {
                    const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                    omniboxSuggestions = (suggestions.shortcuts || []).map(({ shortcut, page }) => {
                    let hostname = '';
                    try {
                        hostname = new URL(page.url).hostname;
                    } catch {
                        hostname = page.url.split('/')[2] || page.url;
                    }
                    const safeShortcut = escapeForXML(shortcut);
                    const safeTitle = escapeForXML(page.title ?? '');
                    const safeHostname = hostname ? escapeForXML(hostname) : '';
                    return {
                        content: `@${shortcut}`,
                        description: `<match>@${safeShortcut}</match> - ${safeTitle}${safeHostname ? ` | <dim>${safeHostname}</dim>` : ''}`
                    };
                });
                } catch (shortcutError) {
                    console.error('Error getting shortcut suggestions:', shortcutError);
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: 'Error loading shortcut suggestions'
                    }];
                }
            } else if (trimmed.startsWith('#')) {
                // Tag suggestions with page count and example
                const query = trimmed.slice(1);
                try {
                    const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                    const tagSuggestions = (suggestions.tags || []).map(({ tag, pages }) => {
                    const tagPages = Array.isArray(pages) ? pages : [];
                    const pageCount = tagPages.length;
                    const examplePage = pageCount > 0 ? tagPages[0] : null;
                    const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`;
                    let exampleHostname = '';
                    if (examplePage) {
                        try {
                            exampleHostname = new URL(examplePage.url).hostname;
                        } catch {
                            exampleHostname = examplePage.url.split('/')[2] || examplePage.url;
                        }
                    }
                    const safeTag = escapeForXML(tag);
                    const safeCount = escapeForXML(countText);
                    const safeHostname = exampleHostname ? escapeForXML(exampleHostname) : '';
                    const descriptionExtras = safeHostname ? ` | ${safeHostname}` : '';
                    return {
                        content: `#${tag}`,
                        description: `<match>#${safeTag}</match> - <dim>${safeCount}</dim>${descriptionExtras}`
                    };
                });

                const typedTag = trimmed.slice(1);
                if (typedTag) {
                    const normalizedTyped = typedTag.toLowerCase();
                    const exactExists = tagSuggestions.some(entry => entry.content.toLowerCase() === `#${normalizedTyped}`);
                    const safeTyped = escapeForXML(typedTag);

                    if (!exactExists) {
                        const hasResults = tagSuggestions.length > 0;
                        tagSuggestions.unshift({
                            content: `#${typedTag}`,
                            description: `<match>#${safeTyped}</match> - <dim>${hasResults ? 'Search tag' : 'No tagged pages found'}</dim>`
                        });
                    }
                }

                omniboxSuggestions = tagSuggestions.length > 0 ? tagSuggestions : [{
                    content: `#${trimmed.slice(1)}`,
                    description: `<match>#${escapeForXML(trimmed.slice(1))}</match> - <dim>No tagged pages found</dim>`
                }];
                } catch (tagError) {
                    console.error('Error getting tag suggestions:', tagError);
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: 'Error loading tag suggestions'
                    }];
                }
            } else if (trimmed.startsWith('&')) {
                // Task suggestions
                const query = trimmed.slice(1);
                try {
                    const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                    omniboxSuggestions = (suggestions.tasks || []).map(task => ({
                    content: `&${task}`,
                    description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
                }));
                } catch (taskError) {
                    console.error('Error getting task suggestions:', taskError);
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: 'Error loading task suggestions'
                    }];
                }
            } else if (trimmed.startsWith('!notes ') || trimmed.startsWith('!!')) {
                // Note search suggestions with actual search results
                const noteQuery = trimmed.startsWith('!!') ? trimmed.slice(2).trim() : trimmed.slice(7);
                if (noteQuery.trim()) {
                    try {
                        // Also try searching for all notes by using getAll
                        const allNotesRaw = await container.noteService.getAll(1000);
                        const allNotesCheck = Array.isArray(allNotesRaw) ? allNotesRaw : [];
                        console.log('Debug: Notes search - total notes:', allNotesCheck.length, 'query:', noteQuery);

                        const notesRaw = await container.noteService.search(noteQuery);
                        const notes = Array.isArray(notesRaw) ? notesRaw : [];
                        console.log('Debug: Notes search results:', notes.length);

                        if (notes.length > 0) {
                            omniboxSuggestions = notes.slice(0, 6).map((note) => {
                                const noteTags = Array.isArray(note.tags) ? note.tags : [];
                                const contentPreview = note.content.slice(0, 80);
                                const safeContent = escapeForXML(contentPreview);
                                const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 50)) : '';
                                const tagInfo = noteTags.length > 0 ? ` | ${noteTags.slice(0, 2).join(', ')}` : '';
                                const commentInfo = safeComment ? ` - ${safeComment}` : '';

                                const prefix = trimmed.startsWith('!!') ? '!!' : '!notes ';
                                return {
                                    content: `${prefix}${noteQuery}#${note.id}`,
                                    description: `📝 <match>${safeContent}${contentPreview.length > 80 ? '...' : ''}</match>${commentInfo}<dim>${tagInfo}</dim>`
                                };
                            });
                        } else {
                            const message = allNotesCheck.length === 0
                                ? `📝 No notes exist yet. Create notes by adding them from the side panel.`
                                : `📝 No notes found for "${noteQuery}"`;
                            const prefix = trimmed.startsWith('!!') ? '!!' : '!notes ';
                            omniboxSuggestions = [{
                                content: `${prefix}${noteQuery}`,
                                description: message
                            }];
                        }
                    } catch (error) {
                        console.error('Error searching notes:', error);
                        const prefix = trimmed.startsWith('!!') ? '!!' : '!notes ';
                        omniboxSuggestions = [{
                            content: `${prefix}${noteQuery}`,
                            description: `📝 Error searching notes`
                        }];
                    }
                } else {
                    const displayQuery = trimmed.startsWith('!!') ? trimmed.slice(2).trim() : trimmed.slice(7);
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: `Search notes for: ${displayQuery}`
                    }];
                }
            } else {
                // General suggestions - show all types with rich info
                try {
                    const suggestions = await container.searchUseCases.getSearchSuggestions(trimmed);

                    const shortcutSuggestions: chrome.omnibox.SuggestResult[] = [];
                    const seenShortcuts = new Set<string>();

                    const typedShortcut = trimmed.startsWith('@') ? trimmed.slice(1) : '';
                    if (typedShortcut) {
                        const normalizedTyped = typedShortcut.toLowerCase();
                        const safeTypedShortcut = escapeForXML(typedShortcut);
                        const typedKey = `@${normalizedTyped}`;
                        shortcutSuggestions.push({
                            content: `@${typedShortcut}`,
                            description: `<match>@${safeTypedShortcut}</match> - <dim>Open shortcut</dim>`
                        });
                        seenShortcuts.add(typedKey);
                    }

                    (suggestions.shortcuts || []).forEach(({ shortcut, page }) => {
                        const normalizedShortcut = shortcut?.trim();
                        if (!normalizedShortcut) {
                            return;
                        }

                        const shortcutKey = `@${normalizedShortcut.toLowerCase()}`;
                        if (seenShortcuts.has(shortcutKey)) {
                            return;
                        }

                        let hostname = '';
                        try {
                            hostname = new URL(page.url).hostname;
                        } catch {
                            hostname = page.url.split('/')[2] || page.url;
                        }
                        const safeShortcut = escapeForXML(normalizedShortcut);
                        const safeTitle = escapeForXML(page.title ?? '');
                        const safeHostname = hostname ? escapeForXML(hostname) : '';

                        shortcutSuggestions.push({
                            content: `@${normalizedShortcut}`,
                            description: `<match>@${safeShortcut}</match> - ${safeTitle}${safeHostname ? ` | <dim>${safeHostname}</dim>` : ''}`
                        });

                        seenShortcuts.add(shortcutKey);
                    });

                const pageSuggestions = (suggestions.pages || []).map(({ page }) => {
                    let hostname = '';
                    try {
                        hostname = new URL(page.url).hostname;
                    } catch {
                        hostname = page.url.split('/')[2] || page.url;
                    }
                    const safeTitle = escapeForXML(page.title ?? page.url);
                    const safeUrl = escapeForXML(page.url);
                    const safeHostname = hostname ? escapeForXML(hostname) : '';
                    return {
                        content: page.url,
                        description: `${safeHostname ? `<dim>${safeHostname}</dim> - ` : ''}<match>${safeTitle}</match> | <dim>${safeUrl}</dim>`
                    };
                });

                const tagSuggestions: chrome.omnibox.SuggestResult[] = [];
                const seenTags = new Set<string>();

                const typedTag = trimmed.startsWith('#') ? trimmed.slice(1) : '';
                if (typedTag) {
                    const normalizedTyped = typedTag.toLowerCase();
                    const safeTypedTag = escapeForXML(typedTag);
                    const typedKey = `#${normalizedTyped}`;
                    tagSuggestions.push({
                        content: `#${typedTag}`,
                        description: `<match>#${safeTypedTag}</match> - <dim>Search tag</dim>`
                    });
                    seenTags.add(typedKey);
                }

                (suggestions.tags || []).forEach(({ tag, pages }) => {
                    const normalizedTag = (tag ?? '').trim();
                    if (!normalizedTag) {
                        return;
                    }

                    const tagKey = `#${normalizedTag.toLowerCase()}`;
                    if (seenTags.has(tagKey)) {
                        return;
                    }

                    const tagPages = Array.isArray(pages) ? pages : [];
                    const pageCount = tagPages.length;
                    const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`;
                    const safeTag = escapeForXML(normalizedTag);
                    const safeCount = escapeForXML(countText);

                    tagSuggestions.push({
                        content: `#${normalizedTag}`,
                        description: `<match>#${safeTag}</match> - <dim>${safeCount}</dim>`
                    });

                    seenTags.add(tagKey);
                });

                const taskSuggestions = (suggestions.tasks || []).map(task => ({
                    content: `&${task}`,
                    description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
                }));

                const noteSuggestions = (suggestions.notes || []).map(({ note }) => {
                    const contentPreview = (note.content || '').slice(0, 60);
                    const safeContent = escapeForXML(contentPreview);
                    const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 40)) : '';
                    const noteTags = Array.isArray(note.tags) ? note.tags : [];
                    const tagInfo = noteTags.length > 0 ? ` | ${noteTags.slice(0, 2).join(', ')}` : '';
                    const commentInfo = safeComment ? ` - ${safeComment}` : '';

                    return {
                        content: `!notes ${trimmed}#${note.id}`,
                        description: `📝 <match>${safeContent}${contentPreview.length > 60 ? '...' : ''}</match>${commentInfo}<dim>${tagInfo}</dim>`
                    };
                });

                const interleaved: chrome.omnibox.SuggestResult[] = [];
                const queues: chrome.omnibox.SuggestResult[][] = [
                    shortcutSuggestions,
                    pageSuggestions,
                    tagSuggestions,
                    taskSuggestions,
                    noteSuggestions
                ];

                const pushNext = (queue: chrome.omnibox.SuggestResult[]) => {
                    if (queue.length && interleaved.length < 6) {
                        interleaved.push(queue.shift()!);
                    }
                };

                while (interleaved.length < 6 && queues.some(queue => queue.length)) {
                    queues.forEach(pushNext);
                }

                // In case one category had more leftovers, fill the remaining slots respecting the limit.
                const remaining = [
                    ...shortcutSuggestions,
                    ...pageSuggestions,
                    ...tagSuggestions,
                    ...taskSuggestions,
                    ...noteSuggestions
                ];
                while (interleaved.length < 6 && remaining.length) {
                    interleaved.push(remaining.shift()!);
                }

                omniboxSuggestions = interleaved;
                } catch (suggestionError) {
                    console.error('Error getting search suggestions:', suggestionError);
                    omniboxSuggestions = [{
                        content: trimmed,
                        description: 'Error loading suggestions'
                    }];
                }
            }

            suggest(omniboxSuggestions.slice(0, 6)); // Limit to 6 suggestions
        }
    } catch (error) {
        console.error('Omnibox suggestion error:', error);
    }
});

chrome.omnibox.onInputEntered.addListener(async (text) => {
    try {
        // Check if this is a command (starts with /)
        if (text.trim().startsWith('/')) {
            const commandContext = container.commandService.createContext('omnibox', {
                activeTask: container.analyticsService.getCurrentContext().activeTask,
                recentTags: container.analyticsService.getCurrentContext().recentTags
            })

            const commandRequest = {
                input: text.trim(),
                context: commandContext,
                timestamp: new Date()
            }

            const response = await container.commandService.processCommand(commandRequest)

            // Handle command response
            if (response.success) {
                if (response.navigation) {
                    // Open sidepanel if it's not already open
                    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
                    if (currentTab && currentTab.id) {
                        // Send navigation message to the side panel
                        sendRuntimeMessageSafe({
                            type: 'COMMAND_NAVIGATION',
                            data: {
                                target: response.navigation.target,
                                message: response.content,
                                preserveCommand: response.navigation.preserveCommand
                            }
                        })

                        // Also show a result in the omnibox result format
                        sendRuntimeMessageSafe({
                            type: 'OMNIBOX_RESULTS',
                            data: {
                                query: text,
                                results: [{
                                    type: 'command',
                                    id: 'command-result',
                                    title: response.content || 'Command executed',
                                    snippet: '📋 Open sidepanel to see results (click extension icon)',
                                    score: 1,
                                    tags: [],
                                    tasks: []
                                }]
                            }
                        })
                    }

                    const commandInput = text.trim()
                    const [rawCommand, ...commandArgs] = commandInput.slice(1).split(/\s+/)
                    const commandName = rawCommand?.toLowerCase()

                    let displayResponse = response
                    if (commandName === 'help' || commandName === '?' || commandName === 'h') {
                        const helpTarget = commandArgs.join(' ') || undefined
                        const helpText = container.commandService.getHelp(helpTarget)
                        displayResponse = {
                            success: true,
                            type: 'text',
                            content: helpText,
                            followUp: response.followUp,
                            metadata: response.metadata
                        }
                    }

                    const formattedContent = formatCommandResponseForChat(commandInput, displayResponse)

                    console.log('[Command Result][omnibox]', {
                        command: commandName,
                        args: commandArgs,
                        input: commandInput,
                        content: formattedContent
                    })

                    backgroundStore.addExtensionChat({
                        content: formattedContent,
                        command: commandName,
                        relatedTask: container.analyticsService.getCurrentContext().activeTask
                    })
                }
            } else {
                // Handle command errors - also include the original command for context
                const commandInput = text.trim()
                const formattedError = formatCommandResponseForChat(commandInput, response)

                console.error('[Command Error]', response.error?.message || 'Unknown error')

                backgroundStore.addExtensionChat({
                    content: formattedError,
                    command: commandInput.startsWith('/') ? commandInput.slice(1).split(/\s+/)[0]?.toLowerCase() : undefined,
                    relatedTask: container.analyticsService.getCurrentContext().activeTask
                })
            }

            return // Exit early for commands
        }

        // Continue with existing omnibox command logic for @, #, &, !! syntax
        const result = await container.searchUseCases.executeOmniboxCommand(text);

        if (result.type === 'open' && result.page) {
            // Record analytics for page access
            container.analyticsService.recordAccess({
                id: result.page.id,
                type: 'page',
                source: 'omnibox',
                query: text,
                context: {
                    activeTask: container.analyticsService.getCurrentContext().activeTask
                }
            });

            // Track behavioral patterns for ML learning
            await container.mlService.updateContentFeatures(
                {
                    id: result.page.id,
                    type: 'page',
                    title: result.page.title,
                    content: result.page.url,
                    tags: result.page.tags
                },
                {
                    sessionLength: 5, // Quick access session
                    timeOfDay: new Date().getHours(),
                    dayOfWeek: new Date().getDay()
                }
            );
            await focusOrOpenUrl(result.page.url);
        } else if (result.type === 'task-activate') {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (currentTab && currentTab.id) {
                // task-activate is handled via background state updates; no side panel push needed here.
                // Note: Cannot programmatically open sidepanel due to user gesture restrictions
            }
        } else if (result.type === 'filter' || result.type === 'search') {
            // Handle search/filter results
            if (result.results && result.results.length > 0) {
                if (result.results.length === 1) {
                    // If only one result, open it directly
                    const singleResult = result.results[0];
                    if (singleResult.type === 'page') {
                        // Get the full page data
                        const page = await container.pageService.getById(singleResult.id);
                        if (page) {
                            // Record analytics for search result access
                            container.analyticsService.recordAccess({
                                id: page.id,
                                type: 'page',
                                source: 'omnibox',
                                query: text,
                                context: {
                                    activeTask: container.analyticsService.getCurrentContext().activeTask
                                }
                            });
                            await focusOrOpenUrl(page.url);
                        }
                    } else if (singleResult.type === 'note') {
                        // For note results, get the associated page if it exists
                        const note = await container.noteService.getById(singleResult.id);
                        if (note) {
                            // Record analytics for note access
                            container.analyticsService.recordAccess({
                                id: note.id,
                                type: 'note',
                                source: 'omnibox',
                                query: text,
                                context: {
                                    activeTask: container.analyticsService.getCurrentContext().activeTask
                                }
                            });

                            if (note.pageId) {
                                const page = await container.pageService.getById(note.pageId);
                                if (page) {
                                    await focusOrOpenUrl(page.url);
                                    return; // Exit early since we opened the page
                                }
                            }
                        }
                        // If no page associated with note, show in side panel
                        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (currentTab && currentTab.id) {
                            // Send results for side panel
                            sendRuntimeMessageSafe({
                                type: 'OMNIBOX_RESULTS',
                                data: {
                                    query: text,
                                    results: [singleResult]
                                }
                            });
                        }
                        return; // Exit early to avoid the multiple results handling
                    }
                } else {
                    // Multiple results - send results to side panel if open
                    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (currentTab && currentTab.id) {

                        // Send results for side panel
                        sendRuntimeMessageSafe({
                            type: 'OMNIBOX_RESULTS',
                            data: {
                                query: text,
                                results: result.results
                            }
                        });
                    }
                }
            } else {
                console.log('No results found for:', text);
                // Send empty results to side panel so it can still navigate to Home
                sendRuntimeMessageSafe({
                    type: 'OMNIBOX_RESULTS',
                    data: {
                        query: text,
                        results: []
                    }
                });
            }
        } else if (result.type === 'error') {
            console.error('Omnibox command error:', result.message);
        }
    } catch (error) {
        console.error('Omnibox command execution error:', error);
    }
});

// Handle action clicks to open side panel
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for tab changes and notify side panel
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab) {
            console.log('Tab activated:', tab.url);

            // Broadcast tab change to side panel
            try {
                chrome.runtime.sendMessage({
                    type: 'TAB_CHANGED',
                    data: {
                        id: tab.id,
                        url: tab.url,
                        title: tab.title,
                        favicon: tab.favIconUrl
                    }
                }, () => {
                    const error = chrome.runtime.lastError
                    if (error && error.message && !error.message.includes('Receiving end does not exist') && !error.message.includes('Could not establish connection')) {
                        console.debug('Could not notify side panel of tab change:', error.message);
                    }
                });
            } catch (error) {
                // Side panel might not be open - ignore error
                console.debug('Could not notify side panel of tab change:', error);
            }
        }
    } catch (error) {
        console.error('Failed to get active tab:', error);
    }
});

// Listen for tab updates (URL changes, loading complete, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only notify when the page finishes loading and it's the active tab
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        console.log('Tab updated:', tab.url);

        try {
            chrome.runtime.sendMessage({
                type: 'TAB_UPDATED',
                data: {
                    id: tab.id,
                    url: tab.url,
                    title: tab.title,
                    favicon: tab.favIconUrl
                }
            }, () => {
                const error = chrome.runtime.lastError
                if (error && error.message && !error.message.includes('Receiving end does not exist') && !error.message.includes('Could not establish connection')) {
                    console.debug('Could not notify side panel of tab update:', error.message);
                }
            });
        } catch (error) {
            // Side panel might not be open - ignore error
            console.debug('Could not notify side panel of tab update:', error);
        }
    }
});

// Message handler for side panel communication and AI bridge
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse: (response?: any) => void) => {
    console.log('[Background] Received message:', {
        type: message.type,
        id: message.id,
        hasData: !!message.data,
        sender: sender.tab ? `tab:${sender.tab.id}` : 'extension',
        timestamp: Date.now()
    })

    // Handle AI bridge messages (from content scripts) - exclude AI_RUN_PROMPT which is a command request
    const aiBridgeMessageTypes = [
        AI_MESSAGE_TYPES.AI_PROGRESS,
        AI_MESSAGE_TYPES.AI_RESULT,
        AI_MESSAGE_TYPES.AI_ERROR,
        'AI_AUTOMATION_COMPLETE'
    ]
    if (message.type && aiBridgeMessageTypes.includes(message.type)) {
        console.log('[Background] Routing to AI bridge handler:', message.type)
        handleAIBridgeMessage(message, sender)
        sendResponse({ success: true })
        return true
    }

    if (!isRequestMessage(message)) {
        console.log('[Background] Invalid message format:', {
            type: message.type,
            isString: typeof message.type === 'string',
            isSuccessOrError: message.type === 'SUCCESS' || message.type === 'ERROR',
            message
        })
        sendResponse({
            type: 'ERROR',
            error: { message: 'Invalid message format' }
        } as ErrorResponse);
        return true;
    }

    console.log('[Background] Valid request message, routing to handleMessage:', message.type)

    // Handle message asynchronously
    handleMessage(message)
        .then((response: ResponseMessage) => {
            console.log('[Background] ← Success response for:', message.type, response)
            sendResponse(response);
        })
        .catch((error: Error) => {
            console.log('[Background] ← Error response for:', message.type, error.message)
            sendResponse({
                type: 'ERROR',
                id: message.id,
                error: {
                    message: error.message,
                    details: error.stack
                }
            } as ErrorResponse);
        });

    // Return true to indicate we'll respond asynchronously
    return true;
});

// Handle messages from AI bridge content scripts
function handleAIBridgeMessage(message: any, sender: chrome.runtime.MessageSender) {
    switch (message.type) {
        case AI_MESSAGE_TYPES.AI_PROGRESS:
            sendRuntimeMessageSafe(message)
            break
        case AI_MESSAGE_TYPES.AI_RESULT:
            sendRuntimeMessageSafe(message)
            recordAIResult(message.data as AIResult)
            break
        case AI_MESSAGE_TYPES.AI_ERROR:
            sendRuntimeMessageSafe(message)
            recordAIError(message.data as AIError)
            handleAutomationComplete({ requestId: message.data.requestId, success: false }, sender)
            break
        case 'AI_AUTOMATION_COMPLETE':
            // Handle automation completion for auto-close functionality
            handleAutomationComplete(message.data, sender)
            break
        default:
            console.warn('Unknown AI bridge message type:', message.type)
    }
}

// Handle automation completion
async function handleAutomationComplete(data: { requestId: string; success: boolean }, sender: chrome.runtime.MessageSender) {
    const settings = await getAISettings()
    const requestInfo = aiAutomationRequests.get(data.requestId)

    // Tab remains focused so users know automation is running

    // Ensure request metadata is cleared even if result handling didn't run
    aiAutomationRequests.delete(data.requestId)

    if (settings.autoCloseTab && data.success && sender.tab?.id) {
        // Wait a moment for the user to see the result, then close the tab
        setTimeout(async () => {
            try {
                await chrome.tabs.remove(sender.tab!.id!)

                // Remove from our tracking
                for (const [provider, tabId] of aiAutomationTabs.entries()) {
                    if (tabId === sender.tab!.id) {
                        aiAutomationTabs.delete(provider)
                        break
                    }
                }
            } catch (error) {
                console.warn('Failed to auto-close AI tab:', error)
            }
        }, 2000) // Wait 2 seconds before closing
    }
}

function recordAIResult(result: AIResult) {
    if (!result?.requestId) {
        return
    }

    const metadata = aiAutomationRequests.get(result.requestId)

    const prompt = (metadata?.prompt || '').trim()
    const provider = metadata?.provider || 'chatgpt'
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

    const headerCommand = prompt ? `/ai ${prompt}` : '/ai'
    const content = result.content?.trim() || '(No response received)'

    const formatted = `> ${headerCommand}\n\n${content}\n\n— ${providerLabel}`

    try {
        backgroundStore.addExtensionChat({
            content: formatted,
            command: 'ai',
            relatedTask: metadata?.task
        })
    } catch (error) {
        console.warn('[AI Automation] Failed to record AI result in chat history:', error)
    }
}

function recordAIError(error: AIError) {
    if (!error?.requestId) {
        return
    }

    const metadata = aiAutomationRequests.get(error.requestId)

    const prompt = (metadata?.prompt || '').trim()
    const provider = metadata?.provider || 'chatgpt'
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

    const headerCommand = prompt ? `/ai ${prompt}` : '/ai'
    const details = error.message || 'Unknown automation error'
    const reason = error.reason ? ` (${error.reason})` : ''

    const formatted = `> ${headerCommand}\n\n❌ ${details}${reason}\n\n— ${providerLabel}`

    try {
        backgroundStore.addExtensionChat({
            content: formatted,
            command: 'ai',
            relatedTask: metadata?.task
        })
    } catch (recordingError) {
        console.warn('[AI Automation] Failed to record AI error in chat history:', recordingError)
    }
}

async function handleMessage(message: RequestMessage): Promise<ResponseMessage> {
    try {
        console.log('[Background] handleMessage called with type:', message.type)
        let data: any;

        switch (message.type) {
            case 'SAVE_PAGE':
                {
                    const activeSearchContext = message.data?.searchContext
                        ? message.data.searchContext
                        : container.backgroundStore?.getActiveSearchContext?.()

                    data = await container.pageUseCases.savePage({
                        ...message.data,
                        searchContext: activeSearchContext
                    })
                }
                break;

            case 'SAVE_CURRENT_TAB':
                const currentTab = await getCurrentTab();
                if (!currentTab) {
                    throw new Error('No active tab found');
                }

                {
                    const activeSearchContext = message.data?.searchContext
                        ? message.data.searchContext
                        : container.backgroundStore?.getActiveSearchContext?.()

                    data = await container.pageUseCases.savePage({
                        url: currentTab.url,
                        title: currentTab.title,
                        favicon: currentTab.favicon,
                        ...message.data,
                        searchContext: activeSearchContext
                    })
                }
                break;

            case 'SAVE_NOTE':
                data = await container.taskUseCases.saveNote(message.data);
                break;

            case 'GET_PAGE':
                data = await container.pageService.getById(message.data.id);
                break;

            case 'GET_PAGE_BY_URL':
                data = await container.pageService.getByUrl(message.data.url);
                break;

            case 'GET_PAGE_BY_SHORTCUT':
                data = await container.pageUseCases.openByShortcut(message.data.shortcut);
                break;

            case 'SEARCH':
                data = await container.searchService.search(message.data);
                break;

            case 'OMNIBOX_COMMAND':
                data = await container.searchUseCases.executeOmniboxCommand(message.data.input);
                break;

            case 'GET_TASKS':
                data = await container.taskUseCases.getAllTasksWithStats();
                break;

            case 'SET_ACTIVE_TASK':
                data = await container.taskUseCases.setActiveTask(message.data.taskName);
                break;

            case 'GET_ACTIVE_TASK':
                data = await container.taskUseCases.getActiveTask();
                break;

            case 'CREATE_TASK':
                data = await container.taskUseCases.createTask(message.data.name, message.data.description);
                break;

            case 'DELETE_TASK':
                await container.taskUseCases.deleteTaskAndCleanup(message.data.taskName);
                data = { success: true };
                break;

            case 'GET_TASK_CONTENT':
                data = await container.taskUseCases.getTaskWithContent(message.data.taskName);
                break;

            case 'GET_RECENT_PAGES':
                data = await container.pageUseCases.getRecentPages(20);
                break;

            case 'MOVE_PAGE_TO_TASK':
                data = await container.pageUseCases.movePageToTask(message.data.pageId, message.data.taskName);
                break;

            case 'GET_NOTES_BY_PAGE':
                data = await container.notesUseCases.getNotesByPage(message.data.pageId);
                break;

            case 'GET_ALL_NOTES':
                data = await container.notesUseCases.getAllNotes();
                break;

            case 'UPDATE_NOTE':
                const { id, ...updates } = message.data;
                data = await container.notesUseCases.updateNote(id, updates);
                break;

            case 'DELETE_NOTE':
                await container.notesUseCases.deleteNote(message.data.id);
                data = { success: true };
                break;

            case 'UPDATE_PAGE':
                data = await container.pageUseCases.updatePage(message.data.id, message.data.updates);
                break;

            case 'DELETE_PAGE':
                await container.pageUseCases.deletePageAndCleanup(message.data.id);
                data = { success: true };
                break;

            // Document-related handlers
            case 'GET_DOCUMENT':
                data = await container.documentsUseCases.getDocument(message.data.documentId, {
                    versionLimit: message.data?.versionLimit
                });
                break;
            case 'CREATE_DOCUMENT':
                data = await container.documentsUseCases.createDocument(message.data);
                break;
            case 'UPDATE_DOCUMENT':
                data = await container.documentsUseCases.updateDocument(message.data.documentId, message.data.updates);
                break;
            case 'DELETE_DOCUMENT':
                await container.documentsUseCases.deleteDocument(message.data.documentId);
                data = { success: true };
                break;
            case 'SAVE_DOCUMENT_VERSION':
                data = await container.documentsUseCases.createVersion(message.data);
                break;
            case 'DELETE_DOCUMENT_VERSION':
                await container.documentsUseCases.deleteVersion(message.data.versionId);
                data = { success: true };
                break;
            case 'UPDATE_DOCUMENT_VERSION':
                data = await container.documentsUseCases.updateVersion(message.data.versionId, message.data.updates);
                break;
            case 'DUPLICATE_DOCUMENT_VERSION':
                data = await container.documentsUseCases.duplicateVersion(message.data.versionId, message.data.options);
                break;
            case 'GET_TASK_DOCUMENTS':
                data = await container.documentsUseCases.listDocumentsByTask(message.data.taskId);
                break;
            case 'GET_TASK':
                data = await container.taskUseCases.getTaskById(message.data.taskId);
                break;
            case 'GET_TASK_PAGES':
                data = await container.taskUseCases.getPagesByTaskId(message.data.taskId);
                break;
            case 'GET_TASK_NOTES':
                data = await container.taskUseCases.getNotesByTaskId(message.data.taskId);
                break;

            case 'GET_CURRENT_TAB_INFO':
                data = await getCurrentTab();
                break;

            case 'GET_EXTENSION_CHAT_HISTORY':
                data = backgroundStore.user.extensionChatHistory;
                break;

            case 'GET_COMMAND_SUGGESTIONS':
                try {
                    const input = message.data?.input ?? ''
                    if (typeof input === 'string' && input.trim().startsWith('/')) {
                        const commandContext = container.commandService.createContext('chatbox', {
                            activeTask: container.analyticsService.getCurrentContext().activeTask,
                            recentTags: container.analyticsService.getCurrentContext().recentTags
                        })

                        data = await container.commandService.getSuggestions(input.trim(), commandContext)
                    } else {
                        data = []
                    }
                } catch (error) {
                    console.error('Error generating chatbox command suggestions:', error)
                    data = []
                }
                break;

            case 'EXTENSION_CHAT':
                try {
                    const chatContent: string = message.data?.content ?? ''
                    const trimmedContent = chatContent.trim()

                    if (trimmedContent.startsWith('/')) {
                        const commandContext = container.commandService.createContext('chatbox', {
                            activeTask: container.analyticsService.getCurrentContext().activeTask,
                            recentTags: container.analyticsService.getCurrentContext().recentTags
                        })

                        const commandRequest = {
                            input: trimmedContent,
                            context: commandContext,
                            timestamp: new Date()
                        }

                        const response = await container.commandService.processCommand(commandRequest)

                        const [rawCommand] = trimmedContent.slice(1).split(/\s+/)
                        const commandName = rawCommand?.toLowerCase()

                        let displayResponse = response
                        if (commandName === 'help' || commandName === '?' || commandName === 'h') {
                            const commandArgs = trimmedContent.slice(1).split(/\s+/).slice(1)
                            const helpTarget = commandArgs.join(' ') || undefined
                            const helpText = container.commandService.getHelp(helpTarget)
                            displayResponse = {
                                success: true,
                                type: 'text',
                                content: helpText,
                                followUp: response.followUp,
                                metadata: response.metadata
                            }
                        }

                        // Check if this is a component-based response
                        const isComponentResponse = displayResponse.type === 'task-list' || displayResponse.type === 'task-creator'

                        if (isComponentResponse) {
                            // For component responses, store the component data
                            const componentContent = `> ${trimmedContent}\n\n${displayResponse.content}`

                            backgroundStore.addExtensionChat({
                                content: componentContent,
                                command: commandName,
                                relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask,
                                componentData: displayResponse.componentData || displayResponse,
                                responseType: displayResponse.type
                            })
                        } else {
                            // For text responses, use the existing formatter
                            const formattedContent = formatCommandResponseForChat(trimmedContent, displayResponse)

                            backgroundStore.addExtensionChat({
                                content: formattedContent,
                                command: commandName,
                                relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask
                            })
                        }
                    } else {
                        backgroundStore.addExtensionChat({
                            content: chatContent,
                            command: message.data?.command,
                            relatedTask: message.data?.relatedTask || container.analyticsService.getCurrentContext().activeTask
                        })
                    }

                    data = { success: true }
                } catch (error) {
                    console.error('Chat command processing failed:', error)
                    data = { success: false, error: error instanceof Error ? error.message : String(error) }
                }
                break;

            case 'GET_USER_SETTINGS':
                data = backgroundStore.user.settings;
                break;

            case 'UPDATE_USER_SETTINGS':
                if (message.data?.preferredSearchEngine) {
                    await backgroundStore.setPreferredSearchEngine(message.data.preferredSearchEngine);
                }
                if (message.data?.preferredAiProvider) {
                    await backgroundStore.setPreferredAiProvider(message.data.preferredAiProvider);
                }
                if (typeof message.data?.reuseAiTab === 'boolean') {
                    await backgroundStore.setAiTabReusePreference(message.data.reuseAiTab);
                }
                if (typeof message.data?.aiLogLevel === 'string' && ['info', 'debug'].includes(message.data.aiLogLevel)) {
                    await backgroundStore.setAiLogLevelPreference(message.data.aiLogLevel);
                }
                data = backgroundStore.user.settings;
                break;

            case 'UPDATE_VERSION_MANAGEMENT_SETTINGS':
                await backgroundStore.updateVersionManagementSettings(message.data);
                data = backgroundStore.user.settings;
                break;

            case 'OPEN_PAGE':
                await focusOrOpenUrl(message.data.url);
                data = { success: true };
                break;

            case 'GET_SEARCH_SUGGESTIONS':
                data = await container.searchUseCases.getSearchSuggestions(message.data.query);
                break;

            case 'GET_POPULAR_TAGS':
                data = await container.searchUseCases.getPopularTags(message.data?.limit);
                break;

            case 'EXPORT_DATA':
                // TODO: Implement data export
                data = { message: 'Export not yet implemented' };
                break;

            case 'IMPORT_DATA':
                // TODO: Implement data import
                data = { message: 'Import not yet implemented' };
                break;

            case 'SAVE_SHORTCUT':
                // Save or update page with shortcut
                const existingPage = await container.pageService.getByUrl(message.data.url);
                if (existingPage) {
                    // Update existing page with shortcut
                    data = await container.pageService.update(existingPage.id, {
                        shortcut: message.data.shortcut
                    });
                } else {
                    // Create new page entry with shortcut
                    const currentTab = await getCurrentTab();
                    data = await container.pageUseCases.savePage({
                        url: message.data.url,
                        title: currentTab?.title || 'Untitled',
                        favicon: currentTab?.favicon,
                        shortcut: message.data.shortcut,
                        tags: []
                    });
                }
                break;

            case 'SAVE_TAGS':
                // Save or update page with tags
                const pageForTags = await container.pageService.getByUrl(message.data.url);
                if (pageForTags) {
                    // Update existing page with tags
                    data = await container.pageService.update(pageForTags.id, {
                        tags: message.data.tags
                    });
                } else {
                    // Create new page entry with tags
                    const currentTab = await getCurrentTab();
                    data = await container.pageUseCases.savePage({
                        url: message.data.url,
                        title: currentTab?.title || 'Untitled',
                        favicon: currentTab?.favicon,
                        tags: message.data.tags
                    });
                }
                break;

            case 'REMOVE_PAGE_FROM_TASK':
                await container.taskUseCases.removePageFromTask(message.data.taskName, message.data.pageId);
                data = { success: true };
                break;

            case 'OPEN_AUTHORING_WORKSPACE':
                {
                    const { documentId, taskId } = message.data;
                    const workspaceUrl = chrome.runtime.getURL('/authoring/index.html') +
                        `?documentId=${documentId}` +
                        (taskId ? `&taskId=${taskId}` : '');

                    await chrome.tabs.create({ url: workspaceUrl });
                    data = { success: true };
                }
                break;

            // AI Automation handlers
            case AI_MESSAGE_TYPES.AI_RUN_PROMPT:
                data = await handleAIRunPrompt(message.data as AIRunPromptRequest);
                break;

            case AI_MESSAGE_TYPES.AI_GET_SETTINGS:
                data = await getAISettings();
                break;

            case AI_MESSAGE_TYPES.AI_UPDATE_SETTINGS:
                await updateAISettings(message.data);
                data = await getAISettings();
                break;

            case AI_MESSAGE_TYPES.AI_UPDATE_SELECTORS:
                await updateAISelectors(message.data.provider, message.data.selectors);
                data = { success: true };
                break;

            case AI_MESSAGE_TYPES.AI_TEST_SELECTORS:
                data = await testAISelectors(message.data.provider, message.data.selectors);
                break;

            case 'AI_TEST_AUTOMATION':
                // Test command for verifying automation works
                console.log('[AI Test] Running automation test...')
                data = await handleAIRunPrompt({
                    prompt: message.data?.prompt || 'Hello, this is a test from Superowser extension',
                    context: {
                        currentTask: 'test',
                        documentTitle: 'Automation Test'
                    }
                });
                break;

            case 'AI_TEST_INJECTION':
                // Test content script injection
                console.log('[AI Test] Testing content script injection...')
                try {
                    const tab = await findOrCreateAITab('chatgpt')
                    console.log('[AI Test] Tab found/created:', tab.id)
                    await injectAIContentScript(tab.id!)
                    console.log('[AI Test] Content script injected successfully')

                    // Test if bridge is available
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id! },
                        func: () => window.hasOwnProperty('superowserAIBridge')
                    })
                    console.log('[AI Test] Bridge available:', results[0]?.result)
                    data = { success: true, bridgeAvailable: results[0]?.result }
                } catch (error) {
                    console.error('[AI Test] Injection failed:', error)
                    data = { success: false, error: error.message }
                }
                break;

            default:
                throw new Error(`Unknown message type: ${(message as any).type}`);
        }

        return {
            type: 'SUCCESS',
            id: message.id,
            data
        } as SuccessResponse;

    } catch (error) {
        throw error; // Will be caught by the outer catch block
    }
}

// AI Automation handler functions
export async function handleAIRunPrompt(request: AIRunPromptRequest): Promise<{ requestId: string }> {
    const requestId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
        const settings = await getAISettings()
        console.log('[AI Automation] handleAIRunPrompt called with settings:', settings)

        // Always focus the assistant tab so users know automation is running

        if (!settings.enabled) {
            throw new Error('AI automation is disabled')
        }

        // Track request context for later result logging
        aiAutomationRequests.set(requestId, {
            prompt: request.prompt,
            provider: settings.provider,
            task: request.context?.currentTask
        })

        // Send initial progress update
        await sendProgressUpdate(requestId, 'opening_tab', 'Opening AI provider tab...')

        // Find or create AI tab
        console.log('[AI Automation] Creating tab for provider:', settings.provider)
        const tab = await findOrCreateAITab(settings.provider)
        console.log('[AI Automation] Tab created/found:', { id: tab.id, active: tab.active })

        // Wait for tab to finish loading
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Tab loading timeout')), settings.timeout)

            const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    clearTimeout(timeout)
                    chrome.tabs.onUpdated.removeListener(listener)
                    resolve()
                }
            }

            chrome.tabs.onUpdated.addListener(listener)

            // If tab is already complete, resolve immediately
            if (tab.status === 'complete') {
                clearTimeout(timeout)
                chrome.tabs.onUpdated.removeListener(listener)
                resolve()
            }
        })

        await sendProgressUpdate(requestId, 'injecting_script', 'Preparing automation...')

        // Inject content script
        await injectAIContentScript(tab.id!)

        // Check tab state after injection
        const tabAfterInjection = await chrome.tabs.get(tab.id!)
        console.log('[AI Automation] Tab state after injection:', { id: tabAfterInjection.id, active: tabAfterInjection.active })

        await sendProgressUpdate(requestId, 'sending_prompt', 'Sending prompt to AI...')

        // Send execution request to content script
        const executeRequest: AIExecutePromptRequest = {
            prompt: request.prompt,
            selectors: settings.selectors,
            requestId
        }

        await chrome.tabs.sendMessage(tab.id!, {
            type: AI_MESSAGE_TYPES.AI_EXECUTE_PROMPT,
            data: executeRequest
        })



        return { requestId }

    } catch (error) {
        // Send error response
        const aiError: AIError = {
            requestId,
            reason: 'network_error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            details: error
        }

        sendRuntimeMessageSafe({
            type: AI_MESSAGE_TYPES.AI_ERROR,
            data: aiError
        })



        throw error
    }
}

async function updateAISettings(updates: Partial<AIAutomationSettings>): Promise<void> {
    const currentSettings = await getAISettings()
    const newSettings = { ...currentSettings, ...updates }

    // Store in background store
    await backgroundStore.updateAIAutomationSettings?.(newSettings)
}

async function updateAISelectors(provider: string, selectors: Partial<AIAutomationSettings['selectors']>): Promise<void> {
    const settings = await getAISettings()
    const newSelectors = { ...settings.selectors, ...selectors }

    await updateAISettings({ selectors: newSelectors })
}

async function testAISelectors(provider: string, selectors: AIAutomationSettings['selectors']): Promise<{ success: boolean; found: string[]; missing: string[] }> {
    try {
        const tab = await findOrCreateAITab(provider as 'chatgpt' | 'claude' | 'perplexity')
        await injectAIContentScript(tab.id!)

        // Test selectors via content script
        const result = await chrome.tabs.sendMessage(tab.id!, {
            type: 'TEST_SELECTORS',
            data: { selectors }
        })

        return result
    } catch (error) {
        throw new Error(`Failed to test selectors: ${error}`)
    }
}

async function getCurrentTab(): Promise<TabInfo | null> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.title) {
            return null;
        }

        return {
            id: tab.id!,
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl
        };
    } catch (error) {
        console.error('Error getting current tab:', error);
        return null;
    }
}
