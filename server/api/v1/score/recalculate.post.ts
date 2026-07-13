import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { calculateUserScore } from '../../../utils/scoreCalculator'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Fetch user logging status
    const user = await db.prepare(`
      SELECT last_log_date, logging_streak_days FROM users WHERE id = ?
    `).bind(userId).first()

    if (user) {
      let newStreak = user.logging_streak_days
      if (user.last_log_date !== today) {
        if (user.last_log_date === yesterday) {
          newStreak += 1
        } else {
          newStreak = 1
        }
        
        await db.prepare(`
          UPDATE users SET logging_streak_days = ?, last_log_date = ? WHERE id = ?
        `).bind(newStreak, today, userId).run()
      }
    }

    // Run dynamic score calculation
    return await calculateUserScore(db, userId)
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
