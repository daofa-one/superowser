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
// Initialize dependency injection container and shared store
const container = DIContainer.getInstance()
const pinia = createPinia()
setActivePinia(pinia)
const backgroundStore = useBackgroundStore()

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
                    return {
                        content: `@${shortcut}`,
                        description: `<match>@${shortcut}</match> - ${page.title} | <dim>${hostname}</dim>`
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
                    const exampleTitle = examplePage ? ` | ${examplePage.title}` : '';
                    let exampleHostname = '';
                    if (examplePage) {
                        try {
                            exampleHostname = new URL(examplePage.url).hostname;
                        } catch {
                            exampleHostname = examplePage.url.split('/')[2] || examplePage.url;
                        }
                    }
                    return {
                        content: `#${tag}`,
                        description: `<match>#${tag}</match> - <dim>${countText}</dim>${exampleTitle ? ` | ${exampleHostname}` : ''}`
                    };
                });
            } else if (trimmed.startsWith('&')) {
                // Task suggestions
                const query = trimmed.slice(1);
                const suggestions = await container.searchUseCases.getSearchSuggestions(query);
                omniboxSuggestions = suggestions.tasks.map(task => ({
                    content: `&${task}`,
                    description: `<match>&${task}</match> - <dim>Show task</dim>`
                }));
            } else if (trimmed.startsWith('!notes ')) {
                // Note search suggestions - could add note-specific suggestions here
                omniboxSuggestions = [{
                    content: trimmed,
                    description: `Search notes for: ${trimmed.slice(7)}`
                }];
            } else {
                // General suggestions - show all types with rich info
                const suggestions = await container.searchUseCases.getSearchSuggestions(trimmed);
                omniboxSuggestions = [
                    ...suggestions.shortcuts.map(({ shortcut, page }) => {
                        let hostname = '';
                        try {
                            hostname = new URL(page.url).hostname;
                        } catch {
                            hostname = page.url.split('/')[2] || page.url;
                        }
                        return {
                            content: `@${shortcut}`,
                            description: `<match>@${shortcut}</match> - ${page.title} | <dim>${hostname}</dim>`
                        };
                    }),
                    ...suggestions.tags.map(({ tag, pages }) => {
                        const pageCount = pages.length;
                        const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`;
                        return {
                            content: `#${tag}`,
                            description: `<match>#${tag}</match> - <dim>${countText}</dim>`
                        };
                    }),
                    ...suggestions.tasks.map(task => ({
                        content: `&${task}`,
                        description: `<match>&${task}</match> - <dim>Show task</dim>`
                    }))
                ];
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
            // Open the page in a new tab
            await chrome.tabs.create({
                url: result.page.url,
                active: true
            });
        } else if (result.type === 'filter' || result.type === 'search') {
            // Handle search/filter results
            if (result.results && result.results.length > 0) {
                if (result.results.length === 1) {
                    // If only one result, open it directly
                    const pageResult = result.results[0];
                    if (pageResult.type === 'page') {
                        // Get the full page data
                        const page = await container.pageService.getById(pageResult.id);
                        if (page) {
                            await chrome.tabs.create({
                                url: page.url,
                                active: true
                            });
                        }
                    }
                } else {
                    // Multiple results - open side panel to show them
                    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (currentTab && currentTab.id) {
                        await chrome.sidePanel.open({ tabId: currentTab.id });
                        // Send search results to side panel
                        setTimeout(() => {
                            chrome.runtime.sendMessage({
                                type: 'OMNIBOX_RESULTS',
                                data: {
                                    query: text,
                                    results: result.results
                                }
                            });
                        }, 500); // Small delay to ensure side panel is ready
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
                data = await container.noteService.save(message.data);
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
                data = backgroundStore.user.workingSet;
                break;

            case 'MOVE_PAGE_TO_TASK':
                data = await container.pageUseCases.movePageToTask(message.data.pageId, message.data.taskName);
                break;

            case 'UPDATE_PAGE':
                data = await container.pageService.update(message.data.id, message.data.updates);
                break;

            case 'DELETE_PAGE':
                await container.pageUseCases.deletePageAndCleanup(message.data.id);
                data = { success: true };
                break;

            case 'GET_CURRENT_TAB_INFO':
                data = await getCurrentTab();
                break;

            case 'OPEN_PAGE':
                await chrome.tabs.create({
                    url: message.data.url,
                    active: !message.data.newTab
                });
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
