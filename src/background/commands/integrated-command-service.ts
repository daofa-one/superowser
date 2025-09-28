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

        try {
          await chrome.tabs.create({ url })
        } catch (error) {
          return CommandExecutor.createErrorResponse(
            'Unable to open browser tab for search',
            'SEARCH_NAVIGATION_FAILED',
            'Check browser permissions and try again'
          )
        }

        const confirmation = `Opened ${engineKey} search for "${query}"`

        if (context.source === 'omnibox') {
          return CommandExecutor.createSuccessResponse('text', confirmation)
        }

        return CommandExecutor.createSuccessResponse('text', confirmation, {
          followUp: [`/search --engine=${engineKey} ${query} site:`, '/search <new query>']
        })
      }
    }
  }

  private createIntegratedAiCommand(): CommandDefinition {
    const providers: Record<string, { label: string; buildUrl: (query?: string) => string; supportsQuery?: boolean }> = {
      chatgpt: {
        label: 'ChatGPT',
        buildUrl: (query) => query && query.length > 0
          ? `https://chatgpt.com/?q=${encodeURIComponent(query)}`
          : 'https://chatgpt.com/',
        supportsQuery: true
      },
      claude: {
        label: 'Claude',
        buildUrl: () => 'https://claude.ai/new',
        supportsQuery: false
      },
      perplexity: {
        label: 'Perplexity',
        buildUrl: (query) => query && query.length > 0
          ? `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`
          : 'https://www.perplexity.ai/'
      },
      copilot: {
        label: 'Copilot',
        buildUrl: (query) => query && query.length > 0
          ? `https://copilot.microsoft.com/?q=${encodeURIComponent(query)}`
          : 'https://copilot.microsoft.com/'
      },
      gemini: {
        label: 'Gemini',
        buildUrl: (query) => query && query.length > 0
          ? `https://gemini.google.com/app?q=${encodeURIComponent(query)}`
          : 'https://gemini.google.com/app'
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

        const provider = providers[providerKey]
        const url = provider.buildUrl(query)

        try {
          await chrome.tabs.create({ url })
        } catch (error) {
          return CommandExecutor.createErrorResponse(
            'Unable to open assistant in a new tab',
            'AI_NAVIGATION_FAILED',
            'Check browser permissions and try again'
          )
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

          // Get tasks using real task service
          let tasks = await this.container.taskService.getAll()

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
          } else {
            return CommandExecutor.createSuccessResponse('list', {
              title: fullTitle,
              items: tasks,
              formatted: taskList
            })
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
            return CommandExecutor.createErrorResponse(
              'Task name is required',
              'MISSING_PARAMETER',
              'Provide a task name: /newtask "Task Name"'
            )
          }

          // Create the task using real task service
          const task = await this.container.taskUseCases.setActiveTask(name)

          let responseMessage = `✅ Created task: ${name}`

          if (activate) {
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
          if (description && task.id) {
            try {
              await this.container.taskService.update(task.id, { description })
            } catch (error) {
              console.warn('Failed to update task description:', error)
            }
          }

          if (context.source === 'omnibox' && activate) {
            return CommandExecutor.createNavigationResponse('home', responseMessage)
          } else {
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
