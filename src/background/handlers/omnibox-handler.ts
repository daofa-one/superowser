/**
 * Omnibox event handlers for Chrome omnibox API
 * Handles search suggestions and command execution
 */

import { escapeForXML } from '../utils/message-utils'
import { focusOrOpenUrl } from '../utils/url-utils'
import { LIMITS } from '../constants'
import { formatCommandResponseForChat } from '../../shared/commands/formatters'
import type { DIContainer } from '../container'

/**
 * Initialize omnibox event listeners
 * @param container - DI container for accessing services
 */
export function initializeOmniboxHandlers(container: DIContainer): void {
  // Omnibox input changed - show suggestions
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try {
      if (text.trim()) {
        const trimmed = text.trim()
        let omniboxSuggestions: chrome.omnibox.SuggestResult[] = []

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
          const query = trimmed.slice(1)
          try {
            const suggestions = await container.searchUseCases.getSearchSuggestions(query)
            omniboxSuggestions = (suggestions.shortcuts || []).map(({ shortcut, page }) => {
              let hostname = ''
              try {
                hostname = new URL(page.url).hostname
              } catch {
                hostname = page.url.split('/')[2] || page.url
              }
              const safeShortcut = escapeForXML(shortcut)
              const safeTitle = escapeForXML(page.title ?? '')
              const safeHostname = hostname ? escapeForXML(hostname) : ''
              return {
                content: `@${shortcut}`,
                description: `<match>@${safeShortcut}</match> - ${safeTitle}${safeHostname ? ` | <dim>${safeHostname}</dim>` : ''}`
              }
            })
          } catch (shortcutError) {
            console.error('Error getting shortcut suggestions:', shortcutError)
            omniboxSuggestions = [{
              content: trimmed,
              description: 'Error loading shortcut suggestions'
            }]
          }
        } else if (trimmed.startsWith('#')) {
          // Tag suggestions with page count and example
          const query = trimmed.slice(1)
          try {
            const suggestions = await container.searchUseCases.getSearchSuggestions(query)
            const tagSuggestions = (suggestions.tags || []).map(({ tag, pages }) => {
              const tagPages = Array.isArray(pages) ? pages : []
              const pageCount = tagPages.length
              const examplePage = pageCount > 0 ? tagPages[0] : null
              const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`
              let exampleHostname = ''
              if (examplePage) {
                try {
                  exampleHostname = new URL(examplePage.url).hostname
                } catch {
                  exampleHostname = examplePage.url.split('/')[2] || examplePage.url
                }
              }
              const safeTag = escapeForXML(tag)
              const safeCount = escapeForXML(countText)
              const safeHostname = exampleHostname ? escapeForXML(exampleHostname) : ''
              const descriptionExtras = safeHostname ? ` | ${safeHostname}` : ''
              return {
                content: `#${tag}`,
                description: `<match>#${safeTag}</match> - <dim>${safeCount}</dim>${descriptionExtras}`
              }
            })

            const typedTag = trimmed.slice(1)
            if (typedTag) {
              const normalizedTyped = typedTag.toLowerCase()
              const exactExists = tagSuggestions.some(entry => entry.content.toLowerCase() === `#${normalizedTyped}`)
              const safeTyped = escapeForXML(typedTag)

              if (!exactExists) {
                const hasResults = tagSuggestions.length > 0
                tagSuggestions.unshift({
                  content: `#${typedTag}`,
                  description: `<match>#${safeTyped}</match> - <dim>${hasResults ? 'Search tag' : 'No tagged pages found'}</dim>`
                })
              }
            }

            omniboxSuggestions = tagSuggestions.length > 0 ? tagSuggestions : [{
              content: `#${trimmed.slice(1)}`,
              description: `<match>#${escapeForXML(trimmed.slice(1))}</match> - <dim>No tagged pages found</dim>`
            }]
          } catch (tagError) {
            console.error('Error getting tag suggestions:', tagError)
            omniboxSuggestions = [{
              content: trimmed,
              description: 'Error loading tag suggestions'
            }]
          }
        } else if (trimmed.startsWith('&')) {
          // Task suggestions
          const query = trimmed.slice(1)
          try {
            const suggestions = await container.searchUseCases.getSearchSuggestions(query)
            omniboxSuggestions = (suggestions.tasks || []).map(task => ({
              content: `&${task}`,
              description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
            }))
          } catch (taskError) {
            console.error('Error getting task suggestions:', taskError)
            omniboxSuggestions = [{
              content: trimmed,
              description: 'Error loading task suggestions'
            }]
          }
        } else if (trimmed.startsWith('!notes ') || trimmed.startsWith('!!')) {
          // Note search suggestions with actual search results
          const noteQuery = trimmed.startsWith('!!') ? trimmed.slice(2).trim() : trimmed.slice(7)
          if (noteQuery.trim()) {
            try {
              // Also try searching for all notes by using getAll
              const allNotesRaw = await container.noteService.getAll(1000)
              const allNotesCheck = Array.isArray(allNotesRaw) ? allNotesRaw : []
              console.log('Debug: Notes search - total notes:', allNotesCheck.length, 'query:', noteQuery)

              const notesRaw = await container.noteService.search(noteQuery)
              const notes = Array.isArray(notesRaw) ? notesRaw : []
              console.log('Debug: Notes search results:', notes.length)

              if (notes.length > 0) {
                omniboxSuggestions = notes.slice(0, LIMITS.MAX_OMNIBOX_SUGGESTIONS).map((note) => {
                  const noteTags = Array.isArray(note.tags) ? note.tags : []
                  const contentPreview = note.content.slice(0, 80)
                  const safeContent = escapeForXML(contentPreview)
                  const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 50)) : ''
                  const tagInfo = noteTags.length > 0 ? ` | ${noteTags.slice(0, 2).join(', ')}` : ''
                  const commentInfo = safeComment ? ` - ${safeComment}` : ''

                  const prefix = trimmed.startsWith('!!') ? '!!' : '!notes '
                  return {
                    content: `${prefix}${noteQuery}#${note.id}`,
                    description: `📝 <match>${safeContent}${contentPreview.length > 80 ? '...' : ''}</match>${commentInfo}<dim>${tagInfo}</dim>`
                  }
                })
              } else {
                const message = allNotesCheck.length === 0
                  ? `📝 No notes exist yet. Create notes by adding them from the side panel.`
                  : `📝 No notes found for "${noteQuery}"`
                const prefix = trimmed.startsWith('!!') ? '!!' : '!notes '
                omniboxSuggestions = [{
                  content: `${prefix}${noteQuery}`,
                  description: message
                }]
              }
            } catch (error) {
              console.error('Error searching notes:', error)
              const prefix = trimmed.startsWith('!!') ? '!!' : '!notes '
              omniboxSuggestions = [{
                content: `${prefix}${noteQuery}`,
                description: `📝 Error searching notes`
              }]
            }
          } else {
            const displayQuery = trimmed.startsWith('!!') ? trimmed.slice(2).trim() : trimmed.slice(7)
            omniboxSuggestions = [{
              content: trimmed,
              description: `Search notes for: ${displayQuery}`
            }]
          }
        } else {
          // General suggestions - show all types with rich info
          try {
            const suggestions = await container.searchUseCases.getSearchSuggestions(trimmed)

            const shortcutSuggestions: chrome.omnibox.SuggestResult[] = []
            const seenShortcuts = new Set<string>()

            const typedShortcut = trimmed.startsWith('@') ? trimmed.slice(1) : ''
            if (typedShortcut) {
              const normalizedTyped = typedShortcut.toLowerCase()
              const safeTypedShortcut = escapeForXML(typedShortcut)
              const typedKey = `@${normalizedTyped}`
              shortcutSuggestions.push({
                content: `@${typedShortcut}`,
                description: `<match>@${safeTypedShortcut}</match> - <dim>Open shortcut</dim>`
              })
              seenShortcuts.add(typedKey)
            }

            ;(suggestions.shortcuts || []).forEach(({ shortcut, page }) => {
              const normalizedShortcut = shortcut?.trim()
              if (!normalizedShortcut) {
                return
              }

              const shortcutKey = `@${normalizedShortcut.toLowerCase()}`
              if (seenShortcuts.has(shortcutKey)) {
                return
              }

              let hostname = ''
              try {
                hostname = new URL(page.url).hostname
              } catch {
                hostname = page.url.split('/')[2] || page.url
              }
              const safeShortcut = escapeForXML(normalizedShortcut)
              const safeTitle = escapeForXML(page.title ?? '')
              const safeHostname = hostname ? escapeForXML(hostname) : ''

              shortcutSuggestions.push({
                content: `@${normalizedShortcut}`,
                description: `<match>@${safeShortcut}</match> - ${safeTitle}${safeHostname ? ` | <dim>${safeHostname}</dim>` : ''}`
              })

              seenShortcuts.add(shortcutKey)
            })

            const pageSuggestions = (suggestions.pages || []).map(({ page }) => {
              let hostname = ''
              try {
                hostname = new URL(page.url).hostname
              } catch {
                hostname = page.url.split('/')[2] || page.url
              }
              const safeTitle = escapeForXML(page.title ?? page.url)
              const safeUrl = escapeForXML(page.url)
              const safeHostname = hostname ? escapeForXML(hostname) : ''
              return {
                content: page.url,
                description: `${safeHostname ? `<dim>${safeHostname}</dim> - ` : ''}<match>${safeTitle}</match> | <dim>${safeUrl}</dim>`
              }
            })

            const tagSuggestions: chrome.omnibox.SuggestResult[] = []
            const seenTags = new Set<string>()

            const typedTag = trimmed.startsWith('#') ? trimmed.slice(1) : ''
            if (typedTag) {
              const normalizedTyped = typedTag.toLowerCase()
              const safeTypedTag = escapeForXML(typedTag)
              const typedKey = `#${normalizedTyped}`
              tagSuggestions.push({
                content: `#${typedTag}`,
                description: `<match>#${safeTypedTag}</match> - <dim>Search tag</dim>`
              })
              seenTags.add(typedKey)
            }

            ;(suggestions.tags || []).forEach(({ tag, pages }) => {
              const normalizedTag = (tag ?? '').trim()
              if (!normalizedTag) {
                return
              }

              const tagKey = `#${normalizedTag.toLowerCase()}`
              if (seenTags.has(tagKey)) {
                return
              }

              const tagPages = Array.isArray(pages) ? pages : []
              const pageCount = tagPages.length
              const countText = pageCount === 1 ? '1 page' : `${pageCount} pages`
              const safeTag = escapeForXML(normalizedTag)
              const safeCount = escapeForXML(countText)

              tagSuggestions.push({
                content: `#${normalizedTag}`,
                description: `<match>#${safeTag}</match> - <dim>${safeCount}</dim>`
              })

              seenTags.add(tagKey)
            })

            const taskSuggestions = (suggestions.tasks || []).map(task => ({
              content: `&${task}`,
              description: `<match>&amp;${escapeForXML(task)}</match> - <dim>Show task</dim>`
            }))

            const noteSuggestions = (suggestions.notes || []).map(({ note }) => {
              const contentPreview = (note.content || '').slice(0, 60)
              const safeContent = escapeForXML(contentPreview)
              const safeComment = note.comment ? escapeForXML(note.comment.slice(0, 40)) : ''
              const noteTags = Array.isArray(note.tags) ? note.tags : []
              const tagInfo = noteTags.length > 0 ? ` | ${noteTags.slice(0, 2).join(', ')}` : ''
              const commentInfo = safeComment ? ` - ${safeComment}` : ''

              return {
                content: `!notes ${trimmed}#${note.id}`,
                description: `📝 <match>${safeContent}${contentPreview.length > 60 ? '...' : ''}</match>${commentInfo}<dim>${tagInfo}</dim>`
              }
            })

            const interleaved: chrome.omnibox.SuggestResult[] = []
            const queues: chrome.omnibox.SuggestResult[][] = [
              shortcutSuggestions,
              pageSuggestions,
              tagSuggestions,
              taskSuggestions,
              noteSuggestions
            ]

            const pushNext = (queue: chrome.omnibox.SuggestResult[]) => {
              if (queue.length && interleaved.length < LIMITS.MAX_OMNIBOX_SUGGESTIONS) {
                interleaved.push(queue.shift()!)
              }
            }

            while (interleaved.length < LIMITS.MAX_OMNIBOX_SUGGESTIONS && queues.some(queue => queue.length)) {
              queues.forEach(pushNext)
            }

            // In case one category had more leftovers, fill the remaining slots respecting the limit.
            const remaining = [
              ...shortcutSuggestions,
              ...pageSuggestions,
              ...tagSuggestions,
              ...taskSuggestions,
              ...noteSuggestions
            ]
            while (interleaved.length < LIMITS.MAX_OMNIBOX_SUGGESTIONS && remaining.length) {
              interleaved.push(remaining.shift()!)
            }

            omniboxSuggestions = interleaved
          } catch (suggestionError) {
            console.error('Error getting search suggestions:', suggestionError)
            omniboxSuggestions = [{
              content: trimmed,
              description: 'Error loading suggestions'
            }]
          }
        }

        suggest(omniboxSuggestions.slice(0, LIMITS.MAX_OMNIBOX_SUGGESTIONS))
      }
    } catch (error) {
      console.error('Omnibox suggestion error:', error)
    }
  })

  // Omnibox input entered - execute command
  chrome.omnibox.onInputEntered.addListener(async (text) => {
    try {
      // Check if this is a command (starts with /)
      if (text.trim().startsWith('/')) {
        await handleCommandExecution(text.trim(), container)
        return // Exit early for commands
      }

      // Continue with existing omnibox command logic for @, #, &, !! syntax
      const result = await container.searchUseCases.executeOmniboxCommand(text)

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
        })

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
        )
        await focusOrOpenUrl(result.page.url)
      } else if (result.type === 'task-activate') {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (currentTab && currentTab.id) {
          // task-activate is handled via background state updates; no side panel push needed here.
          // Note: Cannot programmatically open sidepanel due to user gesture restrictions
        }
      } else if (result.type === 'filter' || result.type === 'search') {
        await handleSearchResults(text, result, container)
      } else if (result.type === 'error') {
        console.error('Omnibox command error:', result.message)
      }
    } catch (error) {
      console.error('Omnibox command execution error:', error)
    }
  })
}

