import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const replyId = event.context.params?.id
  if (!replyId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing reply ID' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const reply = await db.prepare(`SELECT id FROM social_replies WHERE id = ?`).bind(replyId).first()
    if (!reply) {
      throw createError({ statusCode: 404, statusMessage: 'Reply Not Found' })
    }

    const existing = await db.prepare(`
      SELECT 1 as v FROM reply_likes WHERE user_id = ? AND reply_id = ?
    `).bind(userId, replyId).first()

    if (existing) {
      await db.prepare(`DELETE FROM reply_likes WHERE user_id = ? AND reply_id = ?`).bind(userId, replyId).run()
    } else {
      await db.prepare(`INSERT INTO reply_likes (user_id, reply_id) VALUES (?, ?)`).bind(userId, replyId).run()
    }

    const countRow = await db.prepare(`
      SELECT COUNT(*) as c FROM reply_likes WHERE reply_id = ?
    `).bind(replyId).first()

    return {
      id: replyId,
      likeCount: countRow ? countRow.c : 0,
      isLiked: !existing
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
