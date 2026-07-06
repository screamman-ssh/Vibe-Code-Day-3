import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.name || body.balance === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing name or balance'
    })
  }

  const db = useDB(event)
  const userId = auth.userId
  const debtId = `debt_${crypto.randomUUID().replace(/-/g, '')}`

  try {
    const balance = parseFloat(body.balance)
    const apr = body.apr !== undefined ? parseFloat(body.apr) : 0.0
    const minPayment = body.minimumPayment !== undefined ? parseFloat(body.minimumPayment) : balance * 0.05
    const dueDay = body.dueDay !== undefined ? parseInt(body.dueDay) : 15

    await db.prepare(`
      INSERT INTO debts (id, user_id, name, balance, apr, minimum_payment, due_day, on_time_streak)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      debtId,
      userId,
      body.name.trim(),
      balance,
      apr,
      minPayment,
      dueDay
    ).run()

    return {
      id: debtId,
      name: body.name.trim(),
      balance,
      apr,
      minimumPayment: minPayment,
      dueDay,
      onTimeStreak: 0
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
