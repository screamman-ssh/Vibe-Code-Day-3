import { defineEventHandler, getQuery, createError } from 'h3'
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

  const category = event.context.params?.category
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing category' })
  }

  const query = getQuery(event)
  const yearMonth = (query.month as string) || currentMonthPrefix()
  const db = useDB(event)
  const userId = auth.userId

  try {
    await db.prepare(`
      DELETE FROM budgets WHERE user_id = ? AND category = ? AND year_month = ?
    `).bind(userId, decodeURIComponent(category), yearMonth).run()

    return { success: true }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
