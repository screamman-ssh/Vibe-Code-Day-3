import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const targetId = event.context.params?.id
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user ID' })
  }

  if (targetId === auth.userId) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot follow yourself' })
  }

  const db = useDB(event)

  try {
    const target = await db.prepare(`SELECT id FROM users WHERE id = ?`).bind(targetId).first()
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User Not Found' })
    }

    await db.prepare(`
      INSERT OR IGNORE INTO user_follows (follower_id, following_id)
      VALUES (?, ?)
    `).bind(auth.userId, targetId).run()

    return { following: true, userId: targetId }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
