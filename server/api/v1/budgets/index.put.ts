import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

function currentMonthPrefix() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.category || body.limitAmount === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing category or limitAmount'
    })
  }

  const db = useDB(event)
  const userId = auth.userId
  const category = body.category.trim()
  const limitAmount = parseFloat(body.limitAmount)
  const yearMonth = body.month || currentMonthPrefix()
  const bgtId = `bgt_${crypto.randomUUID().replace(/-/g, '')}`

  try {
    await db.prepare(`
      INSERT INTO budgets (id, user_id, category, limit_amount, year_month)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, category, year_month) DO UPDATE SET
        limit_amount = excluded.limit_amount
    `).bind(bgtId, userId, category, limitAmount, yearMonth).run()

    return {
      category,
      limitAmount,
      yearMonth
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
