// Command parser implementing EBNF grammar for extensible command syntax

import {
  Token,
  TokenType,
  ParsedCommand,
  ParsedParameter,
  CommandError,
  AutocompleteContext
} from './types'

/**
 * EBNF Grammar for Command Syntax:
 *
 * command_input    ::= whitespace? "/" command_name (whitespace parameter_list)? whitespace?
 * command_name     ::= identifier
 * parameter_list   ::= parameter (whitespace parameter)*
 * parameter        ::= named_parameter | flag_parameter | positional_parameter
 * named_parameter  ::= "--" identifier ("=" parameter_value)?
 * flag_parameter   ::= "--" identifier
 * positional_parameter ::= parameter_value
 * parameter_value  ::= quoted_string | unquoted_value
 * quoted_string    ::= '"' ([^"] | '\"')* '"' | "'" ([^'] | "\'")* "'"
 * unquoted_value   ::= (letter | digit | "_" | "-" | "." | "/")+
 * identifier       ::= letter (letter | digit | "_" | "-")*
 * whitespace       ::= (" " | "\t")+
 */

export class CommandParser {
  private input: string = ''
  private position: number = 0
  private tokens: Token[] = []
  private currentToken: number = 0

  /**
   * Parse command input into structured command object
   */
  parse(input: string): ParsedCommand {
    this.input = input.trim()
    this.position = 0
    this.tokens = []
    this.currentToken = 0

    try {
      // Tokenize input
      this.tokenize()

      // Parse command structure
      const command = this.parseCommand()

      return {
        command: command.name,
        parameters: command.parameters,
        raw: input,
        isValid: true,
        errors: []
      }
    } catch (error) {
      return {
        command: '',
        parameters: [],
        raw: input,
        isValid: false,
        errors: [this.createError(error instanceof Error ? error.message : 'Parse error')]
      }
    }
  }

  /**
   * Tokenize input string into tokens
   */
  private tokenize(): void {
    this.position = 0

    while (this.position < this.input.length) {
      this.skipWhitespace()

      if (this.position >= this.input.length) break

      const char = this.input[this.position]

      if (char === '/' && this.tokens.length === 0) {
        // Command token
        this.position++ // Skip '/'
        const identifier = this.readIdentifier()
        this.addToken('COMMAND', identifier)
      } else if (char === '-' && this.peek() === '-') {
        // Named parameter or flag
        this.position += 2 // Skip '--'
        const name = this.readIdentifier()

        this.skipWhitespace()

        if (this.position < this.input.length && this.input[this.position] === '=') {
          // Named parameter with value
          this.position++ // Skip '='
          const value = this.readParameterValue()
          this.addToken('NAMED_PARAM', `${name}=${value}`)
        } else {
          // Flag parameter
          this.addToken('FLAG', name)
        }
      } else if (char === '"' || char === "'") {
        // Quoted string parameter
        const value = this.readQuotedString()
        this.addToken('PARAMETER', value)
      } else {
        // Unquoted parameter
        const value = this.readUnquotedValue()
        if (value) {
          this.addToken('PARAMETER', value)
        }
      }
    }

    this.addToken('EOF', '')
  }

  /**
   * Parse command structure from tokens
   */
  private parseCommand(): { name: string; parameters: ParsedParameter[] } {
    if (this.tokens.length === 0 || this.tokens[0].type !== 'COMMAND') {
      throw new Error('Input must start with a command (/)')
    }

    const commandName = this.tokens[0].value
    const parameters: ParsedParameter[] = []
    let position = 0

    // Parse parameters
    for (let i = 1; i < this.tokens.length; i++) {
      const token = this.tokens[i]

      if (token.type === 'EOF') break

      switch (token.type) {
        case 'NAMED_PARAM':
          const [name, value] = token.value.split('=', 2)
          parameters.push({
            name,
            value: value || 'true',
            type: 'named',
            position: position++
          })
          break

        case 'FLAG':
          parameters.push({
            name: token.value,
            value: 'true',
            type: 'flag',
            position: position++
          })
          break

        case 'PARAMETER':
          parameters.push({
            value: token.value,
            type: 'positional',
            position: position++
          })
          break

        default:
          throw new Error(`Unexpected token: ${token.type}`)
      }
    }

    return { name: commandName, parameters }
  }

  /**
   * Get autocomplete context for current cursor position
   */
  getAutocompleteContext(input: string, cursorPosition: number): AutocompleteContext {
    this.input = input
    this.position = 0
    this.tokens = []

    // Tokenize the entire input
    try {
      this.tokenize()
    } catch {
      // If tokenization fails, provide minimal context
      return {
        currentToken: { type: 'EOF', value: '', position: 0, length: 0 },
        previousTokens: [],
        commandSoFar: input.substring(0, cursorPosition),
        cursorPosition,
        availableCommands: [],
        commandName: '',
        isInParameterName: false,
        isInParameterValue: false
      }
    }

    // Find the token containing the cursor or the last token before cursor
    let currentTokenIndex = -1
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i]
      const tokenEnd = token.position + token.length

