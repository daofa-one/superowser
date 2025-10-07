// Integrated command service that has access to all background services

import { CommandService } from '../../shared/commands/command-service'
import { DIContainer } from '../container'
import {
  CommandDefinition,
  CommandContext,
  CommandResponse,
  ResolvedParameters
} from '../../shared/commands/types'
import { CommandExecutor } from '../../shared/commands/executor'
import { AI_MESSAGE_TYPES } from '../../shared/messaging/ai-types'
import { handleAIRunPrompt } from '../index'

export class IntegratedCommandService extends CommandService {
  constructor(private container: DIContainer) {
    super()
    try {
      // Clear any existing commands that were registered by the base class
      this.clearExistingCommands()
      this.registerIntegratedCommands()
    } catch (error) {
      console.error('Failed to initialize IntegratedCommandService:', error)
      // Continue initialization even if some commands fail to register
    }
  }

  private clearExistingCommands(): void {
    // Unregister existing commands that were registered by the base class
    const registry = this.getRegistry()
    registry.unregister('settask')
    registry.unregister('tasks')
    registry.unregister('newtask')
    registry.unregister('help')
    registry.unregister('?')
    registry.unregister('commands')
    registry.unregister('version')
    registry.unregister('v')
  }

  private registerIntegratedCommands(): void {
    const commands = [
      { name: 'settask', factory: () => this.createIntegratedSetTaskCommand() },
      { name: 'tasks', factory: () => this.createIntegratedTasksCommand() },
      { name: 'newtask', factory: () => this.createIntegratedNewTaskCommand() },
      { name: 'search', factory: () => this.createIntegratedSearchCommand() },
      { name: 'ai', factory: () => this.createIntegratedAiCommand() },
      { name: 'save', factory: () => this.createIntegratedSaveCommand() },
      { name: 'open', factory: () => this.createIntegratedOpenCommand() },
      { name: 'notes', factory: () => this.createIntegratedNotesCommand() },
      { name: 'draft', factory: () => this.createIntegratedDraftCommand() },
      { name: 'compose', factory: () => this.createIntegratedComposeCommand() },
      { name: 'help', factory: () => this.createIntegratedHelpCommand() },
      { name: 'version', factory: () => this.createIntegratedVersionCommand() }
    ]

    commands.forEach(({ name, factory }) => {
      try {
        this.registerCommand(factory())
      } catch (error) {
        console.error(`Failed to register command '${name}':`, error)
        // Continue with other commands
      }
    })
  }

