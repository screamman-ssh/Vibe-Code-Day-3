import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const { results } = await db.prepare(`
      SELECT id, type, amount, category, merchant, note, date, source
      FROM transactions
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
    `).bind(userId).all()

    return results || []
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