/**
 * Handle command execution from omnibox
 */
async function handleCommandExecution(commandInput: string, container: DIContainer): Promise<void> {
  const commandContext = container.commandService.createContext('omnibox', {
    activeTask: container.analyticsService.getCurrentContext().activeTask,
    recentTags: container.analyticsService.getCurrentContext().recentTags
  })

  const commandRequest = {
    input: commandInput,
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
        chrome.runtime.sendMessage({
          type: 'COMMAND_NAVIGATION',
          data: {
            target: response.navigation.target,
            message: response.content,
            preserveCommand: response.navigation.preserveCommand
          }
        }, () => {
          // Ignore expected disconnection errors
          if (chrome.runtime.lastError) {
            // Silently handle
          }
        })

        // Also show a result in the omnibox result format
        chrome.runtime.sendMessage({
          type: 'OMNIBOX_RESULTS',
          data: {
            query: commandInput,
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
        }, () => {
          // Ignore expected disconnection errors
          if (chrome.runtime.lastError) {
            // Silently handle
          }
        })
      }

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

      container.backgroundStore?.addExtensionChat?.({
        content: formattedContent,
        command: commandName,
        relatedTask: container.analyticsService.getCurrentContext().activeTask
      })
    }
  } else {
    // Handle command errors - also include the original command for context
    const formattedError = formatCommandResponseForChat(commandInput, response)

    console.error('[Command Error]', response.error?.message || 'Unknown error')

    container.backgroundStore?.addExtensionChat?.({
      content: formattedError,
      command: commandInput.startsWith('/') ? commandInput.slice(1).split(/\s+/)[0]?.toLowerCase() : undefined,
      relatedTask: container.analyticsService.getCurrentContext().activeTask
    })
  }
}

