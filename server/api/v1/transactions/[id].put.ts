import { defineEventHandler, readBody, createError } from 'h3'
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

  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing body' })
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
      UPDATE transactions SET
        type = COALESCE(?, type),
        amount = COALESCE(?, amount),
        category = COALESCE(?, category),
        merchant = COALESCE(?, merchant),
        note = COALESCE(?, note),
        date = COALESCE(?, date)
      WHERE id = ? AND user_id = ?
    `).bind(
      body.type || null,
      body.amount !== undefined ? parseFloat(body.amount) : null,
      body.category ? body.category.trim() : null,
      body.merchant !== undefined ? (body.merchant ? body.merchant.trim() : null) : undefined,
      body.note !== undefined ? (body.note ? body.note.trim() : null) : undefined,
      body.date || null,
      txId,
      userId
    ).run()

    const updatedTx = await db.prepare(`
      SELECT id, type, amount, category, merchant, note, date, source
      FROM transactions WHERE id = ?
    `).bind(txId).first()

    return updatedTx
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
