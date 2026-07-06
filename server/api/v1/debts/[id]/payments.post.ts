import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../../utils/db'

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
  if (!body || body.amount === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing payment amount' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const paymentId = `pmt_${crypto.randomUUID().replace(/-/g, '')}`
  const amount = parseFloat(body.amount)
  const paidDate = body.paidDate || new Date().toISOString().split('T')[0]
  const onTime = body.onTime !== undefined ? (body.onTime ? 1 : 0) : 1

  try {
    // Verify ownership and get current balance/streak
    const debt = await db.prepare(`
      SELECT id, balance, on_time_streak FROM debts WHERE id = ? AND user_id = ?
    `).bind(debtId, userId).first()

    if (!debt) {
      throw createError({ statusCode: 404, statusMessage: 'Debt Not Found' })
    }

    const newBalance = Math.max(debt.balance - amount, 0.0)
    const newStreak = debt.on_time_streak + 1

    await db.batch([
      db.prepare(`
        INSERT INTO debt_payments (id, debt_id, amount, paid_date, on_time)
        VALUES (?, ?, ?, ?, ?)
      `).bind(paymentId, debtId, amount, paidDate, onTime),
      db.prepare(`
        UPDATE debts SET
          balance = ?,
          on_time_streak = ?
        WHERE id = ? AND user_id = ?
      `).bind(newBalance, newStreak, debtId, userId)
    ])

    return {
      id: debtId,
      balance: newBalance,
      onTimeStreak: newStreak
    }
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
