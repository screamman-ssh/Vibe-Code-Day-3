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
    const { results: debts } = await db.prepare(`
      SELECT id, name, balance, apr, minimum_payment as minimumPayment, due_day as dueDay, on_time_streak as onTimeStreak
      FROM debts
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).bind(userId).all()

    return debts || []
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
