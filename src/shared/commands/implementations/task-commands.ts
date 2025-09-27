// Task management commands implementation

import {
  CommandDefinition,
  CommandContext,
  CommandResponse,
  ResolvedParameters,
  CommandSuggestion
} from '../types'
import { CommandExecutor } from '../executor'

/**
 * /settask command - Set or create active task
 *
 * Usage:
 *   /settask <task_name>
 *   /settask --name="Task Name" [--create] [--description="desc"]
 *   /task <task_name>  (alias)
 */
export const setTaskCommand: CommandDefinition = {
  name: 'settask',
  aliases: ['task', 'switchtask'],
  description: 'Set the active task (creates if it doesn\'t exist)',
  category: 'task',
  parameters: [
    {
      name: 'name',
      type: 'string',
      required: false, // Can be positional or named
      description: 'Task name to set as active',
      validation: {
        minLength: 1,
        maxLength: 100,
        pattern: /^[^/\\:*?"<>|]+$/ // No invalid filename characters
      },
      autocomplete: async (partial: string, context: CommandContext) => {
        // This would be implemented to fetch task suggestions
        // For now, return empty array
        return []
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
      description: 'Task description (for new tasks)',
      validation: {
        maxLength: 500
      }
    }
  ],
  examples: [
    '/settask "Project Alpha"',
    '/settask work-project',
    '/task --name="New Project" --create --description="Main project work"',
    '/switchtask research'
  ],
  minParameters: 0,
  maxParameters: 1,

  async execute(params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> {
    try {
      // Get task name from positional parameter or named parameter
      const taskName = params._positional[0] || params.name

      if (!taskName) {
        // No task name provided - show current task
        const currentTask = context.user.activeTask
        if (currentTask) {
          return CommandExecutor.createSuccessResponse('text',
            `Current active task: ${currentTask}`,
            {
              followUp: ['/tasks', '/settask <new_task>']
            }
          )
        } else {
          return CommandExecutor.createSuccessResponse('text',
            'No active task set',
            {
              followUp: ['/tasks', '/settask <task_name>']
            }
          )
        }
      }

      // Here we would integrate with the actual task service
      // For now, we'll simulate the behavior
      const forceCreate = params.create === true
      const description = params.description

      // Check if task exists (this would be a real service call)
      const taskExists = await checkTaskExists(taskName, context)

      if (!taskExists && !forceCreate) {
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
              },
              {
                id: 'show-similar',
                label: 'Show Similar Tasks',
                type: 'command',
                action: `/tasks --search="${taskName}"`,
                style: 'secondary'
              }
            ]
          }
        )
      }

      // Create or switch to task
      const result = await setActiveTask(taskName, {
        create: !taskExists || forceCreate,
        description,
        context
      })

      if (result.created) {
        // Task was created
        const response = context.source === 'omnibox'
          ? CommandExecutor.createNavigationResponse('home', `Created and switched to task: ${taskName}`)
          : CommandExecutor.createSuccessResponse('text',
              `✅ Created and switched to task: ${taskName}`,
              {
                actions: [
                  {
                    id: 'view-task',
                    label: 'View Task Details',
                    type: 'command',
                    action: '/tasks --details',
                    style: 'secondary'
                  }
                ],
                followUp: ['/newtask', '/save --task', '/note --task']
              }
            )

        return response
      } else {
        // Task was switched
        const response = context.source === 'omnibox'
          ? CommandExecutor.createNavigationResponse('home', `Switched to task: ${taskName}`)
          : CommandExecutor.createSuccessResponse('text',
              `✅ Switched to task: ${taskName}`,
              {
                followUp: ['/tasks', '/save --task', '/note --task']
              }
            )

        return response
      }

    } catch (error) {
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to set task',
        'TASK_ERROR',
        'Check task name and try again'
      )
    }
  },

  async suggest(partial: string, context: CommandContext): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = []

    // If no space in partial, suggest command completion
    if (!partial.includes(' ')) {
      if ('settask'.startsWith(partial.toLowerCase()) || partial === '/settask') {
        suggestions.push({
          type: 'command',
          text: '/settask ',
          display: '/settask <task_name>',
          description: 'Set active task',
          confidence: 0.9,
          category: 'task'
        })
      }
      return suggestions
    }

    // Extract task name being typed
    const parts = partial.split(' ')
    const taskNamePart = parts[parts.length - 1]

    // Get task suggestions (this would integrate with actual task service)
    const taskSuggestions = await getTaskSuggestions(taskNamePart, context)

    for (const task of taskSuggestions) {
      suggestions.push({
        type: 'value',
        text: task.name,
        display: task.name,
        description: task.description || 'Switch to this task',
        confidence: task.score,
        category: 'task'
      })
    }

    return suggestions
  }
}

/**
 * /tasks command - List and manage tasks
 */
export const tasksCommand: CommandDefinition = {
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
      name: 'status',
      type: 'string',
      required: false,
      description: 'Filter by task status',
      validation: {
        allowedValues: ['active', 'completed', 'archived', 'all']
      },
      defaultValue: 'active'
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Maximum number of tasks to show',
      defaultValue: 20,
      validation: {
        customValidator: async (value: number) => {
          if (value < 1 || value > 100) {
            return { isValid: false, error: 'Limit must be between 1 and 100' }
          }
          return { isValid: true }
        }
      }
    },
    {
      name: 'details',
      type: 'boolean',
      required: false,
      description: 'Show detailed task information',
      defaultValue: false
    }
  ],
  examples: [
    '/tasks',
    '/tasks --search="project"',
    '/tasks --status=completed',
    '/tasks --details --limit=10'
  ],

  async execute(params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> {
    try {
      const searchTerm = params.search
      const status = params.status || 'active'
      const limit = params.limit || 20
      const showDetails = params.details === true

      // Fetch tasks (this would integrate with actual task service)
      const tasks = await getTasks({ searchTerm, status, limit, context })

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

      // Format task list for display
      const response = context.source === 'chatbox' && showDetails
        ? formatDetailedTaskList(tasks, context)
        : formatSimpleTaskList(tasks, context)

      return response

    } catch (error) {
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch tasks',
        'TASK_FETCH_ERROR'
      )
    }
  }
}

