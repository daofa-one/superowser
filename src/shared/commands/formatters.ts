import type { CommandResponse } from './types'

const BULLET = '•'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function formatListContent(content: unknown): string {
  if (!isObject(content)) {
    return typeof content === 'string' ? content : JSON.stringify(content)
  }

  const title = typeof content.title === 'string' ? content.title : 'Results'
  if (typeof content.formatted === 'string') {
    return `${title}:

${content.formatted}`
  }

  const items = Array.isArray(content.items) ? content.items : []
  if (items.length === 0) {
    return `${title}:

No items`
  }

  const formattedItems = items.map((item: any) => {
    const name = typeof item?.name === 'string' ? item.name : JSON.stringify(item)
    const description = typeof item?.description === 'string' ? item.description : ''
    return description ? `${BULLET} ${name} - ${description}` : `${BULLET} ${name}`
  }).join('\n')

  return `${title}:

${formattedItems}`
}

function formatTableContent(content: unknown): string {
  if (!isObject(content)) {
    return typeof content === 'string' ? content : JSON.stringify(content)
  }

  if (typeof content.formatted === 'string') {
    return content.formatted
  }

  const title = typeof content.title === 'string' ? content.title : 'Table'
  return `${title}

Table data available`
}

function formatGenericContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (content == null) {
    return 'No content'
  }
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

function formatFollowUp(followUp?: string[]): string {
  if (!Array.isArray(followUp) || followUp.length === 0) {
    return ''
  }

  const lines = followUp.map(item => `${BULLET} ${item}`)
  return `\n\nFollow up:\n${lines.join('\n')}`
}

export function formatCommandResponseForChat(commandInput: string, response: CommandResponse): string {
  const header = `> ${commandInput}`

  if (!response.success) {
    const errorMessage = response.error?.message || 'Unknown error'
    return `${header}\n\n❌ Error: ${errorMessage}`
  }

  let body: string

  switch (response.type) {
    case 'list':
      body = formatListContent(response.content)
      break
    case 'table':
      body = formatTableContent(response.content)
      break
    case 'help':
    case 'notification':
    case 'navigation':
    case 'text':
    case 'data':
    case 'form':
    case 'confirmation':
      body = formatGenericContent(response.content)
      break
    default:
      body = formatGenericContent(response.content)
      break
  }

  const followUp = formatFollowUp(response.followUp)

  return `${header}\n\n${body}${followUp}`
}
