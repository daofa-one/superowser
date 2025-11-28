// Core command system types and interfaces

export interface CommandContext {
  source: 'omnibox' | 'chatbox'
  user: UserContext
  session: SessionContext
  capabilities: InterfaceCapabilities
}

export interface UserContext {
  activeTask?: string
  currentUrl?: string
  recentTags: string[]
  recentCommands: string[]
}

export interface SessionContext {
  sessionId: string
  startTime: Date
  currentView: 'home' | 'tasks' | 'notes' | 'chat'
}

export interface InterfaceCapabilities {
  canNavigate: boolean        // Can change views/open pages
  canDisplayComplex: boolean  // Can show tables/forms
  canInteract: boolean        // Supports buttons/forms
  maxOutputSize: number       // Character/element limits
  supportsOverlay: boolean    // Can show modal overlays
}

export interface CommandRequest {
  input: string
  context: CommandContext
  timestamp: Date
}

export interface ParsedCommand {
  command: string
  parameters: ParsedParameter[]
  raw: string
  isValid: boolean
  errors: CommandError[]
}

export interface ParsedParameter {
  name?: string              // For named parameters --name=value
  value: string
  type: 'positional' | 'named' | 'flag'
  position: number
}

export interface CommandDefinition {
  name: string
  aliases: string[]
  description: string
  category: CommandCategory
  parameters: ParameterDefinition[]
  examples: string[]
  minParameters?: number
  maxParameters?: number
  execute: (params: ResolvedParameters, context: CommandContext) => Promise<CommandResponse>
  suggest?: (partial: string, context: CommandContext) => Promise<CommandSuggestion[]>
}

export interface ParameterDefinition {
  name: string
  type: ParameterType
  required: boolean
  description: string
  defaultValue?: any
  validation?: ParameterValidator
  autocomplete?: (partial: string, context: CommandContext) => Promise<string[]>
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'task' | 'tag' | 'page' | 'url' | 'date'

export type CommandCategory = 'task' | 'page' | 'note' | 'search' | 'system' | 'export' | 'navigation'

export interface ParameterValidator {
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  allowedValues?: string[]
  customValidator?: (value: any, context: CommandContext) => Promise<ValidationResult>
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  suggestion?: string
}

export interface ResolvedParameters {
  [key: string]: any
  _positional: any[]       // Array of positional parameters
  _flags: string[]         // Array of flags (boolean parameters)
}

export interface ComponentData {
  tasks?: any[]
  interactive?: boolean
  showCreateForm?: boolean
  showExisting?: boolean
  editTask?: any
  filters?: {
    search?: string
    status?: string
  }
  task?: any
  pages?: any[]
  notes?: any[]
  documents?: any[]
  refresh?: string
  // Future component data types can be added here
  [key: string]: any
}

export interface CommandResponse {
  success: boolean
  type: ResponseType
  content: any
  componentData?: ComponentData  // For component-based responses
  metadata?: ResponseMetadata
  actions?: CommandAction[]
  navigation?: NavigationAction
  followUp?: string[]        // Suggested next commands
  error?: CommandError
}

export type ResponseType =
  | 'text'           // Simple text response
  | 'list'           // Array of items
  | 'table'          // Tabular data
  | 'form'           // Interactive form
  | 'navigation'     // Navigate to different view
  | 'notification'   // Toast/status message
  | 'data'           // Complex structured data
  | 'error'          // Error response
  | 'help'           // Help/documentation
  | 'confirmation'   // Confirmation dialog needed
  | 'task-list'      // Interactive task list component
  | 'task-creator'   // Task creation form component
  | 'task-detail'    // Task detail component

export interface ResponseMetadata {
  executionTime: number
  itemCount?: number
  truncated?: boolean
  cacheHit?: boolean
}

export interface CommandAction {
  id: string
  label: string
  type: 'button' | 'link' | 'command' | 'download'
  action: string | CommandRequest
  style?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

export interface NavigationAction {
  target: 'home' | 'tasks' | 'notes' | 'chat'
  preserveCommand?: boolean  // Keep command in chat history
  params?: Record<string, any>
}

export interface CommandSuggestion {
  type: 'command' | 'parameter' | 'value' | 'example'
  text: string               // What to insert
  display: string            // What to show user
  description: string        // Help text
  confidence: number         // 0-1 relevance score
  category: string
  autocomplete?: string      // Full completion text
  icon?: string
}

export interface CommandError {
  code: string
  message: string
  suggestion?: string
  position?: number          // Character position in input
  parameter?: string         // Which parameter caused error
}

export interface CommandExecutionResult {
  command: CommandDefinition
  parameters: ResolvedParameters
  response: CommandResponse
  context: CommandContext
  executionTime: number
}

// Token types for command parsing
export interface Token {
  type: TokenType
  value: string
  position: number
  length: number
}

export type TokenType =
  | 'COMMAND'        // /command
  | 'PARAMETER'      // positional parameter
  | 'NAMED_PARAM'    // --name=value
  | 'FLAG'           // --flag
  | 'STRING'         // "quoted string"
  | 'IDENTIFIER'     // unquoted identifier
  | 'WHITESPACE'     // spaces/tabs
  | 'EOF'            // end of input
  | 'ERROR'          // parsing error

// Command registry events
export interface CommandRegistryEvent {
  type: 'command-registered' | 'command-executed' | 'command-failed'
  command: string
  timestamp: Date
  context?: CommandContext
  error?: CommandError
}

// Suggestion scoring factors
export interface SuggestionScoring {
  fuzzyMatch: number         // String similarity score
  frequency: number          // How often command is used
  recency: number           // How recently command was used
  context: number           // Context relevance
  priority: number          // Manual priority boost
}

// Command history entry
export interface CommandHistoryEntry {
  id: string
  command: string
  timestamp: Date
  success: boolean
  executionTime: number
  context: CommandContext
  response?: CommandResponse
}

// Auto-completion context
export interface AutocompleteContext {
  currentToken: Token
  previousTokens: Token[]
  commandSoFar: string
  cursorPosition: number
  availableCommands: string[]
  commandName: string
  isInParameterName: boolean
  isInParameterValue: boolean
  parameterName?: string
}
