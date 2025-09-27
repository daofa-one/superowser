// Command executor for running commands and handling responses

import {
  CommandDefinition,
  CommandRequest,
  CommandResponse,
  CommandContext,
  CommandExecutionResult,
  ResolvedParameters,
  CommandError,
  ResponseType
} from './types'

export class CommandExecutor {
  private executionHistory: CommandExecutionResult[] = []
  private readonly MAX_HISTORY = 100

  /**
   * Execute a resolved command with parameters
   */
  async execute(
    command: CommandDefinition,
    parameters: ResolvedParameters,
    context: CommandContext
  ): Promise<CommandResponse> {
    const startTime = performance.now()

    try {
      console.log(`[CommandExecutor] Executing /${command.name}`, { parameters, context })

      // Execute the command
      const response = await command.execute(parameters, context)

      const executionTime = performance.now() - startTime

      // Add execution metadata
      if (!response.metadata) {
        response.metadata = { executionTime }
      } else {
        response.metadata.executionTime = executionTime
      }

      // Log execution result
      const result: CommandExecutionResult = {
        command,
        parameters,
        response,
        context,
        executionTime
      }

      this.addToHistory(result)

      console.log(`[CommandExecutor] Command /${command.name} completed in ${executionTime.toFixed(2)}ms`)

      return response
    } catch (error) {
      const executionTime = performance.now() - startTime

      console.error(`[CommandExecutor] Command /${command.name} failed:`, error)

      // Create error response
      const errorResponse: CommandResponse = {
        success: false,
        type: 'error',
        content: error instanceof Error ? error.message : 'Command execution failed',
        metadata: { executionTime },
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }

      // Log failed execution
      const result: CommandExecutionResult = {
        command,
        parameters,
        response: errorResponse,
        context,
        executionTime
      }

      this.addToHistory(result)

      return errorResponse
    }
  }

  /**
   * Get execution history
   */
  getHistory(): CommandExecutionResult[] {
    return [...this.executionHistory]
  }

  /**
   * Get recent command executions
   */
  getRecentExecutions(limit: number = 10): CommandExecutionResult[] {
    return this.executionHistory.slice(-limit).reverse()
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    commandFrequency: Record<string, number>
    recentErrors: CommandError[]
  } {
    const total = this.executionHistory.length
    const successful = this.executionHistory.filter(r => r.response.success).length
    const failed = total - successful

    const avgTime = total > 0
      ? this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0) / total
      : 0

    const frequency: Record<string, number> = {}
    const recentErrors: CommandError[] = []

    for (const result of this.executionHistory) {
      const commandName = result.command.name
      frequency[commandName] = (frequency[commandName] || 0) + 1

      if (!result.response.success && result.response.error) {
        recentErrors.push(result.response.error)
      }
    }

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageExecutionTime: avgTime,
      commandFrequency: frequency,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    }
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = []
  }

  /**
   * Find similar past executions (for learning and optimization)
   */
  findSimilarExecutions(
    command: CommandDefinition,
    parameters: ResolvedParameters,
    context: CommandContext
  ): CommandExecutionResult[] {
    return this.executionHistory.filter(result => {
      // Same command
      if (result.command.name !== command.name) return false

      // Similar context (same source interface)
      if (result.context.source !== context.source) return false

      // Similar parameters (simplified comparison)
      const paramKeys1 = Object.keys(parameters).filter(k => !k.startsWith('_'))
      const paramKeys2 = Object.keys(result.parameters).filter(k => !k.startsWith('_'))

      if (paramKeys1.length !== paramKeys2.length) return false

      // Check if parameter values are similar
      for (const key of paramKeys1) {
        if (parameters[key] !== result.parameters[key]) return false
      }

      return true
    })
  }

  /**
   * Get command performance metrics
   */
  getCommandPerformance(commandName: string): {
    executionCount: number
    averageTime: number
    successRate: number
    lastExecution: Date | null
  } {
    const executions = this.executionHistory.filter(r => r.command.name === commandName)

    if (executions.length === 0) {
      return {
        executionCount: 0,
        averageTime: 0,
        successRate: 0,
        lastExecution: null
      }
    }

    const successful = executions.filter(r => r.response.success).length
    const avgTime = executions.reduce((sum, r) => sum + r.executionTime, 0) / executions.length
    const lastExecution = new Date(Math.max(...executions.map(r =>
      r.response.metadata?.executionTime ? Date.now() - r.response.metadata.executionTime : 0
    )))

    return {
      executionCount: executions.length,
      averageTime: avgTime,
      successRate: successful / executions.length,
      lastExecution
    }
  }

  /**
   * Create a standardized success response
   */
  static createSuccessResponse(
    type: ResponseType,
    content: any,
    options?: {
      actions?: any[]
      navigation?: any
      followUp?: string[]
      metadata?: any
    }
  ): CommandResponse {
    return {
      success: true,
      type,
      content,
      actions: options?.actions,
      navigation: options?.navigation,
      followUp: options?.followUp,
      metadata: options?.metadata
    }
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    message: string,
    code: string = 'GENERAL_ERROR',
    suggestion?: string
  ): CommandResponse {
    return {
      success: false,
      type: 'error',
      content: message,
      error: {
        code,
        message,
        suggestion
      }
    }
  }

  /**
   * Create a navigation response
   */
  static createNavigationResponse(
    target: 'home' | 'tasks' | 'notes' | 'chat',
    message?: string,
    preserveCommand?: boolean
  ): CommandResponse {
    return {
      success: true,
      type: 'navigation',
      content: message || `Navigating to ${target}`,
      navigation: {
        target,
        preserveCommand
      }
    }
  }

  /**
   * Create a notification response (for quick feedback)
   */
  static createNotificationResponse(
    message: string,
    actions?: any[]
  ): CommandResponse {
    return {
      success: true,
      type: 'notification',
      content: message,
      actions
    }
  }

  // Private helper methods

  private addToHistory(result: CommandExecutionResult): void {
    this.executionHistory.push(result)

    // Maintain history size limit
    if (this.executionHistory.length > this.MAX_HISTORY) {
      this.executionHistory = this.executionHistory.slice(-this.MAX_HISTORY)
    }
  }

  /**
   * Validate command response structure
   */
  static validateResponse(response: CommandResponse): boolean {
    try {
      // Basic validation
      if (typeof response.success !== 'boolean') return false
      if (!response.type) return false
      if (response.content === undefined) return false

      // Type-specific validation
      switch (response.type) {
        case 'navigation':
          return !!response.navigation?.target
        case 'error':
          return !!response.error?.message
        default:
          return true
      }
    } catch {
      return false
    }
  }

  /**
   * Sanitize response content for security
   */
  static sanitizeResponse(response: CommandResponse): CommandResponse {
    // Clone response to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(response))

    // Remove any potentially dangerous content
    if (typeof sanitized.content === 'string') {
      // Basic XSS prevention (could be enhanced)
      sanitized.content = sanitized.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
    }

    return sanitized
  }
}