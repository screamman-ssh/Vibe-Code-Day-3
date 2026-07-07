import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { parseStoredChatMessages } from '../../../utils/chat'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const row = await db.prepare(`
      SELECT messages_json as messagesJson, updated_at as updatedAt
      FROM chat_sessions
      WHERE user_id = ?
    `).bind(userId).first<{ messagesJson: string; updatedAt: string }>()

    if (!row) {
      return { messages: [], updatedAt: null }
    }

    return {
      messages: parseStoredChatMessages(row.messagesJson),
      updatedAt: row.updatedAt
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
