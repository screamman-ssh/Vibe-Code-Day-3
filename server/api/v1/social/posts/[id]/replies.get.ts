import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../../utils/db'
import { formatReply } from '../../../../../utils/social'

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

    const { results } = await db.prepare(`
      SELECT
        sr.id,
        sr.post_id as postId,
        sr.parent_reply_id as parentReplyId,
        sr.user_id as userId,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        sr.content,
        sr.created_at as createdAt,
        (SELECT COUNT(*) FROM reply_likes rl WHERE rl.reply_id = sr.id) as likeCount,
        (SELECT 1 FROM reply_likes rl WHERE rl.reply_id = sr.id AND rl.user_id = ?) as isLiked
      FROM social_replies sr
      JOIN users u ON sr.user_id = u.id
      WHERE sr.post_id = ?
      ORDER BY sr.created_at ASC
    `).bind(userId, postId).all()

    const replies = (results || []).map((row: any) => formatReply(row, userId))
    return { replies }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
