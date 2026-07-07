import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const postId = event.context.params?.id
  if (!postId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing post ID' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const post = await db.prepare(`SELECT user_id as userId FROM social_posts WHERE id = ?`).bind(postId).first()
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post Not Found' })
    }
    if (post.userId !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: Not your post' })
    }

    await db.prepare(`DELETE FROM social_posts WHERE id = ?`).bind(postId).run()

    return { id: postId, deleted: true }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
