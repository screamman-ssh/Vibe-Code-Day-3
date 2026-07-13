import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { purgeSeedUsers, SEED_USER_IDS } from '../../../utils/groupFeed'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    await purgeSeedUsers(db)

    const group = await db.prepare(`
      SELECT g.id, g.name, g.invite_code as inviteCode, g.max_members as maxMembers, g.owner_id as ownerId
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `).bind(userId).first()

    if (!group) {
      return { group: null, leaderboard: [], feedEvents: [] }
    }

    const groupId = group.id

    const membersCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM group_members WHERE group_id = ?
    `).bind(groupId).first()
    const membersCount = membersCountRow ? membersCountRow.c : 1

    const finalGroup = {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      maxMembers: group.maxMembers,
      membersCount,
      ownerId: group.ownerId,
      isOwner: group.ownerId === userId
    }

    const seedPh = SEED_USER_IDS.map(() => '?').join(', ')
    const { results: rawLeaderboard } = await db.prepare(`
      SELECT 
        u.id,
        u.display_name as displayName,
        u.logging_streak_days as streakDays,
        u.avatar_url as avatarUrl
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
        AND gm.user_id NOT IN (${seedPh})
    `).bind(groupId, ...SEED_USER_IDS).all()

    const leaderboard = []
    for (const member of rawLeaderboard || []) {
      const scoreRow = await db.prepare(`
        SELECT total_score as score, tier, tier_th as tierTh
        FROM score_snapshots
        WHERE user_id = ?
        ORDER BY calculated_at DESC LIMIT 1
      `).bind(member.id).first()

      const { results: badgeRows } = await db.prepare(`
        SELECT b.name
        FROM user_badges ub
        JOIN badges b ON ub.badge_code = b.code
        WHERE ub.user_id = ?
      `).bind(member.id).all()

      leaderboard.push({
        id: member.id,
        displayName: member.displayName,
        streakDays: member.streakDays,
        avatarUrl: member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.displayName}`,
        score: scoreRow ? scoreRow.score : 50,
        tier: scoreRow ? scoreRow.tier : 'Building',
        tierTh: scoreRow ? scoreRow.tierTh : 'กำลังสร้าง',
        badges: badgeRows ? badgeRows.map((r: any) => r.name) : []
      })
    }

    leaderboard.sort((a, b) => b.score - a.score)
    leaderboard.forEach((item, index) => {
      item.rank = index + 1
    })

    const { results: rawFeed } = await db.prepare(`
      SELECT 
        fe.id,
        fe.user_id as userId,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        fe.event_type as eventType,
        fe.payload,
        fe.created_at as createdAt
      FROM feed_events fe
      JOIN users u ON fe.user_id = u.id
      WHERE fe.group_id = ?
      ORDER BY fe.created_at DESC
      LIMIT 25
    `).bind(groupId).all()

    const feedEvents = (rawFeed || []).map((fe: any) => {
      let payloadObj: Record<string, unknown> = {}
      try {
        payloadObj = JSON.parse(fe.payload)
      } catch {
        payloadObj = {}
      }

      const reactions = (payloadObj.reactions as Record<string, number>) || {}
      const cleanPayload = { ...payloadObj }
      delete cleanPayload.reactions

      return {
        id: fe.id,
        userId: fe.userId,
        displayName: fe.displayName,
        avatarUrl: fe.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fe.displayName}`,
        eventType: fe.eventType,
        payload: cleanPayload,
        createdAt: fe.createdAt,
        reactions
      }
    })

    return {
      group: finalGroup,
      leaderboard,
      feedEvents
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
