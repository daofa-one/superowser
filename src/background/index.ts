import { DIContainer } from './container'
import {
  RequestMessage,
  ResponseMessage,
  SuccessResponse,
  ErrorResponse,
  TabInfo,
  isRequestMessage
} from './messaging/message-types'

// Initialize dependency injection container
const container = DIContainer.getInstance()

chrome.runtime.onInstalled.addListener(() => {
    console.log('[superowser] installed');
});

// Handle action clicks to open side panel
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Message handler for side panel communication
chrome.runtime.onMessage.addListener((message: RequestMessage, _sender, sendResponse) => {
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