      if (cursorPosition >= token.position && cursorPosition <= tokenEnd) {
        currentTokenIndex = i
        break
      } else if (cursorPosition < token.position) {
        // Cursor is before this token, use previous token
        currentTokenIndex = Math.max(0, i - 1)
        break
      }
    }

    // If cursor is after all tokens, use EOF token if it exists
    if (currentTokenIndex === -1) {
      const eofIndex = this.tokens.findIndex(t => t.type === 'EOF')
      if (eofIndex >= 0) {
        currentTokenIndex = eofIndex
      } else {
        currentTokenIndex = this.tokens.length - 1
      }
    }

    const currentToken = this.tokens[currentTokenIndex] || { type: 'EOF', value: '', position: 0, length: 0 }
    const previousTokens = this.tokens.slice(0, currentTokenIndex)

    // Extract command name
    const commandToken = this.tokens.find(t => t.type === 'COMMAND')
    const commandName = commandToken?.value || ''

    // Determine if we're in parameter name or value
    let isInParameterName = false
    let isInParameterValue = false
    let parameterName: string | undefined

    // Check if cursor is right after "--" (typing parameter name)
    const textBeforeCursor = input.substring(0, cursorPosition)
    const endsWithDashDash = textBeforeCursor.trimEnd().endsWith('--')

    if (currentToken.type === 'NAMED_PARAM') {
      // Check if the token has "=" to determine if it's a parameter with value
      if (currentToken.value.includes('=')) {
        const [name, value] = currentToken.value.split('=', 2)
        const equalsPos = input.indexOf('=', currentToken.position)

        if (cursorPosition <= equalsPos) {
          // Cursor is before or at "=", so in parameter name
          isInParameterName = true
          parameterName = name
        } else {
          // Cursor is after "=", so in parameter value
          isInParameterValue = true
          parameterName = name
        }
      } else {
        // No "=" yet, we're typing the parameter name
        isInParameterName = true
        parameterName = currentToken.value
      }
    } else if (currentToken.type === 'FLAG') {
      isInParameterName = true
      parameterName = currentToken.value
    } else if (endsWithDashDash || (currentToken.type === 'EOF' && textBeforeCursor.trimEnd().endsWith('--'))) {
      // Just typed "--", ready to suggest parameter names
      isInParameterName = true
    } else if (currentToken.type === 'PARAMETER') {
      // Check if previous token is NAMED_PARAM with "="
      const prevToken = previousTokens[previousTokens.length - 1]
      if (prevToken?.type === 'NAMED_PARAM' && prevToken.value.includes('=')) {
        const [name] = prevToken.value.split('=', 2)
        isInParameterValue = true
        parameterName = name
      }
    }

    // Check if we're right after a space following the command (ready for parameters)
    const afterCommand = commandToken && cursorPosition > (commandToken.position + commandToken.length) &&
                        /\s/.test(input[commandToken.position + commandToken.length] || '')
    if (afterCommand && !isInParameterName && !isInParameterValue && currentToken.type === 'EOF') {
      // We're in the position to start typing a parameter
      isInParameterName = true
    }

    return {
      currentToken,
      previousTokens,
      commandSoFar: input.substring(0, cursorPosition),
      cursorPosition,
      availableCommands: [],
      commandName,
      isInParameterName,
      isInParameterValue,
      parameterName
    }
  }

  /**
   * Validate command syntax without full parsing
   */
  validateSyntax(input: string): CommandError[] {
    try {
      const parsed = this.parse(input)
      return parsed.errors
    } catch (error) {
      return [this.createError(error instanceof Error ? error.message : 'Syntax error')]
    }
  }

  // Private helper methods

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++
    }
  }

  private peek(offset: number = 1): string {
    const pos = this.position + offset
    return pos < this.input.length ? this.input[pos] : ''
  }

  private readIdentifier(): string {
    const start = this.position

    if (!this.isLetter(this.input[this.position])) {
      throw new Error('Identifier must start with a letter')
    }

    while (this.position < this.input.length) {
      const char = this.input[this.position]
      if (this.isLetter(char) || this.isDigit(char) || char === '_' || char === '-') {
        this.position++
      } else {
        break
      }
    }

    return this.input.substring(start, this.position)
  }

  private readQuotedString(): string {
    const quote = this.input[this.position]
    this.position++ // Skip opening quote

    const start = this.position
    let escaped = false

    while (this.position < this.input.length) {
      const char = this.input[this.position]

      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        const value = this.input.substring(start, this.position)
        this.position++ // Skip closing quote
        return value
      }

      this.position++
    }

    throw new Error(`Unterminated quoted string starting with ${quote}`)
  }

  private readUnquotedValue(): string {
    const start = this.position

    while (this.position < this.input.length) {
      const char = this.input[this.position]

      if (/\s/.test(char) || char === '-' && this.peek() === '-') {
        break
      }

      this.position++
    }

    return this.input.substring(start, this.position)
  }

  private readParameterValue(): string {
    this.skipWhitespace()

    if (this.position >= this.input.length) {
      return ''
    }

    const char = this.input[this.position]

    if (char === '"' || char === "'") {
      return this.readQuotedString()
    } else {
      return this.readUnquotedValue()
    }
  }

  private isLetter(char: string): boolean {
    return /[a-zA-Z]/.test(char)
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char)
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      position: this.position - value.length,
      length: value.length
    })
  }

  private createError(message: string, position?: number): CommandError {
    return {
      code: 'PARSE_ERROR',
      message,
      position: position ?? this.position
    }
  }

  /**
   * Static method for quick command detection
   */
  static isCommand(input: string): boolean {
    return input.trim().startsWith('/')
  }

  /**
   * Static method to extract command name from input
   */
  static extractCommandName(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed.startsWith('/')) return null

    const match = trimmed.match(/^\/([a-zA-Z][a-zA-Z0-9_-]*)/)
    return match ? match[1] : null
  }

  /**
   * Static method for syntax highlighting tokens
   */
  static getHighlightTokens(input: string): Array<{ type: string; start: number; end: number; text: string }> {
    const parser = new CommandParser()

    try {
      parser.input = input
      parser.position = 0
      parser.tokens = []
      parser.tokenize()

      return parser.tokens.map(token => ({
        type: token.type.toLowerCase(),
        start: token.position,
        end: token.position + token.length,
        text: token.value
      }))
    } catch {
      return [{
        type: 'error',
        start: 0,
        end: input.length,
        text: input
      }]
    }
  }
}