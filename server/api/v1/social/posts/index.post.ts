import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../../utils/db'
import { fetchSocialPostById } from '../../../../utils/social'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const content = body?.content?.trim()
  if (!content || content.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Content required (max 500 chars)' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const postId = `post_${crypto.randomUUID().replace(/-/g, '')}`

  try {
    await db.prepare(`
      INSERT INTO social_posts (id, user_id, post_type, content, payload)
      VALUES (?, ?, 'text', ?, '{}')
    `).bind(postId, userId, content).run()

    const formatted = await fetchSocialPostById(db, postId, userId)
    return formatted
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
