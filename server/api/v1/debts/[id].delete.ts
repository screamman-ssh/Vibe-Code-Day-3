import { defineEventHandler, createError } from 'h3'
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

    // Run batch delete for payments and debt
    await db.batch([
      db.prepare(`DELETE FROM debt_payments WHERE debt_id = ?`).bind(debtId),
      db.prepare(`DELETE FROM debts WHERE id = ? AND user_id = ?`).bind(debtId, userId)
    ])

    return { success: true }
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
