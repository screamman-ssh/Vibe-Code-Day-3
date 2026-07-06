import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const debtId = event.context.params?.id
  if (!debtId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing debt ID' })
  }

  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing body' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    // Verify ownership
    const debt = await db.prepare(`
      SELECT id FROM debts WHERE id = ? AND user_id = ?
    `).bind(debtId, userId).first()

    if (!debt) {
      throw createError({ statusCode: 404, statusMessage: 'Debt Not Found' })
    }

    await db.prepare(`
      UPDATE debts SET
        name = COALESCE(?, name),
        balance = COALESCE(?, balance),
        apr = COALESCE(?, apr),
        minimum_payment = COALESCE(?, minimum_payment),
        due_day = COALESCE(?, due_day)
      WHERE id = ? AND user_id = ?
    `).bind(
      body.name ? body.name.trim() : null,
      body.balance !== undefined ? parseFloat(body.balance) : null,
      body.apr !== undefined ? parseFloat(body.apr) : null,
      body.minimumPayment !== undefined ? parseFloat(body.minimumPayment) : null,
      body.dueDay !== undefined ? parseInt(body.dueDay) : null,
      debtId,
      userId
    ).run()

    const updated = await db.prepare(`
      SELECT id, name, balance, apr, minimum_payment as minimumPayment, due_day as dueDay, on_time_streak as onTimeStreak
      FROM debts WHERE id = ?
    `).bind(debtId).first()

    return updated
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
