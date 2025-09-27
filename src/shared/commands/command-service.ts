// Main command service that ties together parser, registry, and executor

import { CommandParser } from './parser'
import { CommandRegistry } from './registry'
import { CommandExecutor } from './executor'
import {
  CommandRequest,
  CommandResponse,
  CommandContext,
  CommandSuggestion,
  InterfaceCapabilities,
  UserContext,
  SessionContext
} from './types'

// Import command implementations
import { taskCommands } from './implementations/task-commands'

export class CommandService {
  private parser: CommandParser
  private registry: CommandRegistry
  private executor: CommandExecutor

  constructor() {
    this.parser = new CommandParser()
    this.registry = new CommandRegistry()
    this.executor = new CommandExecutor()

    this.initializeCommands()
  }

  /**
   * Process a command from either omnibox or chatbox
   */
  async processCommand(request: CommandRequest): Promise<CommandResponse> {
    try {
      // Parse the command input
      const parsed = this.parser.parse(request.input)

      if (!parsed.isValid) {
        return CommandExecutor.createErrorResponse(
          `Invalid command syntax: ${parsed.errors.map(e => e.message).join(', ')}`,
          'PARSE_ERROR',
          'Check command syntax and try again'
        )
      }

      // Resolve command and parameters
      const resolved = await this.registry.resolve(parsed, request.context)

      // Execute the command
      const response = await this.executor.execute(
        resolved.command,
        resolved.parameters,
        request.context
      )

      // Adapt response for the interface
      return this.adaptResponseForInterface(response, request.context)

    } catch (error) {
      console.error('[CommandService] Command processing failed:', error)

      return CommandExecutor.createErrorResponse(
        error instanceof Error ? error.message : 'Command processing failed',
        'PROCESSING_ERROR',
        'Try a different command or check syntax'
      )
    }
  }

  /**
   * Get command suggestions for autocomplete
   */
  async getSuggestions(
    input: string,
    context: CommandContext,
    cursorPosition?: number
  ): Promise<CommandSuggestion[]> {
    try {
      // Get autocomplete context if cursor position provided
      const autocompleteContext = cursorPosition !== undefined
        ? this.parser.getAutocompleteContext(input, cursorPosition)
        : undefined

      // Get suggestions from registry
      const suggestions = await this.registry.getSuggestions(input, context, autocompleteContext)

      // Filter and adapt suggestions for the interface
      return this.adaptSuggestionsForInterface(suggestions, context)

    } catch (error) {
      console.error('[CommandService] Suggestion generation failed:', error)
      return []
    }
  }

  /**
   * Check if input is a command
   */
  isCommand(input: string): boolean {
    return CommandParser.isCommand(input)
  }

  /**
   * Get command help
   */
  getHelp(commandName?: string): string {
    return this.registry.getHelp(commandName)
  }

  /**
   * Get command execution statistics
   */
  getExecutionStats() {
    return this.executor.getExecutionStats()
  }

  /**
   * Get recent command history
   */
  getRecentCommands(limit: number = 10) {
    return this.executor.getRecentExecutions(limit)
  }

  /**
   * Create command context from current application state
   */
  createContext(
    source: 'omnibox' | 'chatbox',
    userContext: Partial<UserContext> = {},
    sessionContext: Partial<SessionContext> = {}
  ): CommandContext {
    const capabilities: InterfaceCapabilities = source === 'omnibox'
      ? {
          canNavigate: true,
          canDisplayComplex: false,
          canInteract: false,
          maxOutputSize: 200,
          supportsOverlay: false
        }
      : {
          canNavigate: false,
          canDisplayComplex: true,
          canInteract: true,
          maxOutputSize: 10000,
          supportsOverlay: true
        }

    return {
      source,
      capabilities,
      user: {
        activeTask: undefined,
        currentUrl: undefined,
        recentTags: [],
        recentCommands: [],
        ...userContext
      },
      session: {
        sessionId: `session-${Date.now()}`,
        startTime: new Date(),
        currentView: 'home',
        ...sessionContext
      }
    }
  }

