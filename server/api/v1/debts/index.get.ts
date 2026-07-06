import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'

const DEFAULT_DEBTS = [
  { name: 'บัตรเครดิตธนาคาร A', balance: 35000.0, apr: 16.0, minimumPayment: 1750.0, dueDay: 15, onTimeStreak: 4 },
  { name: 'สินเชื่อส่วนบุคคล B', balance: 65000.0, apr: 18.0, minimumPayment: 3250.0, dueDay: 28, onTimeStreak: 2 }
]

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    // Check if user has any debts
    const existing = await db.prepare(`
      SELECT id FROM debts WHERE user_id = ? LIMIT 1
    `).bind(userId).first()

    // Seed default debts if none exist
    if (!existing) {
      const statements = DEFAULT_DEBTS.map(d => {
        const id = `debt_${crypto.randomUUID().replace(/-/g, '')}`
        return db.prepare(`
          INSERT INTO debts (id, user_id, name, balance, apr, minimum_payment, due_day, on_time_streak)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, userId, d.name, d.balance, d.apr, d.minimumPayment, d.dueDay, d.onTimeStreak)
      })
      await db.batch(statements)
    }

    // Fetch debts
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
