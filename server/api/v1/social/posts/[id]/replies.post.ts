import { defineEventHandler, readBody, createError } from 'h3'
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

  const body = await readBody(event)
  const content = body?.content?.trim()
  const parentReplyId = body?.parentReplyId || null

  if (!content || content.length > 280) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Content required (max 280 chars)' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const post = await db.prepare(`SELECT id FROM social_posts WHERE id = ?`).bind(postId).first()
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post Not Found' })
    }

    if (parentReplyId) {
      const parent = await db.prepare(`
        SELECT id, post_id as postId FROM social_replies WHERE id = ?
      `).bind(parentReplyId).first()
      if (!parent || parent.postId !== postId) {
        throw createError({ statusCode: 400, statusMessage: 'Bad Request: Invalid parent reply' })
      }
    }

    const replyId = `reply_${crypto.randomUUID().replace(/-/g, '')}`
    await db.prepare(`
      INSERT INTO social_replies (id, post_id, parent_reply_id, user_id, content)
      VALUES (?, ?, ?, ?, ?)
    `).bind(replyId, postId, parentReplyId, userId, content).run()

    const row = await db.prepare(`
      SELECT
        sr.id,
        sr.post_id as postId,
        sr.parent_reply_id as parentReplyId,
        sr.user_id as userId,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        sr.content,
        sr.created_at as createdAt,
        0 as likeCount,
        0 as isLiked
      FROM social_replies sr
      JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `).bind(replyId).first()

    return formatReply(row, userId)
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
