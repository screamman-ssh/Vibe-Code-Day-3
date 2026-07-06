import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const txId = event.context.params?.id
  if (!txId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing transaction ID' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    // Verify ownership
    const tx = await db.prepare(`
      SELECT id FROM transactions WHERE id = ? AND user_id = ?
    `).bind(txId, userId).first()

    if (!tx) {
      throw createError({ statusCode: 404, statusMessage: 'Transaction Not Found' })
    }

    await db.prepare(`
      DELETE FROM transactions WHERE id = ? AND user_id = ?
    `).bind(txId, userId).run()

    return { success: true }
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
