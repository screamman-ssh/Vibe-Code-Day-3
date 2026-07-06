import { defineEventHandler, getQuery, createError } from 'h3'
import { useDB } from '../../../utils/db'

const DEFAULT_CATEGORIES = [
  { category: 'Food', limitAmount: 5000 },
  { category: 'Transport', limitAmount: 2000 },
  { category: 'Housing', limitAmount: 10000 },
  { category: 'Utilities', limitAmount: 3000 },
  { category: 'Entertainment', limitAmount: 2500 },
  { category: 'Health', limitAmount: 1500 },
  { category: 'Education', limitAmount: 2000 },
  { category: 'Debt Payment', limitAmount: 5000 },
  { category: 'Savings', limitAmount: 5000 },
  { category: 'Other', limitAmount: 2000 }
]

function currentMonthPrefix() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const yearMonth = (query.month as string) || currentMonthPrefix()
  const db = useDB(event)
  const userId = auth.userId

  try {
    // 1. Check if any budgets exist for this month
    const existing = await db.prepare(`
      SELECT id FROM budgets WHERE user_id = ? AND year_month = ? LIMIT 1
    `).bind(userId, yearMonth).first()

    // 2. If not, seed default categories for this user/month
    if (!existing) {
      const statements = DEFAULT_CATEGORIES.map(c => {
        const id = `bgt_${crypto.randomUUID().replace(/-/g, '')}`
        return db.prepare(`
          INSERT INTO budgets (id, user_id, category, limit_amount, year_month)
          VALUES (?, ?, ?, ?, ?)
        `).bind(id, userId, c.category, c.limitAmount, yearMonth)
      })
      await db.batch(statements)
    }

    // 3. Query all budgets along with their corresponding spent amount from transactions
    const { results } = await db.prepare(`
      SELECT 
        b.category,
        b.limit_amount as limitAmount,
        COALESCE((
          SELECT SUM(t.amount) 
          FROM transactions t 
          WHERE t.user_id = b.user_id 
            AND t.category = b.category 
            AND t.type = 'expense'
            AND t.date LIKE ?
        ), 0.0) as spentAmount
      FROM budgets b
      WHERE b.user_id = ? AND b.year_month = ?
    `).bind(yearMonth + '%', userId, yearMonth).all()

    return results || []
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