  private createIntegratedSearchCommand(): CommandDefinition {
    const searchEngines: Record<string, (query: string) => string> = {
      google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    }

    return {
      name: 'search',
      aliases: ['websearch', 'google'],
      description: 'Open a web search in a new tab',
      category: 'navigation',
      parameters: [
        {
          name: 'query',
          type: 'string',
          required: false,
          description: 'Search query text'
        },
        {
          name: 'engine',
          type: 'string',
          required: false,
          description: 'Search engine to use (google, duckduckgo, bing)',
          validation: {
            pattern: /^(google|duckduckgo|bing)$/i
          }
        }
      ],
      examples: [
        '/search superowser extension',
        '/search --engine=duckduckgo keyboard shortcuts',
        '/google task management best practices'
      ],
      minParameters: 0,

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        const queryTokens = params._positional.length > 0
          ? params._positional
          : (params.query ? [params.query as string] : [])

        const query = queryTokens.join(' ').trim()
        if (!query) {
          return CommandExecutor.createErrorResponse(
            'Please provide a search query',
            'SEARCH_QUERY_REQUIRED',
            '/search <query>'
          )
        }

        const defaultEngine = 'google'
        const settings = this.container.backgroundStore?.user?.settings
        const preferred = (settings?.preferredSearchEngine || defaultEngine).toLowerCase()
        const engineParam = (params.engine as string | undefined)?.toLowerCase() || preferred
        const engineKey = searchEngines[engineParam] ? engineParam : defaultEngine
        const buildUrl = searchEngines[engineKey]
        const url = buildUrl(query)

        let reusedExistingTab = false
        let tabInfo: { tabId: number; windowId?: number } | null = null

        try {
          tabInfo = this.container.backgroundStore?.getLastSearchTab?.(engineKey) ?? null

          if (tabInfo?.tabId != null) {
            try {
              const existingTab = await chrome.tabs.get(tabInfo.tabId)
              if (existingTab && existingTab.id != null) {
                await chrome.tabs.update(existingTab.id, { url, active: true })
                if (existingTab.windowId != null) {
                  await chrome.windows.update(existingTab.windowId, { focused: true })
                }
                reusedExistingTab = true
                tabInfo = { tabId: existingTab.id, windowId: existingTab.windowId }
              }
            } catch (error) {
              console.warn('Failed to reuse existing search tab:', error)
              this.container.backgroundStore?.clearSearchTabById?.(tabInfo.tabId)
            }
          }

          if (!reusedExistingTab) {
            const createdTab = await chrome.tabs.create({ url })
            if (createdTab?.id != null) {
              tabInfo = { tabId: createdTab.id, windowId: createdTab.windowId }
            }
          }

          if (tabInfo?.tabId != null) {
            this.container.backgroundStore?.setLastSearchTab?.(engineKey, tabInfo)
          }
        } catch (error) {
          return CommandExecutor.createErrorResponse(
            'Unable to open browser tab for search',
            'SEARCH_NAVIGATION_FAILED',
            'Check browser permissions and try again'
          )
        }

        try {
          this.container.backgroundStore?.setLastSearchContext?.({
            query,
            engine: engineKey
          })
        } catch (error) {
          console.warn('Failed to record search context:', error)
        }

        const confirmation = `Opened ${engineKey} search for "${query}"`

        if (context.source === 'omnibox') {
          return CommandExecutor.createNavigationResponse('chat', confirmation)
        }

        return CommandExecutor.createSuccessResponse('text', confirmation, {
          followUp: [`/search --engine=${engineKey} ${query} site:`, '/search <new query>']
        })
      }
    }
  }

  private createIntegratedAiCommand(): CommandDefinition {
    const matchesHost = (value: string | undefined | null, hosts: string[]): boolean => {
      if (!value) {
        return false
      }
      try {
        const hostname = new URL(value).hostname.toLowerCase()
        return hosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
      } catch {
        return false
      }
    }

    const providers: Record<string, {
      label: string
      buildUrl: (query?: string) => string
      supportsQuery?: boolean
      matches: (url?: string | null) => boolean
    }> = {
      chatgpt: {
        label: 'ChatGPT',
        buildUrl: (query) => query && query.length > 0
          ? `https://chatgpt.com/?q=${encodeURIComponent(query)}`
          : 'https://chatgpt.com/',
        supportsQuery: true,
        matches: (url) => matchesHost(url, ['chatgpt.com', 'chat.openai.com'])
      },
      claude: {
        label: 'Claude',
        buildUrl: () => 'https://claude.ai/new',
        supportsQuery: false,
        matches: (url) => matchesHost(url, ['claude.ai'])
      },
      perplexity: {
        label: 'Perplexity',
        buildUrl: (query) => query && query.length > 0
          ? `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`
          : 'https://www.perplexity.ai/',
        matches: (url) => matchesHost(url, ['perplexity.ai'])
      },
      copilot: {
        label: 'Copilot',
        buildUrl: (query) => query && query.length > 0
          ? `https://copilot.microsoft.com/?q=${encodeURIComponent(query)}`
          : 'https://copilot.microsoft.com/',
        matches: (url) => matchesHost(url, ['copilot.microsoft.com'])
      },
      gemini: {
        label: 'Gemini',
        buildUrl: (query) => query && query.length > 0
          ? `https://gemini.google.com/app?q=${encodeURIComponent(query)}`
          : 'https://gemini.google.com/app',
        matches: (url) => matchesHost(url, ['gemini.google.com'])
      }
    }

    return {
      name: 'ai',
      aliases: ['assistant', 'chatgpt'],
      description: 'Open your preferred AI assistant in a new tab',
      category: 'navigation',
      parameters: [
        {
          name: 'query',
          type: 'string',
          required: false,
          description: 'Prompt or topic to discuss'
        },
        {
          name: 'provider',
          type: 'string',
          required: false,
          description: 'AI provider (chatgpt, claude, perplexity, copilot, gemini)',
          validation: {
            pattern: /^(chatgpt|claude|perplexity|copilot|gemini)$/i
          }
        }
      ],
      examples: [
        '/ai brainstorming research outline',
        '/ai --provider=claude market analysis plan'
      ],
      minParameters: 0,

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        const queryTokens = params._positional.length > 0
          ? params._positional
          : (params.query ? [params.query as string] : [])

        const query = queryTokens.join(' ').trim()

        const defaultProvider = (this.container.backgroundStore?.user?.settings?.preferredAiProvider || 'chatgpt').toLowerCase()
        const providerParam = (params.provider as string | undefined)?.toLowerCase()
        const providerKey = providers[providerParam ?? defaultProvider]
          ? (providerParam ?? defaultProvider)
          : 'chatgpt'

        // If query is provided and provider is ChatGPT, try AI automation first
        if (query && providerKey === 'chatgpt') {
          try {
            console.log('[AI Command] Attempting automation for query:', query)

            // Create AI automation request
            const aiRequest = {
              id: `ai_cmd_${Date.now()}`,
              type: AI_MESSAGE_TYPES.AI_RUN_PROMPT,
              data: {
                prompt: query,
                context: {
                  currentTask: context.activeTask,
                  documentTitle: 'AI Command'
                }
              },
              timestamp: Date.now()
            }

            console.log('[AI Command] Initiating AI_RUN_PROMPT directly via background handler')

            const response = await handleAIRunPrompt(aiRequest.data)

            if (response?.requestId) {
              console.log('[AI Command] Automation request accepted:', response)
              return CommandExecutor.createSuccessResponse(
                'text',
                `✨ AI automation started in background. Your prompt "${query}" is being processed.`,
                {
                  metadata: {
                    provider: providerKey,
                    query,
                    requestId: response.requestId,
                    automated: true
                  }
                }
              )
            } else {
              console.warn('[AI Command] Automation returned no requestId')
              throw new Error('Automation failed')
            }
          } catch (error) {
            console.warn('[AI Command] Automation failed, falling back to manual tab:', error)
            // Fall through to manual tab creation
          }
        }

        const provider = providers[providerKey]
        const url = provider.buildUrl(query)

        const settings = this.container.backgroundStore?.user?.settings
        const reuseExisting = settings?.reuseAiTab === true

        let reusedExistingTab = false

        if (reuseExisting) {
          try {
            const tabs = await chrome.tabs.query({})
            const existingTab = tabs.find(tab => provider.matches(tab.url || (tab as any)?.pendingUrl))

            if (existingTab && existingTab.id != null) {
              reusedExistingTab = true

              if (provider.supportsQuery && query) {
                await chrome.tabs.update(existingTab.id, { url, active: true })
              } else {
                await chrome.tabs.update(existingTab.id, { active: true })
              }

              await chrome.windows.update(existingTab.windowId, { focused: true })
            }
          } catch (error) {
            console.warn('AI command failed to reuse assistant tab:', error)
          }
        }

        if (!reusedExistingTab) {
          try {
            await chrome.tabs.create({ url })
          } catch (error) {
            return CommandExecutor.createErrorResponse(
              'Unable to open assistant in a new tab',
              'AI_NAVIGATION_FAILED',
              'Check browser permissions and try again'
            )
          }
        }

        const providerLabel = provider.label
        const baseMessage = query
          ? `Opened ${providerLabel} for "${query}"`
          : `Opened ${providerLabel}`

        const additional = query && provider.supportsQuery === false
          ? '\n⚠️ This assistant does not accept prompts via URL. Paste your prompt after the page loads.'
          : ''

        const message = `${baseMessage}${additional}`

        if (context.source === 'omnibox') {
          return CommandExecutor.createNavigationResponse('chat', message)
        }

        return CommandExecutor.createSuccessResponse('text', message, {
          followUp: [
            '/notes --task',
            '/ai new idea'
          ]
        })
      }
    }
  }

  private createIntegratedSaveCommand(): CommandDefinition {
    return {
      name: 'save',
      aliases: ['savepage', 'bookmark'],
      description: 'Save the current page with tags and task',
      category: 'page',
      parameters: [
        {
          name: 'tags',
          type: 'string',
          required: false,
          description: 'Comma-separated tags for the page'
        },
        {
          name: 'task',
          type: 'string',
          required: false,
          description: 'Task to associate with the page'
        },
        {
          name: 'shortcut',
          type: 'string',
          required: false,
          description: 'Shortcut name for quick access (@shortcut)'
        }
      ],
      examples: [
        '/save',
        '/save --tags="research,documentation"',
        '/save --task="project-alpha" --shortcut="docs"'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          // Get current tab info
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (!currentTab || !currentTab.url) {
            return CommandExecutor.createErrorResponse(
              'No active tab found',
              'NO_ACTIVE_TAB'
            )
          }

          // Parse parameters
          const tags = params.tags ? (params.tags as string).split(',').map(t => t.trim()).filter(Boolean) : []
          const taskName = params.task as string || await this.getCurrentActiveTask() || undefined
          const shortcut = params.shortcut as string || undefined

          // Save the page
          const savedPage = await this.container.pageUseCases.savePage({
            url: currentTab.url,
            title: currentTab.title || 'Untitled',
            tags,
            taskName,
            shortcut,
            source: 'command'
          })

          const message = `✅ Saved: ${savedPage.title}`
          const details = []
          if (tags.length > 0) details.push(`Tags: ${tags.join(', ')}`)
          if (taskName) details.push(`Task: ${taskName}`)
          if (shortcut) details.push(`Shortcut: @${shortcut}`)

          const fullMessage = details.length > 0
            ? `${message}\n${details.join(' | ')}`
            : message

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('home', fullMessage)
          }

          return CommandExecutor.createSuccessResponse('text', fullMessage, {
            followUp: ['/open @' + (shortcut || savedPage.title), '/notes --task']
          })

        } catch (error) {
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to save page',
            'SAVE_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedOpenCommand(): CommandDefinition {
    return {
      name: 'open',
      aliases: ['go', 'navigate'],
      description: 'Open a saved page by shortcut or search',
      category: 'navigation',
      parameters: [
        {
          name: 'target',
          type: 'string',
          required: false,
          description: 'Page shortcut (@shortcut) or search term'
        }
      ],
      examples: [
        '/open @docs',
        '/open github',
        '/open "project documentation"'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const target = params._positional[0] || params.target as string
          if (!target) {
            return CommandExecutor.createErrorResponse(
              'Please specify a page to open',
              'MISSING_TARGET',
              '/open @shortcut or /open "search term"'
            )
          }

          let page = null

          // Check if it's a shortcut (starts with @)
          if (target.startsWith('@')) {
            const shortcut = target.slice(1)
            const pages = await this.container.pageService.getByShortcut(shortcut)
            page = pages[0] || null
          } else {
            // Search for the page
            const searchResults = await this.container.searchService.searchPages(target, 1)
            page = searchResults[0] || null
          }

          if (!page) {
            return CommandExecutor.createErrorResponse(
              `No page found for: ${target}`,
              'PAGE_NOT_FOUND',
              'Try /open @shortcut or search with different terms'
            )
          }

          // Open the page
          await chrome.tabs.create({ url: page.url })

          return CommandExecutor.createSuccessResponse('text',
            `✅ Opened: ${page.title}`,
            { followUp: ['/save --tags', '/notes --page'] }
          )

        } catch (error) {
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to open page',
            'OPEN_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedNotesCommand(): CommandDefinition {
    return {
      name: 'notes',
      aliases: ['shownotes', 'listnotes'],
      description: 'Show notes by task, tag, or search',
      category: 'note',
      parameters: [
        {
          name: 'task',
          type: 'string',
          required: false,
          description: 'Show notes for specific task'
        },
        {
          name: 'tag',
          type: 'string',
          required: false,
          description: 'Show notes with specific tag'
        },
        {
          name: 'search',
          type: 'string',
          required: false,
          description: 'Search notes content'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Maximum number of notes to show (default 10, max 50)',
          defaultValue: 10
        }
      ],
      examples: [
        '/notes',
        '/notes --task="project-alpha"',
        '/notes --tag="research"',
        '/notes --search="important meeting"'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const taskName = params.task as string
          const tag = params.tag as string
          const searchTerm = params.search as string
          const rawLimit = typeof params.limit === 'number' ? params.limit : undefined
          const limit = Math.min(Math.max(rawLimit ?? 10, 1), 50)

          let notes = []

          if (taskName) {
            notes = await this.container.noteService.getByTask(taskName)
          } else if (tag) {
            notes = await this.container.noteService.getByTags([tag])
          } else if (searchTerm) {
            notes = await this.container.noteService.search(searchTerm)
          } else {
            // Get recent notes
            notes = await this.container.noteService.getAll()
            notes = notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          }

          notes = notes.slice(0, limit)

          if (notes.length === 0) {
            const filter = taskName ? `task "${taskName}"` :
                         tag ? `tag "${tag}"` :
                         searchTerm ? `search "${searchTerm}"` : 'any criteria'

            const message = `📝 No notes found for ${filter}`

            if (context.source === 'omnibox') {
              return CommandExecutor.createNavigationResponse('chat', message)
            }

            return CommandExecutor.createSuccessResponse('text', message, {
              followUp: ['/help notes', '/tasks']
            })
          }

          // Format notes for display
          const notesList = notes.map((note, index) => {
            const preview = note.content.slice(0, 50) + (note.content.length > 50 ? '...' : '')
            const taskInfo = note.tasks.length > 0 ? ` [${note.tasks.join(', ')}]` : ''
            return `${index + 1}. ${preview}${taskInfo}`
          }).join('\n')

          const title = `📝 Found ${notes.length} note(s)`
          const filter = taskName ? ` for task "${taskName}"` :
                        tag ? ` with tag "${tag}"` :
                        searchTerm ? ` matching "${searchTerm}"` : ''
          const fullTitle = `${title}${filter}`
          const fullContent = `${fullTitle}:\n\n${notesList}`

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('chat', fullContent)
          }

          return CommandExecutor.createSuccessResponse('list', {
            title: fullTitle,
            items: notes,
            formatted: notesList
          }, {
            followUp: ['/notes --task', '/help notes']
          })

        } catch (error) {
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to fetch notes',
            'NOTES_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedHelpCommand(): CommandDefinition {
    return {
      name: 'help',
      aliases: ['?', 'commands'],
      description: 'Show available commands and usage help',
      category: 'system',
      parameters: [
        {
          name: 'command',
          type: 'string',
          required: false,
          description: 'Get detailed help for a specific command'
        }
      ],
      examples: [
        '/help',
        '/help settask',
        '/? search'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        const specificCommand = params._positional[0] || params.command as string

        if (specificCommand) {
          // Get help for specific command
          const registry = this.getRegistry()
          const command = registry.getCommand(specificCommand)

          if (!command) {
            return CommandExecutor.createErrorResponse(
              `Command '${specificCommand}' not found`,
              'COMMAND_NOT_FOUND',
              'Use /help to see all available commands'
            )
          }

          const aliases = command.aliases.length > 0 ? ` (aliases: ${command.aliases.join(', ')})` : ''
          const params_info = command.parameters
            .map(p => `  --${p.name}: ${p.description}${p.required ? ' (required)' : ''}`)
            .join('\n')

          const examples = command.examples.length > 0
            ? `\nExamples:\n${command.examples.map(ex => `  ${ex}`).join('\n')}`
            : ''

          const helpText = `/${command.name}${aliases}\n${command.description}\n\nParameters:\n${params_info}${examples}`

          return CommandExecutor.createSuccessResponse('text', helpText)
        }

        // Show general help
        const registry = this.getRegistry()
        const allCommands = registry.getAllCommands()
        const categories = new Map<string, any[]>()

        // Group commands by category
        allCommands.forEach(cmd => {
          if (!categories.has(cmd.category)) {
            categories.set(cmd.category, [])
          }
          categories.get(cmd.category)!.push(cmd)
        })

        let helpText = '🤖 Superowser Commands\n\n'

        // Sort categories for consistent display
        const sortedCategories = Array.from(categories.entries()).sort(([a], [b]) => {
          const order = ['task', 'page', 'note', 'navigation', 'system']
          return order.indexOf(a) - order.indexOf(b)
        })

        sortedCategories.forEach(([category, commands]) => {
          const categoryName = category.charAt(0).toUpperCase() + category.slice(1)
          helpText += `📁 ${categoryName} Commands:\n`

          commands.forEach(cmd => {
            helpText += `  /${cmd.name} - ${cmd.description}\n`
          })
          helpText += '\n'
        })

        helpText += 'Use /help <command> for detailed information about a specific command.\n'
        helpText += '\nTip: Use quotes around multi-word arguments: /settask "my task"'

        if (context.source === 'omnibox') {
          return CommandExecutor.createNavigationResponse('chat', 'Command help displayed in chat')
        }

        return CommandExecutor.createSuccessResponse('text', helpText, {
          followUp: ['/help settask', '/help save', '/help search']
        })
      }
    }
  }

  private createIntegratedSetTaskCommand(): CommandDefinition {
    return {
      name: 'settask',
      aliases: ['task', 'switchtask'],
      description: 'Set the active task (creates if it doesn\'t exist)',
      category: 'task',
      parameters: [
        {
          name: 'name',
          type: 'string',
          required: false,
          description: 'Task name to set as active',
          validation: {
            minLength: 1,
            maxLength: 100
          }
        },
        {
          name: 'create',
          type: 'boolean',
          required: false,
          description: 'Force creation of new task',
          defaultValue: false
        },
        {
          name: 'description',
          type: 'string',
          required: false,
          description: 'Task description (for new tasks)'
        }
      ],
      examples: [
        '/settask "Project Alpha"',
        '/settask work-project',
        '/task --name="New Project" --create'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const positionalParts = Array.isArray(params._positional)
            ? params._positional.filter(part => typeof part === 'string' && part.trim().length > 0)
            : []

          const taskName = typeof params.name === 'string' && params.name.trim().length > 0
            ? params.name.trim()
            : positionalParts.length > 0
              ? positionalParts.join(' ').trim()
              : ''

          if (!taskName) {
            // Show current task
            const currentTask = await this.getCurrentActiveTask()
            if (currentTask) {
              return CommandExecutor.createSuccessResponse('text',
                `Current active task: ${currentTask}`,
                { followUp: ['/tasks', '/settask <new_task>'] }
              )
            } else {
              return CommandExecutor.createSuccessResponse('text',
                'No active task set',
                { followUp: ['/tasks', '/settask <task_name>'] }
              )
            }
          }

          const forceCreate = params.create === true

          // Check if task exists using real task service
          const existingTask = await this.findTaskByName(taskName)

          if (!existingTask && !forceCreate) {
            // Task doesn't exist, offer to create it
            return CommandExecutor.createSuccessResponse('confirmation',
              `Task "${taskName}" doesn't exist. Create it?`,
              {
                actions: [
                  {
                    id: 'create-task',
                    label: 'Create Task',
                    type: 'command',
                    action: `/settask --name="${taskName}" --create`,
                    style: 'primary'
                  }
                ]
              }
            )
          }

          // Create or switch to task
          let task = existingTask
          let created = false

          if (!existingTask || forceCreate) {
            // Create new task
            task = await this.container.taskUseCases.setActiveTask(taskName)
            created = true
          } else {
            // Switch to existing task
            task = await this.container.taskUseCases.setActiveTask(existingTask.name)
          }

          // Update analytics context
          this.container.analyticsService.setActiveTask(task.name)

          // Broadcast state update to notify UI about the task change
          try {
            chrome.runtime.sendMessage({
              type: 'STATE_UPDATE',
              path: 'currentTask',
              value: task,
              timestamp: new Date().toISOString()
            }, () => {
              // Ignore any errors - this is just for UI sync
              chrome.runtime.lastError
            })
          } catch (error) {
            console.warn('Failed to broadcast task state update:', error)
          }

          const message = created
            ? `Created and switched to task: ${taskName}`
            : `Switched to task: ${taskName}`

          // Return appropriate response based on interface
          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('home', message)
          } else {
            return CommandExecutor.createSuccessResponse('text', `✅ ${message}`, {
              followUp: ['/tasks', '/save --task', '/note --task']
            })
          }

        } catch (error) {
          console.error('SetTask command error:', error)
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to set task',
            'TASK_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedTasksCommand(): CommandDefinition {
    return {
      name: 'tasks',
      aliases: ['listtasks', 'showtasks'],
      description: 'List all tasks or search tasks',
      category: 'task',
      parameters: [
        {
          name: 'search',
          type: 'string',
          required: false,
          description: 'Search term to filter tasks'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Maximum number of tasks to show (default 10, max 50)',
          defaultValue: 10
        },
        {
          name: 'taskId',
          type: 'string',
          required: false,
          description: 'Show a specific task by ID'
        },
        {
          name: 'show',
          type: 'boolean',
          required: false,
          description: 'Show task details'
        },
        {
          name: 'detail',
          type: 'boolean',
          required: false,
          description: 'Show detailed task view'
        }
      ],
      examples: [
        '/tasks',
        '/tasks --search="project"',
        '/tasks --limit=10'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const searchTerm = params.search
          const rawLimit = typeof params.limit === 'number' ? params.limit : undefined
          const limit = Math.min(Math.max(rawLimit ?? 10, 1), 50)
          const taskId = typeof params.taskId === 'string' ? params.taskId : undefined
          const detailRequested = params.show === true || params.detail === true || !!taskId

          if (detailRequested && context.source === 'chatbox') {
            const detail = await this.buildTaskDetailResponse({ taskId, searchTerm, context })
            if (detail) {
              return detail
            }
          }

          // Get tasks with stats using task use cases
          let tasks = await this.container.taskUseCases.getAllTasksWithStats()

          // Apply search filter
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            tasks = tasks.filter(task =>
              task.name.toLowerCase().includes(searchLower) ||
              (task.description && task.description.toLowerCase().includes(searchLower))
            )
          }

          // Apply limit
          tasks = tasks.slice(0, limit)

          if (tasks.length === 0) {
            const message = searchTerm
              ? `📋 No tasks found matching "${searchTerm}"`
              : '📋 No tasks found'

            if (context.source === 'omnibox') {
              return CommandExecutor.createNavigationResponse('chat', message)
            }

            return CommandExecutor.createSuccessResponse('text', message, {
              followUp: ['/settask "new task"', '/help tasks']
            })
          }

          // Format task list
          const taskList = tasks.map(task =>
            `• ${task.name}${task.description ? ` - ${task.description}` : ''}`
          ).join('\n')

          const title = `📋 Found ${tasks.length} task(s)`
          const searchInfo = searchTerm ? ` matching "${searchTerm}"` : ''
          const fullTitle = `${title}${searchInfo}`
          const fullContent = `${fullTitle}:\n\n${taskList}`

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('chat', fullContent)
          }

          const componentTasks = await this.enrichTasksForComponent(tasks)

          return {
            success: true,
            type: 'task-list',
            content: fullContent,
            componentData: {
              tasks: componentTasks,
              interactive: true,
              filters: {
                search: searchTerm,
                status: 'all'
              }
            },
            followUp: ['/newtask', '/settask <task_name>']
          }

        } catch (error) {
          console.error('Tasks command error:', error)
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to fetch tasks',
            'TASK_FETCH_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedNewTaskCommand(): CommandDefinition {
    return {
      name: 'newtask',
      aliases: ['createtask', 'addtask'],
      description: 'Create a new task',
      category: 'task',
      parameters: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Task name'
        },
        {
          name: 'description',
          type: 'string',
          required: false,
          description: 'Task description'
        },
        {
          name: 'activate',
          type: 'boolean',
          required: false,
          description: 'Set as active task after creation',
          defaultValue: true
        }
      ],
      examples: [
        '/newtask "Project Planning"',
        '/newtask --name="Research" --description="Market research"'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const name = params._positional[0] || params.name
          const description = params.description
          const activate = params.activate !== false

          if (!name) {
            if (context.source === 'chatbox') {
              const existingTasks = await this.container.taskUseCases.getAllTasksWithStats()
              const componentTasks = await this.enrichTasksForComponent(existingTasks)

              return {
                success: true,
                type: 'task-creator',
                content: 'Create a new task',
                componentData: {
                  tasks: componentTasks,
                  showExisting: true,
                  interactive: true
                },
                followUp: ['/tasks', '/settask <task_name>']
              }
            }

            return CommandExecutor.createErrorResponse(
              'Task name is required',
              'MISSING_PARAMETER',
              'Provide a task name: /newtask "Task Name"'
            )
          }

          const existingTask = await this.findTaskByName(name)
          if (existingTask) {
            return CommandExecutor.createErrorResponse(
              `Task "${name}" already exists`,
              'TASK_EXISTS',
              'Try a different task name'
            )
          }

          const task = await this.container.taskUseCases.createTask(name, description)

          let responseMessage = `✅ Created task: ${name}`

          if (activate) {
            await this.container.taskUseCases.setActiveTask(task.name)
            this.container.analyticsService.setActiveTask(task.name)
            responseMessage += ` (now active)`

            // Broadcast state update to notify UI about the task change
            try {
              chrome.runtime.sendMessage({
                type: 'STATE_UPDATE',
                path: 'currentTask',
                value: task,
                timestamp: new Date().toISOString()
              }, () => {
                // Ignore any errors - this is just for UI sync
                chrome.runtime.lastError
              })
            } catch (error) {
              console.warn('Failed to broadcast task state update:', error)
            }
          }

          // Update description if provided
          if (context.source === 'omnibox' && activate) {
            return CommandExecutor.createNavigationResponse('home', responseMessage)
          } else {
            if (context.source === 'chatbox') {
              const componentTasks = await this.container.taskUseCases.getAllTasksWithStats()
              const enriched = await this.enrichTasksForComponent(componentTasks)

              return {
                success: true,
                type: 'task-list',
                content: responseMessage,
                componentData: {
                  tasks: enriched,
                  interactive: true,
                  showCreateForm: false
                },
                followUp: ['/tasks', '/save --task', '/note --task']
              }
            }

            return CommandExecutor.createSuccessResponse('text', responseMessage, {
              followUp: ['/tasks', '/save --task', '/note --task']
            })
          }

        } catch (error) {
          console.error('NewTask command error:', error)
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to create task',
            'TASK_CREATE_ERROR'
          )
        }
      }
    }
  }

  // Helper methods that use real services
  private async getCurrentActiveTask(): Promise<string | null> {
    try {
      const activeTask = await this.container.taskUseCases.getActiveTask()
      return activeTask?.name || null
    } catch (error) {
      console.error('Error getting active task:', error)
      return null
    }
  }

  private async findTaskByName(name: string): Promise<any | null> {
    try {
      const tasks = await this.container.taskService.getAll()
      return tasks.find(task => task.name.toLowerCase() === name.toLowerCase()) || null
    } catch (error) {
      console.error('Error finding task:', error)
      return null
    }
  }

  private async enrichTasksForComponent(tasks: any[]): Promise<any[]> {
    const activeTask = await this.container.taskUseCases.getActiveTask()
    const activeTaskName = activeTask?.name || this.container.analyticsService.getCurrentContext().activeTask

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      isActive: activeTaskName ? task.name === activeTaskName : task.isActive,
      pageCount: task.pageCount ?? task.pages?.length ?? 0,
      noteCount: task.noteCount ?? task.notes?.length ?? 0,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }))
  }

  private async buildTaskDetailResponse(options: {
    taskId?: string
    searchTerm?: string
    context: CommandContext
  }): Promise<CommandResponse | null> {
    const { taskId, searchTerm, context } = options

    let targetTask: any | null = null

    if (taskId) {
      targetTask = await this.container.taskUseCases.getTaskById(taskId)
    }

    if (!targetTask && searchTerm) {
      const tasks = await this.container.taskService.getAll()
      const searchLower = searchTerm.toLowerCase()
      targetTask = tasks.find(task => task.name.toLowerCase() === searchLower)
        || tasks.find(task => task.name.toLowerCase().includes(searchLower))
    }

    const taskName = targetTask?.name || searchTerm

    if (!taskName) {
      return CommandExecutor.createErrorResponse(
        'Task not found',
        'TASK_NOT_FOUND',
        'Try /tasks to see available tasks.'
      )
    }

    const detail = await this.container.taskUseCases.getTaskWithContent(taskName)
    const enrichedTasks = await this.enrichTasksForComponent([
      {
        ...(detail.task || targetTask || { name: taskName }),
        pageCount: detail.pages.length,
        noteCount: detail.notes.length
      }
    ])

    const componentTask = enrichedTasks[0]
    const pages = (detail.pages || []).map(page => ({
      id: page.id,
      title: page.title || page.url,
      url: page.url,
      savedAt: page.createdAt
    }))

    const notes = (detail.notes || []).map(note => ({
      id: note.id,
      content: note.content,
      comment: note.comment
    }))

    if (context.source === 'omnibox') {
      const message = `Task detail: ${componentTask.name}\nPages: ${pages.length}\nNotes: ${notes.length}`
      return CommandExecutor.createNavigationResponse('chat', message)
    }

    return {
      success: true,
      type: 'task-detail',
      content: `Task detail: ${componentTask.name}`,
      componentData: {
        task: componentTask,
        pages,
        notes,
        interactive: true
      },
      followUp: [`/settask ${componentTask.name}`, '/tasks']
    }
  }

  private createIntegratedDraftCommand(): CommandDefinition {
    return {
      name: 'draft',
      aliases: ['document', 'doc'],
      description: 'Open authoring workspace for current task or specific document',
      category: 'document',
      parameters: [
        {
          name: 'title',
          type: 'string',
          required: false,
          description: 'Document title for new drafts'
        },
        {
          name: 'task',
          type: 'string',
          required: false,
          description: 'Task to associate document with'
        },
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'Document ID to open existing document'
        }
      ],
      examples: [
        '/draft',
        '/draft "Project Report"',
        '/draft --task="research" "Meeting Notes"',
        '/draft --id="doc123"'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const documentId = params.id as string
          const title = params._positional[0] || params.title as string
          const taskParam = params.task as string

          // Get task - either from param, active task, or create default
          let taskId: string | undefined
          let taskName: string | undefined

          if (taskParam) {
            const task = await this.findTaskByName(taskParam)
            if (task) {
              taskId = task.id
              taskName = task.name
            } else {
              return CommandExecutor.createErrorResponse(
                `Task "${taskParam}" not found`,
                'TASK_NOT_FOUND',
                'Use /tasks to see available tasks or /newtask to create one'
              )
            }
          } else {
            const activeTask = await this.container.taskUseCases.getActiveTask()
            if (activeTask) {
              taskId = activeTask.id
              taskName = activeTask.name
            }
          }

          let document
          let isNew = false

          if (documentId) {
            // Open existing document
            const result = await this.container.documentsUseCases.getDocument(documentId)
            if (!result) {
              return CommandExecutor.createErrorResponse(
                `Document "${documentId}" not found`,
                'DOCUMENT_NOT_FOUND'
              )
            }
            document = result.document
          } else {
            // Create new document or find existing draft for task
            if (taskId) {
              const existingDocs = await this.container.documentsUseCases.listDocumentsByTask(taskId)
              const draftDoc = existingDocs.find(doc => doc.status === 'draft')

              if (draftDoc && !title) {
                // Use existing draft
                document = draftDoc
              }
            }

            if (!document) {
              // Create new document
              const documentTitle = title || `Draft - ${taskName || 'Untitled'}`
              const result = await this.container.documentsUseCases.createDocument({
                title: documentTitle,
                taskId,
                status: 'draft'
              })
              document = result.document
              isNew = true
            }
          }

          // Construct authoring workspace URL
          const workspaceUrl = chrome.runtime.getURL('/authoring/index.html') +
            `?documentId=${document.id}` +
            (taskId ? `&taskId=${taskId}` : '')

          // Open authoring workspace in new tab
          await chrome.tabs.create({ url: workspaceUrl })

          const message = isNew
            ? `✅ Created new draft: ${document.title}`
            : `✅ Opened draft: ${document.title}`

          const taskInfo = taskName ? ` [Task: ${taskName}]` : ''

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('home', `${message}${taskInfo}`)
          }

          return CommandExecutor.createSuccessResponse('text', `${message}${taskInfo}`, {
            followUp: ['/compose --task', '/notes --task']
          })

        } catch (error) {
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to open authoring workspace',
            'DRAFT_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedComposeCommand(): CommandDefinition {
    return {
      name: 'compose',
      aliases: ['write', 'author'],
      description: 'Create a new document and open authoring workspace',
      category: 'document',
      parameters: [
        {
          name: 'title',
          type: 'string',
          required: false,
          description: 'Document title'
        },
        {
          name: 'task',
          type: 'string',
          required: false,
          description: 'Task to associate document with'
        },
        {
          name: 'content',
          type: 'string',
          required: false,
          description: 'Initial content for the document'
        }
      ],
      examples: [
        '/compose "Research Report"',
        '/compose --task="project-alpha" "Meeting Minutes"',
        '/compose --title="Notes" --content="Initial thoughts..."'
      ],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          const title = params._positional[0] || params.title as string
          const taskParam = params.task as string
          const initialContent = params.content as string

          // Get task - either from param or active task
          let taskId: string | undefined
          let taskName: string | undefined

          if (taskParam) {
            const task = await this.findTaskByName(taskParam)
            if (task) {
              taskId = task.id
              taskName = task.name
            } else {
              return CommandExecutor.createErrorResponse(
                `Task "${taskParam}" not found`,
                'TASK_NOT_FOUND',
                'Use /tasks to see available tasks or /newtask to create one'
              )
            }
          } else {
            const activeTask = await this.container.taskUseCases.getActiveTask()
            if (activeTask) {
              taskId = activeTask.id
              taskName = activeTask.name
            }
          }

          // Create new document
          const documentTitle = title || `New Document - ${taskName || new Date().toLocaleDateString()}`
          const result = await this.container.documentsUseCases.createDocument({
            title: documentTitle,
            taskId,
            status: 'draft',
            initialContent
          })

          // Construct authoring workspace URL
          const workspaceUrl = chrome.runtime.getURL('/authoring/index.html') +
            `?documentId=${result.document.id}` +
            (taskId ? `&taskId=${taskId}` : '')

          // Open authoring workspace in new tab
          await chrome.tabs.create({ url: workspaceUrl })

          const message = `✅ Created document: ${result.document.title}`
          const taskInfo = taskName ? ` [Task: ${taskName}]` : ''

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('home', `${message}${taskInfo}`)
          }

          return CommandExecutor.createSuccessResponse('text', `${message}${taskInfo}`, {
            followUp: ['/draft --task', '/notes --task']
          })

        } catch (error) {
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to create document',
            'COMPOSE_ERROR'
          )
        }
      }
    }
  }

  private createIntegratedVersionCommand(): CommandDefinition {
    return {
      name: 'version',
      aliases: ['v'],
      description: 'Show extension version information',
      category: 'system',
      parameters: [],
      examples: ['/version'],

      execute: async (params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> => {
        try {
          // Get version from manifest if available
          const manifest = chrome.runtime.getManifest()
          const extensionVersion = manifest?.version || '1.0.0'

          const versionInfo = {
            extension: extensionVersion,
            commandSystem: '1.2.0',
            buildDate: new Date().toISOString().split('T')[0]
          }

          const versionText = `🔧 Superowser v${versionInfo.extension}\n📋 Command System v${versionInfo.commandSystem}\n📅 Build: ${versionInfo.buildDate}`

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('chat', versionText, true)
          } else {
            return CommandExecutor.createSuccessResponse('text', versionText)
          }
        } catch (error) {
          console.error('[Version Command] Error:', error)
          return CommandExecutor.createErrorResponse(
            error instanceof Error ? error.message : 'Failed to retrieve version information'
          )
        }
      }
    }
  }
}
