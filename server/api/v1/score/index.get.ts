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
    // Retrieve latest snapshot
    const latest = await db.prepare(`
      SELECT total_score as totalScore, tier, tier_th as tierTh, details
      FROM score_snapshots
      WHERE user_id = ?
      ORDER BY calculated_at DESC LIMIT 1
    `).bind(userId).first()

    if (latest) {
      // Fetch logging streak
      const user = await db.prepare(`SELECT logging_streak_days FROM users WHERE id = ?`).bind(userId).first()
      const streakDays = user ? user.logging_streak_days : 0

      let dimensions = []
      try {
        dimensions = JSON.parse(latest.details)
      } catch (e) {}

      return {
        totalScore: latest.totalScore,
        tier: latest.tier,
        tierTh: latest.tierTh,
        streakDays,
        dimensions
      }
    }

    // No snapshot exists, calculate and return
    return await calculateUserScore(event, userId)
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
