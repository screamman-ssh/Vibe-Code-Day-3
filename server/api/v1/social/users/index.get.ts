import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../utils/db'
import { ensureSocialSeedData, getUserScore } from '../../../../utils/social'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const query = getQuery(event)
  const search = (query.q as string || '').trim().toLowerCase()

  try {
    await ensureSocialSeedData(db)

    let sql = `
      SELECT
        u.id,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        u.bio,
        u.logging_streak_days as streakDays,
        CASE WHEN uf.follower_id IS NOT NULL THEN 1 ELSE 0 END as isFollowing
      FROM users u
      LEFT JOIN user_follows uf ON uf.following_id = u.id AND uf.follower_id = ?
      WHERE u.id != ?
    `
    const binds: any[] = [userId, userId]

    if (search) {
      sql += ` AND LOWER(u.display_name) LIKE ?`
      binds.push(`%${search}%`)
    }

    sql += ` ORDER BY isFollowing DESC, u.display_name ASC LIMIT 30`

    const { results } = await db.prepare(sql).bind(...binds).all()

    const users = []
    for (const row of results || []) {
      const score = await getUserScore(db, row.id)
      users.push({
        id: row.id,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.displayName}`,
        bio: row.bio || '',
        streakDays: row.streakDays,
        isFollowing: !!row.isFollowing,
        ...score
      })
    }

    return { users }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
