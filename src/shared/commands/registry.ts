// Command registry for managing available commands and their definitions

import {
  CommandDefinition,
  CommandSuggestion,
  CommandContext,
  ParsedCommand,
  ResolvedParameters,
  ParameterDefinition,
  ValidationResult,
  CommandError,
  AutocompleteContext,
  SuggestionScoring
} from './types'

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map()
  private aliases: Map<string, string> = new Map()
  private categories: Map<string, CommandDefinition[]> = new Map()
  private usageStats: Map<string, { count: number; lastUsed: Date }> = new Map()

  /**
   * Register a new command
   */
  register(command: CommandDefinition): void {
    // Validate command definition
    this.validateCommandDefinition(command)

    // Register main command
    this.commands.set(command.name, command)

    // Register aliases
    command.aliases.forEach(alias => {
      if (this.aliases.has(alias) || this.commands.has(alias)) {
        throw new Error(`Command alias '${alias}' is already registered`)
      }
      this.aliases.set(alias, command.name)
    })

    // Update category index
    if (!this.categories.has(command.category)) {
      this.categories.set(command.category, [])
    }
    this.categories.get(command.category)!.push(command)

    console.log(`[CommandRegistry] Registered command: /${command.name}`)
  }

  /**
   * Unregister a command and its aliases
   */
  unregister(name: string): boolean {
    const command = this.getCommand(name)
    if (!command) {
      return false
    }

    // Remove main command
    this.commands.delete(command.name)

    // Remove aliases
    command.aliases.forEach(alias => {
      this.aliases.delete(alias)
    })

    // Remove from category index
    const categoryCommands = this.categories.get(command.category)
    if (categoryCommands) {
      const index = categoryCommands.findIndex(cmd => cmd.name === command.name)
      if (index !== -1) {
        categoryCommands.splice(index, 1)
      }
    }

    // Remove usage stats
    this.usageStats.delete(command.name)

    console.log(`[CommandRegistry] Unregistered command: /${command.name}`)
    return true
  }

  /**
   * Get command definition by name or alias
   */
  getCommand(name: string): CommandDefinition | null {
    // Try direct lookup
    if (this.commands.has(name)) {
      return this.commands.get(name)!
    }

    // Try alias lookup
    const aliasTarget = this.aliases.get(name)
    if (aliasTarget) {
      return this.commands.get(aliasTarget) || null
    }

    return null
  }

  /**
   * Resolve parsed command to executable command with validated parameters
   */
  async resolve(parsed: ParsedCommand, context: CommandContext): Promise<{
    command: CommandDefinition
    parameters: ResolvedParameters
  }> {
    if (!parsed.isValid) {
      throw new Error(`Invalid command syntax: ${parsed.errors.map(e => e.message).join(', ')}`)
    }

    const command = this.getCommand(parsed.command)
    if (!command) {
      throw new Error(`Unknown command: /${parsed.command}`)
    }

    // Validate and resolve parameters
    const resolvedParams = await this.resolveParameters(command, parsed.parameters, context)

    // Update usage statistics
    this.updateUsageStats(command.name)

    return { command, parameters: resolvedParams }
  }

  /**
   * Get command suggestions based on partial input
   */
  async getSuggestions(
    input: string,
    context: CommandContext,
    autocompleteContext?: AutocompleteContext
  ): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = []

    // If input is just "/" or "/partial", suggest commands
    if (!input || input === '/' || !input.includes(' ')) {
      const commandName = input.startsWith('/') ? input.slice(1) : input
      const commandSuggestions = await this.getCommandNameSuggestions(commandName, context)
      suggestions.push(...commandSuggestions)
    } else {
      // Suggest parameters for specific command
      const parameterSuggestions = await this.getParameterSuggestions(input, context, autocompleteContext)
      suggestions.push(...parameterSuggestions)
    }

    // Sort by relevance score
    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Get all commands in a category
   */
  getCommandsByCategory(category: string): CommandDefinition[] {
    return this.categories.get(category) || []
  }

  /**
   * Get all available command names
   */
  getAllCommandNames(): string[] {
    return Array.from(this.commands.keys())
  }

  /**
   * Get command usage statistics
   */
  getUsageStats(): Array<{ command: string; count: number; lastUsed: Date }> {
    return Array.from(this.usageStats.entries()).map(([command, stats]) => ({
      command,
      count: stats.count,
      lastUsed: stats.lastUsed
    }))
  }

  /**
   * Get help information for a command
   */
  getHelp(commandName?: string): string {
    if (!commandName) {
      // Return general help
      return this.generateGeneralHelp()
    }

    const command = this.getCommand(commandName)
    if (!command) {
      return `Unknown command: /${commandName}`
    }

    return this.generateCommandHelp(command)
  }

  // Private helper methods

  private validateCommandDefinition(command: CommandDefinition): void {
    if (!command.name || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(command.name)) {
      throw new Error('Command name must be a valid identifier')
    }

    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`)
    }

    // Validate parameter definitions
    const paramNames = new Set<string>()
    let hasOptional = false

    for (const param of command.parameters) {
      if (paramNames.has(param.name)) {
        throw new Error(`Duplicate parameter name: ${param.name}`)
      }
      paramNames.add(param.name)

      if (!param.required && !hasOptional) {
        hasOptional = true
      } else if (param.required && hasOptional) {
        throw new Error('Required parameters cannot come after optional parameters')
      }
    }
  }

  private async resolveParameters(
    command: CommandDefinition,
    parsedParams: any[],
    context: CommandContext
  ): Promise<ResolvedParameters> {
    const resolved: ResolvedParameters = {
      _positional: [],
      _flags: []
    }

    const namedParams = new Map<string, any>()
    const positionalParams: any[] = []
    const flags: string[] = []

    // Separate parameter types
    for (const param of parsedParams) {
      if (param.type === 'named') {
        namedParams.set(param.name, param.value)
      } else if (param.type === 'flag') {
        flags.push(param.name)
        namedParams.set(param.name, true)
      } else {
        positionalParams.push(param.value)
      }
    }

    // Validate and resolve named parameters
    for (const paramDef of command.parameters) {
      let value = namedParams.get(paramDef.name)

      if (value === undefined) {
        if (paramDef.required) {
          throw new Error(`Required parameter missing: ${paramDef.name}`)
        }
        value = paramDef.defaultValue
      }

      // Type conversion and validation
      if (value !== undefined) {
        const converted = await this.convertParameterValue(value, paramDef, context)
        const validation = await this.validateParameterValue(converted, paramDef, context)

        if (!validation.isValid) {
          throw new Error(`Invalid parameter '${paramDef.name}': ${validation.error}`)
        }

        resolved[paramDef.name] = converted
      }
    }

    // Add positional parameters and flags
    resolved._positional = positionalParams
    resolved._flags = flags

    // Validate parameter count
    if (command.minParameters && positionalParams.length < command.minParameters) {
      throw new Error(`Too few parameters (minimum: ${command.minParameters})`)
    }

    if (command.maxParameters && positionalParams.length > command.maxParameters) {
      throw new Error(`Too many parameters (maximum: ${command.maxParameters})`)
    }

    return resolved
  }

  private async convertParameterValue(
    value: any,
    paramDef: ParameterDefinition,
    context: CommandContext
  ): Promise<any> {
    switch (paramDef.type) {
      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          throw new Error(`Expected number, got: ${value}`)
        }
        return num

      case 'boolean':
        if (typeof value === 'boolean') return value
        const str = String(value).toLowerCase()
        return str === 'true' || str === '1' || str === 'yes' || str === 'on'

      case 'date':
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${value}`)
        }
        return date

      case 'string':
      case 'task':
      case 'tag':
      case 'page':
      case 'url':
      default:
        return String(value)
    }
  }

  private async validateParameterValue(
    value: any,
    paramDef: ParameterDefinition,
    context: CommandContext
  ): Promise<ValidationResult> {
    if (!paramDef.validation) {
      return { isValid: true }
    }

    const validation = paramDef.validation

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      if (!validation.pattern.test(value)) {
        return {
          isValid: false,
          error: `Value does not match expected pattern`
        }
      }
    }

    // Length validation
    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return {
          isValid: false,
          error: `Value too short (minimum: ${validation.minLength} characters)`
        }
      }

      if (validation.maxLength && value.length > validation.maxLength) {
        return {
          isValid: false,
          error: `Value too long (maximum: ${validation.maxLength} characters)`
        }
      }
    }

    // Allowed values validation
    if (validation.allowedValues && !validation.allowedValues.includes(value)) {
      return {
        isValid: false,
        error: `Invalid value. Allowed: ${validation.allowedValues.join(', ')}`
      }
    }

    // Custom validation
    if (validation.customValidator) {
      return await validation.customValidator(value, context)
    }

    return { isValid: true }
  }

  private async getCommandNameSuggestions(
    partial: string,
    context: CommandContext
  ): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = []

    for (const [name, command] of this.commands) {
      const score = this.calculateCommandRelevance(name, partial, context)

      if (score > 0) {
        suggestions.push({
          type: 'command',
          text: `/${name}`,
          display: `/${name}`,
          description: command.description,
          confidence: score,
          category: command.category,
          icon: this.getCommandIcon(command.category)
        })
      }
    }

    return suggestions
  }

  private async getParameterSuggestions(
    input: string,
    context: CommandContext,
    autocompleteContext?: AutocompleteContext
  ): Promise<CommandSuggestion[]> {
    // This is a simplified implementation
    // Full implementation would parse current command and suggest appropriate parameters
    return []
  }

  private calculateCommandRelevance(
    commandName: string,
    partial: string,
    context: CommandContext
  ): number {
    let score = 0

    if (!partial) {
      score = 0.5 // Base score for all commands
    } else {
      // Fuzzy string matching
      if (commandName.toLowerCase().startsWith(partial.toLowerCase())) {
        score += 0.8
      } else if (commandName.toLowerCase().includes(partial.toLowerCase())) {
        score += 0.4
      } else {
        // More sophisticated fuzzy matching could be implemented
        return 0
      }
    }

    // Boost based on usage frequency
    const usage = this.usageStats.get(commandName)
    if (usage) {
      score += Math.min(0.3, usage.count / 100)

      // Boost recent usage
      const daysSinceUsed = (Date.now() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUsed < 1) score += 0.2
      else if (daysSinceUsed < 7) score += 0.1
    }

    // Context-based boosting could be added here
    // e.g., boost task commands when active task is set

    return Math.min(1, score)
  }

  private updateUsageStats(commandName: string): void {
    const current = this.usageStats.get(commandName) || { count: 0, lastUsed: new Date(0) }
    this.usageStats.set(commandName, {
      count: current.count + 1,
      lastUsed: new Date()
    })
  }

  private getCommandIcon(category: string): string {
    const icons = {
      task: '📋',
      page: '📄',
      note: '📝',
      search: '🔍',
      system: '⚙️',
      export: '📤',
      navigation: '🧭'
    }
    return icons[category as keyof typeof icons] || '⚡'
  }

  private generateGeneralHelp(): string {
    const categories = Array.from(this.categories.keys())
    let help = 'Available commands:\n\n'

    for (const category of categories) {
      const commands = this.categories.get(category)!
      help += `${category.toUpperCase()}:\n`

      for (const command of commands) {
        help += `  /${command.name} - ${command.description}\n`
      }
      help += '\n'
    }

    help += 'Use /help <command> for detailed information about a specific command.'
    return help
  }

  private generateCommandHelp(command: CommandDefinition): string {
    let help = `/${command.name}\n`
    help += `${command.description}\n\n`

    if (command.aliases.length > 0) {
      help += `Aliases: ${command.aliases.map(a => `/${a}`).join(', ')}\n\n`
    }

    if (command.parameters.length > 0) {
      help += 'Parameters:\n'
      for (const param of command.parameters) {
        const required = param.required ? 'required' : 'optional'
        help += `  --${param.name} (${param.type}, ${required}) - ${param.description}\n`
      }
      help += '\n'
    }

    if (command.examples.length > 0) {
      help += 'Examples:\n'
      for (const example of command.examples) {
        help += `  ${example}\n`
      }
    }

    return help
  }
}