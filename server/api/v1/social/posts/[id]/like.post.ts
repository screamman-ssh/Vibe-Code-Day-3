import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../../utils/db'

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
    const post = await db.prepare(`SELECT id FROM social_posts WHERE id = ?`).bind(postId).first()
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post Not Found' })
    }

    const existing = await db.prepare(`
      SELECT 1 as v FROM post_likes WHERE user_id = ? AND post_id = ?
    `).bind(userId, postId).first()

    if (existing) {
      await db.prepare(`DELETE FROM post_likes WHERE user_id = ? AND post_id = ?`).bind(userId, postId).run()
    } else {
      await db.prepare(`INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)`).bind(userId, postId).run()
    }

    const countRow = await db.prepare(`
      SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?
    `).bind(postId).first()

    return {
      id: postId,
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