/**
 * Handle search/filter results from omnibox
 */
async function handleSearchResults(text: string, result: any, container: DIContainer): Promise<void> {
  if (result.results && result.results.length > 0) {
    if (result.results.length === 1) {
      // If only one result, open it directly
      const singleResult = result.results[0]
      if (singleResult.type === 'page') {
        // Get the full page data
        const page = await container.pageService.getById(singleResult.id)
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
          })
          await focusOrOpenUrl(page.url)
        }
      } else if (singleResult.type === 'note') {
        // For note results, get the associated page if it exists
        const note = await container.noteService.getById(singleResult.id)
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
          })

          if (note.pageId) {
            const page = await container.pageService.getById(note.pageId)
            if (page) {
              await focusOrOpenUrl(page.url)
              return // Exit early since we opened the page
            }
          }
        }
        // If no page associated with note, show in side panel
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (currentTab && currentTab.id) {
          // Send results for side panel
          chrome.runtime.sendMessage({
            type: 'OMNIBOX_RESULTS',
            data: {
              query: text,
              results: [singleResult]
            }
          }, () => {
            // Ignore expected disconnection errors
            if (chrome.runtime.lastError) {
              // Silently handle
            }
          })
        }
        return // Exit early to avoid the multiple results handling
      }
    } else {
      // Multiple results - send results to side panel if open
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (currentTab && currentTab.id) {
        // Send results for side panel
        chrome.runtime.sendMessage({
          type: 'OMNIBOX_RESULTS',
          data: {
            query: text,
            results: result.results
          }
        }, () => {
          // Ignore expected disconnection errors
          if (chrome.runtime.lastError) {
            // Silently handle
          }
        })
      }
    }
  } else {
    console.log('No results found for:', text)
    // Send empty results to side panel so it can still navigate to Home
    chrome.runtime.sendMessage({
      type: 'OMNIBOX_RESULTS',
      data: {
        query: text,
        results: []
      }
    }, () => {
      // Ignore expected disconnection errors
      if (chrome.runtime.lastError) {
        // Silently handle
      }
    })
  }
}
