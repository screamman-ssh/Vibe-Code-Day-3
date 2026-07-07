export const MAX_STORED_CHAT_MESSAGES = 80

export interface ChatMessageRecord {
  role: 'user' | 'assistant'
  content: string
  toolTrace: Array<{ name: string; args?: Record<string, unknown>; summary?: string }>
}

export function normalizeChatMessages(input: unknown): ChatMessageRecord[] {
  if (!Array.isArray(input)) return []

  return input
    .filter((message: any) => {
      return (message?.role === 'user' || message?.role === 'assistant')
        && typeof message?.content === 'string'
        && message.content.trim()
    })
    .slice(-MAX_STORED_CHAT_MESSAGES)
    .map((message: any) => ({
      role: message.role,
      content: message.content.trim(),
      toolTrace: Array.isArray(message.toolTrace) ? message.toolTrace : []
    }))
}

export function parseStoredChatMessages(raw: unknown): ChatMessageRecord[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    return normalizeChatMessages(JSON.parse(raw))
  } catch {
    return []
  }
}