  // Protected methods for inheritance

  protected getRegistry() {
    return this.registry
  }

  // Private helper methods

  private initializeCommands(): void {
    try {
      // Register task commands
      taskCommands.forEach(command => {
        this.registry.register(command)
      })

      // Register system commands
      this.registerSystemCommands()

      console.log('[CommandService] Initialized with', this.registry.getAllCommandNames().length, 'commands')

    } catch (error) {
      console.error('[CommandService] Failed to initialize commands:', error)
    }
  }

  private registerSystemCommands(): void {
    // /help command
    this.registry.register({
      name: 'help',
      aliases: ['h', '?'],
      description: 'Show help information',
      category: 'system',
      parameters: [
        {
          name: 'command',
          type: 'string',
          required: false,
          description: 'Specific command to get help for'
        }
      ],
      examples: [
        '/help',
        '/help settask',
        '/? tasks'
      ],
      async execute(params, context) {
        const commandName = params._positional[0] || params.command
        const helpText = context.source === 'omnibox'
          ? 'Opening help in chat...'
          : this.getHelp(commandName)

        if (context.source === 'omnibox') {
          return CommandExecutor.createNavigationResponse('chat', helpText, true)
        } else {
          return CommandExecutor.createSuccessResponse('help', helpText)
        }
      }
    })

    // /version command
    this.registry.register({
      name: 'version',
      aliases: ['v'],
      description: 'Show extension version information',
      category: 'system',
      parameters: [],
      examples: ['/version'],
      async execute(params, context) {
        const versionInfo = {
          extension: '1.0.0',
          commandSystem: '1.0.0',
          buildDate: new Date().toISOString()
        }

        return CommandExecutor.createSuccessResponse('text',
          `Superowser v${versionInfo.extension}\nCommand System v${versionInfo.commandSystem}`
        )
      }
    })
  }

  private adaptResponseForInterface(
    response: CommandResponse,
    context: CommandContext
  ): CommandResponse {
    // Clone response to avoid mutation
    const adapted = { ...response }

    if (context.source === 'omnibox') {
      // Omnibox adaptations
      switch (response.type) {
        case 'list':
        case 'table':
        case 'form':
          // Complex data types should redirect to chat
          adapted.type = 'navigation'
          adapted.navigation = {
            target: 'chat',
            preserveCommand: true
          }
          adapted.content = 'Opening detailed results in chat...'
          break

        case 'text':
          // Truncate long text responses
          if (typeof response.content === 'string' && response.content.length > context.capabilities.maxOutputSize) {
            adapted.content = response.content.slice(0, context.capabilities.maxOutputSize - 3) + '...'
            adapted.navigation = {
              target: 'chat',
              preserveCommand: true
            }
          }
          break
      }

      // Remove interactive elements for omnibox
      if (!context.capabilities.canInteract) {
        delete adapted.actions
      }
    }

    return adapted
  }

  private adaptSuggestionsForInterface(
    suggestions: CommandSuggestion[],
    context: CommandContext
  ): CommandSuggestion[] {
    let adapted = [...suggestions]

    if (context.source === 'omnibox') {
      // Limit suggestions for omnibox
      adapted = adapted.slice(0, 6)

      // Simplify suggestion display for omnibox
      adapted = adapted.map(suggestion => ({
        ...suggestion,
        description: suggestion.description.length > 50
          ? suggestion.description.slice(0, 47) + '...'
          : suggestion.description
      }))
    }

    return adapted.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Register a new command (for extensibility)
   */
  registerCommand(command: any): void {
    this.registry.register(command)
  }

  /**
   * Get all available commands
   */
  getAllCommands(): string[] {
    return this.registry.getAllCommandNames()
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): any[] {
    return this.registry.getCommandsByCategory(category)
  }

  /**
   * Validate command syntax without executing
   */
  validateSyntax(input: string): any[] {
    return this.parser.validateSyntax(input)
  }

  /**
   * Get syntax highlighting tokens
   */
  getHighlightTokens(input: string): any[] {
    return CommandParser.getHighlightTokens(input)
  }
}