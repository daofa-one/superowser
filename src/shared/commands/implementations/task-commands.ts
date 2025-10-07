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
      console.error('[SetTaskCommand] Unexpected error:', error)
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
    '/tasks --details --limit=10',
    '/tasks planning'
  ],

  async execute(params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> {
    try {
      const searchTerm = params.search
      const status = params.status || 'active'
      const limit = params.limit || 20
      const showDetails = params.details === true

      // Validate parameters
      if (limit < 1 || limit > 100) {
        return CommandExecutor.createErrorResponse(
          'Limit must be between 1 and 100',
          'INVALID_PARAMETER',
          'Use a limit between 1 and 100'
        )
      }

      if (searchTerm && typeof searchTerm !== 'string') {
        return CommandExecutor.createErrorResponse(
          'Search term must be text',
          'INVALID_PARAMETER',
          'Provide a valid search term'
        )
      }

      // If only search term provided and we're in chatbox, show search component
      if (searchTerm && !params.status && !params.details && context.source === 'chatbox') {
        try {
          const tasks = await getTasks({ searchTerm, status: 'all', limit, context })

          return {
            success: true,
            type: 'task-list',
            content: `Found ${tasks.length} task(s) matching "${searchTerm}"`,
            componentData: {
              tasks,
              interactive: true,
              filters: {
                search: searchTerm,
                status: 'all'
              }
            },
            actions: [
              {
                id: 'refine-search',
                label: 'Clear Search',
                type: 'command',
                action: '/tasks',
                style: 'secondary'
              },
              {
                id: 'create-task',
                label: 'Create New Task',
                type: 'command',
                action: '/newtask',
                style: 'primary'
              }
            ]
          }
        } catch (searchError) {
          console.error('[TasksCommand] Search error:', searchError)
          return CommandExecutor.createErrorResponse(
            'Search failed',
            'SEARCH_ERROR',
            'Try a different search term'
          )
        }
      }

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
      if (context.source === 'chatbox') {
        // Always return component-based response for chatbox
        return {
          success: true,
          type: 'task-list',
          content: searchTerm ? `Found ${tasks.length} task(s) matching "${searchTerm}"` : `${tasks.length} task(s)`,
          componentData: {
            tasks,
            interactive: true,
            showCreateForm: false,
            filters: {
              search: searchTerm,
              status: status
            }
          },
          actions: [
            {
              id: 'create-task',
              label: 'Create New Task',
              type: 'command',
              action: '/newtask',
              style: 'primary'
            },
            ...(status !== 'all' ? [{
              id: 'show-all',
              label: 'Show All',
              type: 'command',
              action: '/tasks --status=all',
              style: 'secondary'
            }] : []),
            ...(searchTerm ? [{
              id: 'clear-search',
              label: 'Clear Search',
              type: 'command',
              action: '/tasks',
              style: 'secondary'
            }] : [])
          ]
        }
      } else {
        // For omnibox, use text-based responses
        return showDetails
          ? formatDetailedTaskList(tasks, context)
          : formatSimpleTaskList(tasks, context)
      }

    } catch (error) {
      console.error('[TasksCommand] Error fetching tasks:', error)
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch tasks',
        'TASK_FETCH_ERROR',
        'Try refreshing or check your connection'
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

      // Validate task name if provided
      if (name && typeof name !== 'string') {
        return CommandExecutor.createErrorResponse(
          'Task name must be text',
          'INVALID_PARAMETER',
          'Provide a valid task name'
        )
      }

      if (name && name.length > 100) {
        return CommandExecutor.createErrorResponse(
          'Task name too long',
          'INVALID_PARAMETER',
          'Task name must be 100 characters or less'
        )
      }

      if (description && typeof description !== 'string') {
        return CommandExecutor.createErrorResponse(
          'Task description must be text',
          'INVALID_PARAMETER',
          'Provide a valid description'
        )
      }

      if (description && description.length > 500) {
        return CommandExecutor.createErrorResponse(
          'Task description too long',
          'INVALID_PARAMETER',
          'Description must be 500 characters or less'
        )
      }

      // If no name provided, show task creator form
      if (!name) {
        if (context.source === 'chatbox') {
          try {
            // Return component-based task creator for chat interface
            const existingTasks = await getTasks({ status: 'all', limit: 100, context })

            return {
              success: true,
              type: 'task-creator',
              content: 'Create a new task',
              componentData: {
                tasks: existingTasks,
                showExisting: true
              },
              actions: [
                {
                  id: 'cancel-create',
                  label: 'Cancel',
                  type: 'command',
                  action: '/tasks',
                  style: 'secondary'
                }
              ]
            }
          } catch (taskError) {
            console.error('[NewTaskCommand] Error fetching existing tasks:', taskError)
            return CommandExecutor.createErrorResponse(
              'Failed to load task creator',
              'COMPONENT_ERROR',
              'Try using: /newtask "Task Name"'
            )
          }
        } else {
          return CommandExecutor.createErrorResponse(
            'Task name is required',
            'MISSING_PARAMETER',
            'Provide a task name: /newtask "Task Name"'
          )
        }
      }

      // Create the task
      let task
      try {
        task = await createTask({ name, description, context })
      } catch (createError) {
        console.error('[NewTaskCommand] Error creating task:', createError)
        return CommandExecutor.createErrorResponse(
          'Failed to create task',
          'TASK_CREATE_ERROR',
          'Check task name and try again'
        )
      }

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
      console.error('[NewTaskCommand] Unexpected error:', error)
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create task',
        'TASK_CREATE_ERROR',
        'Check task name and try again'
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
    {
      id: '1',
      name: 'work-project',
      description: 'Main work project',
      status: 'active',
      isActive: true,
      pageCount: 12,
      noteCount: 8,
      createdAt: new Date('2024-01-15'),
      lastActivity: new Date('2024-01-20')
    },
    {
      id: '2',
      name: 'personal-tasks',
      description: 'Personal task management',
      status: 'active',
      isActive: false,
      pageCount: 7,
      noteCount: 3,
      createdAt: new Date('2024-01-10'),
      lastActivity: new Date('2024-01-18')
    },
    {
      id: '3',
      name: 'research-phase',
      description: 'Research and analysis',
      status: 'completed',
      isActive: false,
      pageCount: 25,
      noteCount: 15,
      createdAt: new Date('2023-12-01'),
      lastActivity: new Date('2024-01-05')
    },
    {
      id: '4',
      name: 'documentation',
      description: 'Project documentation and guides',
      status: 'active',
      isActive: false,
      pageCount: 18,
      noteCount: 22,
      createdAt: new Date('2024-01-12'),
      lastActivity: new Date('2024-01-19')
    },
    {
      id: '5',
      name: 'learning-ai',
      description: 'AI and machine learning resources',
      status: 'active',
      isActive: false,
      pageCount: 31,
      noteCount: 9,
      createdAt: new Date('2023-11-20'),
      lastActivity: new Date('2024-01-16')
    }
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

// This function is no longer needed as the logic is now inline in the tasks command



/**
 * /find command - Universal search across tasks, pages, notes, and documents
 *
 * Usage:
 *   /find <query>
 *   /find --query="search term" [--type=tasks|pages|notes|docs|all] [--limit=20]
 */
export const findCommand: CommandDefinition = {
  name: 'find',
  aliases: ['search', 'lookup'],
  description: 'Search across tasks, pages, notes, and documents',
  category: 'search',
  parameters: [
    {
      name: 'query',
      type: 'string',
      required: false, // Can be positional or named
      description: 'Search query',
      validation: {
        minLength: 1,
        maxLength: 200
      }
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'What to search: tasks, pages, notes, docs, or all',
      validation: {
        allowedValues: ['tasks', 'pages', 'notes', 'docs', 'documents', 'all']
      },
      defaultValue: 'all'
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Maximum number of results to show per type',
      defaultValue: 20,
      validation: {
        customValidator: async (value: number) => {
          if (value < 1 || value > 100) {
            return { isValid: false, error: 'Limit must be between 1 and 100' }
          }
          return { isValid: true }
        }
      }
    }
  ],
  examples: [
    '/find "project planning"',
    '/find --query="meeting" --type=tasks',
    '/find --type=docs --limit=10',
    '/search api documentation',
    '/lookup "user interface"'
  ],

  async execute(params: ResolvedParameters, context: CommandContext): Promise<CommandResponse> {
    try {
      const query = params._positional[0] || params.query
      const searchType = params.type || 'all'
      const limit = params.limit || 20

      // Validate search parameters
      if (query && typeof query !== 'string') {
        return CommandExecutor.createErrorResponse(
          'Search query must be text',
          'INVALID_PARAMETER',
          'Provide a valid search query'
        )
      }

      if (query && query.length > 200) {
        return CommandExecutor.createErrorResponse(
          'Search query too long',
          'INVALID_PARAMETER',
          'Query must be 200 characters or less'
        )
      }

      if (limit < 1 || limit > 100) {
        return CommandExecutor.createErrorResponse(
          'Limit must be between 1 and 100',
          'INVALID_PARAMETER',
          'Use a limit between 1 and 100'
        )
      }

      if (!query) {
        // No query provided - show search interface for chat
        if (context.source === 'chatbox') {
          return {
            success: true,
            type: 'search-interface',
            content: 'Find across tasks, pages, notes, and documents',
            componentData: {
              query: '',
              searchType: 'all',
              results: [],
              interactive: true
            },
            actions: [
              {
                id: 'search-tasks',
                label: 'Find Tasks',
                type: 'command',
                action: '/find --type=tasks',
                style: 'secondary'
              },
              {
                id: 'search-pages',
                label: 'Find Pages',
                type: 'command',
                action: '/find --type=pages',
                style: 'secondary'
              },
              {
                id: 'search-docs',
                label: 'Find Documents',
                type: 'command',
                action: '/find --type=docs',
                style: 'secondary'
              }
            ]
          }
        } else {
          return CommandExecutor.createErrorResponse(
            'Search query is required',
            'MISSING_PARAMETER',
            'Provide a search query: /find "query"'
          )
        }
      }

      // Perform the search
      let results
      try {
        results = await performUniversalSearch({ query, type: searchType, limit, context })
      } catch (searchError) {
        console.error('[FindCommand] Search error:', searchError)
        return CommandExecutor.createErrorResponse(
          'Search failed',
          'SEARCH_ERROR',
          'Try a different query or check your connection'
        )
      }

      const totalResults = results.tasks.length + results.pages.length + results.notes.length + results.documents.length

      if (totalResults === 0) {
        return CommandExecutor.createSuccessResponse('text',
          `No results found for "${query}"`,
          {
            followUp: ['/find --type=all', '/tasks', '/save'],
            actions: [
              {
                id: 'try-broader',
                label: 'Try Different Search',
                type: 'command',
                action: '/find ',
                style: 'secondary'
              }
            ]
          }
        )
      }

      // For chat interface with task results, return task component
      if (context.source === 'chatbox' && results.tasks.length > 0 && (searchType === 'tasks' || (searchType === 'all' && results.tasks.length >= results.pages.length))) {
        return {
          success: true,
          type: 'task-list',
          content: `Found ${results.tasks.length} task(s) matching "${query}"`,
          componentData: {
            tasks: results.tasks,
            interactive: true,
            filters: {
              search: query,
              status: 'all'
            }
          },
          actions: [
            {
              id: 'search-all',
              label: 'Search All Types',
              type: 'command',
              action: `/find "${query}" --type=all`,
              style: 'secondary'
            },
            {
              id: 'refine-search',
              label: 'New Search',
              type: 'command',
              action: '/find ',
              style: 'secondary'
            }
          ]
        }
      }

      // Generate comprehensive text response for all content types
      let responseText = `Found ${totalResults} result(s) for "${query}":\n\n`

      if (results.tasks.length > 0) {
        responseText += `**📋 Tasks (${results.tasks.length}):**\n`
        results.tasks.slice(0, 5).forEach(task => {
          responseText += `• ${task.name}${task.description ? ` - ${task.description}` : ''}\n`
        })
        if (results.tasks.length > 5) {
          responseText += `  ... and ${results.tasks.length - 5} more tasks\n`
        }
        responseText += '\n'
      }

      if (results.pages.length > 0) {
        responseText += `**🌐 Pages (${results.pages.length}):**\n`
        results.pages.slice(0, 5).forEach(page => {
          responseText += `• ${page.title || page.url}\n`
        })
        if (results.pages.length > 5) {
          responseText += `  ... and ${results.pages.length - 5} more pages\n`
        }
        responseText += '\n'
      }

      if (results.notes.length > 0) {
        responseText += `**📝 Notes (${results.notes.length}):**\n`
        results.notes.slice(0, 3).forEach(note => {
          const preview = note.content.slice(0, 50) + (note.content.length > 50 ? '...' : '')
          responseText += `• ${preview}\n`
        })
        if (results.notes.length > 3) {
          responseText += `  ... and ${results.notes.length - 3} more notes\n`
        }
        responseText += '\n'
      }

      if (results.documents.length > 0) {
        responseText += `**📄 Documents (${results.documents.length}):**\n`
        results.documents.slice(0, 3).forEach(doc => {
          responseText += `• ${doc.title || doc.filename}\n`
        })
        if (results.documents.length > 3) {
          responseText += `  ... and ${results.documents.length - 3} more documents\n`
        }
      }

      const actions = []
      if (results.tasks.length > 0) {
        actions.push({
          id: 'tasks-only',
          label: 'Tasks Only',
          type: 'command',
          action: `/find "${query}" --type=tasks`,
          style: 'secondary'
        })
      }
      if (results.pages.length > 0) {
        actions.push({
          id: 'pages-only',
          label: 'Pages Only',
          type: 'command',
          action: `/find "${query}" --type=pages`,
          style: 'secondary'
        })
      }

      return CommandExecutor.createSuccessResponse('text', responseText.trim(), {
        actions: actions.slice(0, 2) // Limit to 2 actions to avoid clutter
      })

    } catch (error) {
      console.error('[FindCommand] Unexpected error:', error)
      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Search failed',
        'SEARCH_ERROR',
        'Try refreshing or check your connection'
      )
    }
  }
}

// Universal search function that searches across all content types
async function performUniversalSearch(options: {
  query: string
  type: string
  limit: number
  context: CommandContext
}): Promise<{ tasks: any[], pages: any[], notes: any[], documents: any[] }> {
  const { query, type, limit } = options

  // Mock implementation - in real app, this would call the actual search service
  const mockTasks = [
    {
      id: '1',
      name: 'project planning',
      description: 'Plan the new project',
      status: 'active',
      isActive: false,
      pageCount: 8,
      noteCount: 5,
      createdAt: new Date('2024-01-10')
    },
    {
      id: '2',
      name: 'meeting notes',
      description: 'Weekly team meeting',
      status: 'active',
      isActive: true,
      pageCount: 15,
      noteCount: 12,
      createdAt: new Date('2024-01-05')
    },
    {
      id: '3',
      name: 'documentation review',
      description: 'Review project docs',
      status: 'completed',
      isActive: false,
      pageCount: 22,
      noteCount: 8,
      createdAt: new Date('2023-12-15')
    },
    {
      id: '4',
      name: 'api documentation',
      description: 'Document API endpoints',
      status: 'active',
      isActive: false,
      pageCount: 35,
      noteCount: 18,
      createdAt: new Date('2024-01-08')
    }
  ]

  const mockPages = [
    { id: '1', title: 'Project Planning Guide', url: 'https://example.com/planning' },
    { id: '2', title: 'Meeting Template', url: 'https://example.com/template' },
    { id: '3', title: 'API Documentation Portal', url: 'https://docs.example.com/api' },
    { id: '4', title: 'User Interface Guidelines', url: 'https://design.example.com/ui' }
  ]

  const mockNotes = [
    { id: '1', content: 'Important project planning considerations and next steps...' },
    { id: '2', content: 'Meeting action items and follow-up tasks for the team...' },
    { id: '3', content: 'User interface feedback and improvement suggestions...' }
  ]

  const mockDocuments = [
    { id: '1', title: 'Project Specification', filename: 'project-spec.pdf', type: 'pdf' },
    { id: '2', title: 'API Reference Guide', filename: 'api-guide.docx', type: 'docx' },
    { id: '3', title: 'User Interface Mockups', filename: 'ui-mockups.figma', type: 'figma' }
  ]

  const queryLower = query.toLowerCase()

  let tasks: any[] = []
  let pages: any[] = []
  let notes: any[] = []
  let documents: any[] = []

  if (type === 'tasks' || type === 'all') {
    tasks = mockTasks.filter(task =>
      task.name.toLowerCase().includes(queryLower) ||
      (task.description && task.description.toLowerCase().includes(queryLower))
    ).slice(0, limit)
  }

  if (type === 'pages' || type === 'all') {
    pages = mockPages.filter(page =>
      page.title.toLowerCase().includes(queryLower) ||
      page.url.toLowerCase().includes(queryLower)
    ).slice(0, limit)
  }

  if (type === 'notes' || type === 'all') {
    notes = mockNotes.filter(note =>
      note.content.toLowerCase().includes(queryLower)
    ).slice(0, limit)
  }

  if (type === 'docs' || type === 'documents' || type === 'all') {
    documents = mockDocuments.filter(doc =>
      doc.title.toLowerCase().includes(queryLower) ||
      doc.filename.toLowerCase().includes(queryLower)
    ).slice(0, limit)
  }

  return { tasks, pages, notes, documents }
}

// Export all task commands
export const taskCommands = [
  setTaskCommand,
  tasksCommand,
  newTaskCommand,
  findCommand
]