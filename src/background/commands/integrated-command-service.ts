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
    // Clear any existing task commands that were registered by the base class
    this.clearTaskCommands()
    this.registerIntegratedCommands()
  }

  private clearTaskCommands(): void {
    // Unregister existing task commands that were registered by the base class
    const registry = this.getRegistry()
    registry.unregister('settask')
    registry.unregister('tasks')
    registry.unregister('newtask')
  }

  private registerIntegratedCommands(): void {
    // Override task commands with integrated versions
    this.registerCommand(this.createIntegratedSetTaskCommand())
    this.registerCommand(this.createIntegratedTasksCommand())
    this.registerCommand(this.createIntegratedNewTaskCommand())

    // Register additional integrated commands
    this.registerCommand(this.createIntegratedSearchCommand())
  }

  private createIntegratedSearchCommand(): CommandDefinition {
    const searchEngines: Record<string, (query: string) => string> = {
      google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    }

    const defaultEngine = 'google'

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
          defaultValue: defaultEngine,
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

        const engineParam = (params.engine as string | undefined)?.toLowerCase() || defaultEngine
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
          description: 'Maximum number of tasks to show',
          defaultValue: 20
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
          const limit = params.limit || 20

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
              ? `No tasks found matching "${searchTerm}"`
              : 'No tasks found'

            return CommandExecutor.createSuccessResponse('text', message, {
              actions: [
                {
                  id: 'create-task',
                  label: 'Create First Task',
                  type: 'command',
                  action: '/settask --create',
                  style: 'primary'
                }
              ]
            })
          }

          // Format task list
          const taskList = tasks.map(task =>
            `• ${task.name}${task.description ? ` - ${task.description}` : ''}`
          ).join('\n')

          if (context.source === 'omnibox') {
            return CommandExecutor.createNavigationResponse('tasks', `Found ${tasks.length} task(s)`)
          } else {
            return CommandExecutor.createSuccessResponse('list', {
              title: `${tasks.length} task(s) found`,
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
}
