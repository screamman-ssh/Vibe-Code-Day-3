import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../utils/db'

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
    const reply = await db.prepare(`SELECT user_id as userId FROM social_replies WHERE id = ?`).bind(replyId).first()
    if (!reply) {
      throw createError({ statusCode: 404, statusMessage: 'Reply Not Found' })
    }
    if (reply.userId !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: Not your reply' })
    }

    await db.prepare(`DELETE FROM social_replies WHERE id = ?`).bind(replyId).run()

    return { id: replyId, deleted: true }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
