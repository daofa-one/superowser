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
                if (message.includes('Receiving end does not exist') || message.includes('Could not establish connection')) {
                    return
                }
                console.warn('[superowser] Failed to deliver runtime message:', message)
            }
        })
    } catch (error) {
        console.warn('[superowser] Runtime message dispatch failed:', error)
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

// Initialize the background store with persisted data
backgroundStore.initialize(container).then(() => {
    console.log('[superowser] Background store initialized');
}).catch(error => {
    console.error('[superowser] Failed to initialize background store:', error);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[superowser] installed');
});


// Omnibox event handlers
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try {
        if (text.trim()) {
            const trimmed = text.trim();
            let omniboxSuggestions: chrome.omnibox.SuggestResult[] = [];

            // Context-aware suggestions based on what user is typing
            if (trimmed.startsWith('@')) {
                // Shortcut suggestions with page info
                const query = trimmed.slice(1);
                const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                omniboxSuggestions = suggestions.shortcuts.map(({ shortcut, page }) => {
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
            } else if (trimmed.startsWith('#')) {
                // Tag suggestions with page count and example
                const query = trimmed.slice(1);
                const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                omniboxSuggestions = suggestions.tags.map(({ tag, pages }) => {
                    const pageCount = pages.length;
                    const examplePage = pages[0];
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
            } else if (trimmed.startsWith('&')) {
                // Task suggestions
                const query = trimmed.slice(1);
                const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                omniboxSuggestions = suggestions.tasks.map(task => ({
                    content: `&${task}`,
                    description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
                }));
            } else if (trimmed.startsWith('!notes ') || trimmed.startsWith('!!')) {
                // Note search suggestions with actual search results
                const noteQuery = trimmed.startsWith('!!') ? trimmed.slice(2).trim() : trimmed.slice(7);
                if (noteQuery.trim()) {
                    try {
                        // Also try searching for all notes by using an empty search
                        const allNotesCheck = await container.noteService.search('');

                        const notes = await container.noteService.search(noteQuery);

                        if (notes.length > 0) {
                            omniboxSuggestions = notes.slice(0, 6).map((note) => {
                                const contentPreview = note.content.slice(0, 80);
                                const safeContent = escapeForXML(contentPreview);
                                const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 50)) : '';
                                const tagInfo = note.tags.length > 0 ? ` | ${note.tags.slice(0, 2).join(', ')}` : '';
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
                const suggestions = await container.searchUseCases.getSearchSuggestions(trimmed);

                const shortcutSuggestions = suggestions.shortcuts.map(({ shortcut, page }) => {
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

                const pageSuggestions = suggestions.pages.map(({ page }) => {
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

                const tagSuggestions = suggestions.tags.map(({ tag, pages }) => {
                    const pageCount = pages.length;
                    const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`;
                    const safeTag = escapeForXML(tag);
                    const safeCount = escapeForXML(countText);
                    return {
                        content: `#${tag}`,
                        description: `<match>#${safeTag}</match> - <dim>${safeCount}</dim>`
                    };
                });

                const taskSuggestions = suggestions.tasks.map(task => ({
                    content: `&${task}`,
                    description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
                }));

                const noteSuggestions = suggestions.notes.map(({ note }) => {
                    const contentPreview = note.content.slice(0, 60);
                    const safeContent = escapeForXML(contentPreview);
                    const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 40)) : '';
                    const tagInfo = note.tags.length > 0 ? ` | ${note.tags.slice(0, 2).join(', ')}` : '';
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
            }

            suggest(omniboxSuggestions.slice(0, 6)); // Limit to 6 suggestions
        }
    } catch (error) {
        console.error('Omnibox suggestion error:', error);
    }
});

chrome.omnibox.onInputEntered.addListener(async (text) => {
    try {
        const result = await container.searchUseCases.executeOmniboxCommand(text);

        if (result.type === 'open' && result.page) {
            await focusOrOpenUrl(result.page.url);
        } else if (result.type === 'task-activate') {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (currentTab && currentTab.id) {
                try {
                    await chrome.sidePanel.open({ tabId: currentTab.id });
                } catch (openError) {
                    console.warn('Failed to auto-open side panel from omnibox task activation:', openError);
                }

                // task-activate is handled via background state updates; no side panel push needed here.
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
                            await focusOrOpenUrl(page.url);
                        }
                    } else if (singleResult.type === 'note') {
                        // For note results, get the associated page if it exists
                        const note = await container.noteService.getById(singleResult.id);
                        if (note && note.pageId) {
                            const page = await container.pageService.getById(note.pageId);
                            if (page) {
                                await focusOrOpenUrl(page.url);
                                return; // Exit early since we opened the page
                            }
                        }
                        // If no page associated with note, show in side panel
                        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (currentTab && currentTab.id) {
                            try {
                                await chrome.sidePanel.open({ tabId: currentTab.id });
                            } catch (openError) {
                                console.warn('Failed to auto-open side panel for note result:', openError);
                            }
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
                    // Multiple results - open side panel to show them
                    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (currentTab && currentTab.id) {
                        let panelOpened = false;
                        try {
                            await chrome.sidePanel.open({ tabId: currentTab.id });
                            panelOpened = true;
                        } catch (openError) {
                            console.warn('Failed to auto-open side panel from omnibox input:', openError);
                        }

                const deliverResults = () => {
                    sendRuntimeMessageSafe({
                        type: 'OMNIBOX_RESULTS',
                        data: {
                            query: text,
                            results: result.results
                        }
                    });
                };

                if (panelOpened) {
                    setTimeout(deliverResults, 500);
                } else {
                    deliverResults();
                }
                    }
                }
            } else {
                console.log('No results found for:', text);
                // Could show a notification or open side panel with "no results" message
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

// Message handler for side panel communication
chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse: (response?: any) => void) => {
    if (!isRequestMessage(message)) {
        sendResponse({
            type: 'ERROR',
            error: { message: 'Invalid message format' }
        } as ErrorResponse);
        return true;
    }

    // Handle message asynchronously
    handleMessage(message)
        .then((response: ResponseMessage) => {
            sendResponse(response);
        })
        .catch((error: Error) => {
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

async function handleMessage(message: RequestMessage): Promise<ResponseMessage> {
    try {
        let data: any;

        switch (message.type) {
            case 'SAVE_PAGE':
                data = await container.pageUseCases.savePage(message.data);
                break;

            case 'SAVE_CURRENT_TAB':
                const currentTab = await getCurrentTab();
                if (!currentTab) {
                    throw new Error('No active tab found');
                }

                data = await container.pageUseCases.savePage({
                    url: currentTab.url,
                    title: currentTab.title,
                    favicon: currentTab.favicon,
                    ...message.data
                });
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

            case 'GET_CURRENT_TAB_INFO':
                data = await getCurrentTab();
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
