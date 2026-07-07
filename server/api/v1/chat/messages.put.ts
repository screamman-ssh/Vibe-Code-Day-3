import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { normalizeChatMessages } from '../../../utils/chat'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const messages = normalizeChatMessages(body?.messages)

  const db = useDB(event)
  const userId = auth.userId

  try {
    if (!messages.length) {
      await db.prepare(`DELETE FROM chat_sessions WHERE user_id = ?`).bind(userId).run()
      return { messages: [], updatedAt: null }
    }

    await db.prepare(`
      INSERT INTO chat_sessions (user_id, messages_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        messages_json = excluded.messages_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, JSON.stringify(messages)).run()

    const row = await db.prepare(`
      SELECT updated_at as updatedAt
      FROM chat_sessions
      WHERE user_id = ?
    `).bind(userId).first<{ updatedAt: string }>()

    return {
      messages,
      updatedAt: row?.updatedAt || null
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
