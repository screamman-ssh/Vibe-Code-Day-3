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

  const db = useDB(event)

  try {
    await db.prepare(`
      DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).bind(auth.userId, targetId).run()

    return { following: false, userId: targetId }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
