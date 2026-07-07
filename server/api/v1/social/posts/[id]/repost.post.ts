import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../../../utils/db'
import { fetchSocialPostById } from '../../../../../utils/social'

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
  const mode = body?.mode
  if (mode !== 'simple' && mode !== 'quote') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: mode must be simple or quote' })
  }

  const quoteText = body?.quoteText?.trim() || null
  if (mode === 'quote' && !quoteText) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: quoteText required for quote repost' })
  }
  if (quoteText && quoteText.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: quoteText max 500 chars' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const original = await db.prepare(`
      SELECT id, user_id as userId FROM social_posts WHERE id = ?
    `).bind(postId).first()

    if (!original) {
      throw createError({ statusCode: 404, statusMessage: 'Post Not Found' })
    }

    if (original.userId === userId) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot repost your own post' })
    }

    const existing = await db.prepare(`
      SELECT id FROM social_posts
      WHERE user_id = ? AND repost_of_id = ? AND post_type IN ('repost', 'quote')
      LIMIT 1
    `).bind(userId, postId).first()

    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Already reposted' })
    }

    const newPostId = `post_${crypto.randomUUID().replace(/-/g, '')}`
    const postType = mode === 'quote' ? 'quote' : 'repost'

    await db.prepare(`
      INSERT INTO social_posts (id, user_id, post_type, content, payload, repost_of_id, quote_text)
      VALUES (?, ?, ?, ?, '{}', ?, ?)
    `).bind(newPostId, userId, postType, mode === 'quote' ? quoteText : null, postId, mode === 'quote' ? quoteText : null).run()

    const formatted = await fetchSocialPostById(db, newPostId, userId)
    return formatted
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