/**
 * /newtask command - Create a new task
 */
export const newTaskCommand: CommandDefinition = {
  name: 'newtask',
  aliases: ['createtask', 'addtask'],
  description: 'Create a new task',
  category: 'task',
  parameters: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Task name',
      validation: {
        minLength: 1,
        maxLength: 100
      }
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
    '/newtask --name="Research" --description="Market research phase"',
    '/createtask "Documentation" --activate=false'
  ],

  async execute(params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> {
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

      // Create the task
      const task = await createTask({ name, description, context })

      let responseMessage = `✅ Created task: ${name}`

      if (activate) {
        await setActiveTask(name, { context })
        responseMessage += ` (now active)`
      }

      const response = context.source === 'omnibox' && activate
        ? CommandExecutor.createNavigationResponse('home', responseMessage)
        : CommandExecutor.createSuccessResponse('text', responseMessage, {
            actions: [
              {
                id: 'view-tasks',
                label: 'View All Tasks',
                type: 'command',
                action: '/tasks',
                style: 'secondary'
              }
            ],
            followUp: ['/save --task', '/note --task']
          })

      return response

    } catch (error) {
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create task',
        'TASK_CREATE_ERROR'
      )
    }
  }
}

// Helper functions that integrate with actual services
// Note: These functions need access to the DIContainer services
// They will be updated to receive service dependencies

async function checkTaskExists(taskName: string, context: CommandContext): Promise<boolean> {
  // For now, simulate some existing tasks until we get service dependency injection
  const existingTasks = ['work', 'personal', 'research', 'project-alpha']
  return existingTasks.includes(taskName.toLowerCase())
}

async function setActiveTask(
  taskName: string,
  options: { create?: boolean; description?: string; context: CommandContext }
): Promise<{ created: boolean; task: any }> {
  // This would integrate with the actual task service
  const created = options.create || false

  // Simulate task creation/switching
  const task = {
    id: `task-${Date.now()}`,
    name: taskName,
    description: options.description,
    createdAt: new Date(),
    isActive: true
  }

  // Update context (this would update the actual analytics service)
  options.context.user.activeTask = taskName

  return { created, task }
}

async function getTaskSuggestions(
  partial: string,
  context: CommandContext
): Promise<Array<{ name: string; description?: string; score: number }>> {
  // This would integrate with the fuzzy search service and task analytics
  const allTasks = [
    { name: 'work-project', description: 'Main work project', score: 0.9 },
    { name: 'personal-tasks', description: 'Personal task management', score: 0.8 },
    { name: 'research-phase', description: 'Research and analysis', score: 0.7 },
    { name: 'project-alpha', description: 'Alpha project development', score: 0.6 }
  ]

  if (!partial) return allTasks

  // Simple fuzzy matching (would use actual fuzzy search service)
  return allTasks
    .filter(task => task.name.toLowerCase().includes(partial.toLowerCase()))
    .sort((a, b) => b.score - a.score)
}

async function getTasks(options: {
  searchTerm?: string
  status: string
  limit: number
  context: CommandContext
}): Promise<any[]> {
  // This would integrate with the actual task service
  const mockTasks = [
    { id: '1', name: 'work-project', description: 'Main work project', status: 'active' },
    { id: '2', name: 'personal-tasks', description: 'Personal task management', status: 'active' },
    { id: '3', name: 'research-phase', description: 'Research and analysis', status: 'completed' }
  ]

  let filtered = mockTasks

  if (options.searchTerm) {
    filtered = filtered.filter(task =>
      task.name.toLowerCase().includes(options.searchTerm!.toLowerCase()) ||
      task.description.toLowerCase().includes(options.searchTerm!.toLowerCase())
    )
  }

  if (options.status !== 'all') {
    filtered = filtered.filter(task => task.status === options.status)
  }

  return filtered.slice(0, options.limit)
}

async function createTask(options: {
  name: string
  description?: string
  context: CommandContext
}): Promise<any> {
  // This would integrate with the actual task service
  return {
    id: `task-${Date.now()}`,
    name: options.name,
    description: options.description,
    status: 'active',
    createdAt: new Date()
  }
}

function formatSimpleTaskList(tasks: any[], context: CommandContext): CommandResponse {
  const taskList = tasks.map(task =>
    `• ${task.name}${task.description ? ` - ${task.description}` : ''}`
  ).join('\n')

  return CommandExecutor.createSuccessResponse('list', {
    title: `${tasks.length} task(s) found`,
    items: tasks,
    formatted: taskList
  }, {
    actions: [
      {
        id: 'create-task',
        label: 'Create New Task',
        type: 'command',
        action: '/newtask',
        style: 'primary'
      }
    ]
  })
}

function formatDetailedTaskList(tasks: any[], context: CommandContext): CommandResponse {
  return CommandExecutor.createSuccessResponse('table', {
    columns: ['Name', 'Description', 'Status', 'Created'],
    rows: tasks.map(task => [
      task.name,
      task.description || '-',
      task.status,
      task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '-'
    ])
  }, {
    actions: [
      {
        id: 'create-task',
        label: 'Create New Task',
        type: 'command',
        action: '/newtask',
        style: 'primary'
      }
    ]
  })
}

// Export all task commands
export const taskCommands = [
  setTaskCommand,
  tasksCommand,
  newTaskCommand
]