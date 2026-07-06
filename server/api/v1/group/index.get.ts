import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'

const SEED_USERS = [
  { id: 'usr_nune', google_id: 'google_gid_nune', display_name: 'Nune', subscription_tier: 'free', logging_streak_days: 12, score: 72, tier: 'Steady', tier_th: 'มั่นคง', badges: ['WEEK_WARRIOR', 'BUDGET_BOSS'] },
  { id: 'usr_boss', google_id: 'google_gid_boss', display_name: 'Boss', subscription_tier: 'premium', logging_streak_days: 8, score: 68, tier: 'Steady', tier_th: 'มั่นคง', badges: ['FIRST_LOG', 'EMERGENCY_READY'] },
  { id: 'usr_peak', google_id: 'google_gid_peak', display_name: 'Peak', subscription_tier: 'free', logging_streak_days: 3, score: 54, tier: 'Building', tier_th: 'กำลังสร้าง', badges: ['FIRST_LOG'] },
  { id: 'usr_jane', google_id: 'google_gid_jane', display_name: 'Jane', subscription_tier: 'free', logging_streak_days: 1, score: 48, tier: 'Building', tier_th: 'กำลังสร้าง', badges: ['FIRST_LOG'] }
]

const SEED_FEED = [
  {
    id: 'feed_nune_badge',
    user_id: 'usr_nune',
    event_type: 'badge_earned',
    payload: { badge_code: 'BUDGET_BOSS', badge_name: 'Budget Boss', reactions: { '🎉': 4, '❤️': 2 } },
    created_offset_hours: -24
  },
  {
    id: 'feed_boss_score',
    user_id: 'usr_boss',
    event_type: 'score_changed',
    payload: { previous_score: 65, new_score: 68, tier: 'Steady', reactions: { '👏': 2 } },
    created_offset_hours: -2
  },
  {
    id: 'feed_peak_challenge',
    user_id: 'usr_peak',
    event_type: 'challenge_completed',
    payload: { challenge_name: 'บันทึกค่าใช้จ่ายครบ 5 ครั้ง', reactions: { '👍': 3, '🎉': 2 } },
    created_offset_hours: 0
  }
]

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    // 1. Get user's current group
    const group = await db.prepare(`
      SELECT g.id, g.name, g.invite_code as inviteCode, g.max_members as maxMembers
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `).bind(userId).first()

    if (!group) {
      return { group: null, leaderboard: [], feedEvents: [] }
    }

    const groupId = group.id

    // 2. Check if we need to seed the default members (Nune, Boss, Peak, Jane) into this group
    const membersCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM group_members WHERE group_id = ?
    `).bind(groupId).first()
    const membersCount = membersCountRow ? membersCountRow.c : 0

    if (membersCount <= 1) { // Only the current user is in the group, seed the others to show the leaderboard
      // Insert Seed Users
      const userStatements = []
      const memberStatements = []
      const scoreStatements = []
      const badgeStatements = []

      for (const u of SEED_USERS) {
        // Insert user if not exists
        userStatements.push(db.prepare(`
          INSERT OR IGNORE INTO users (id, google_id, display_name, subscription_tier, logging_streak_days, onboarding_complete)
          VALUES (?, ?, ?, ?, ?, 1)
        `).bind(u.id, u.google_id, u.display_name, u.subscription_tier, u.logging_streak_days))

        // Add user as member to group
        memberStatements.push(db.prepare(`
          INSERT OR IGNORE INTO group_members (group_id, user_id)
          VALUES (?, ?)
        `).bind(groupId, u.id))

        // Add score snapshot
        const snapshotId = `snp_${crypto.randomUUID().replace(/-/g, '')}`
        scoreStatements.push(db.prepare(`
          INSERT OR IGNORE INTO score_snapshots (id, user_id, total_score, tier, tier_th, details)
          VALUES (?, ?, ?, ?, ?, '{}')
        `).bind(snapshotId, u.id, u.score, u.tier, u.tier_th))

        // Add user badges
        for (const badgeCode of u.badges) {
          badgeStatements.push(db.prepare(`
            INSERT OR IGNORE INTO user_badges (user_id, badge_code)
            VALUES (?, ?)
          `).bind(u.id, badgeCode))
        }
      }

      await db.batch([
        ...userStatements,
        ...memberStatements,
        ...scoreStatements,
        ...badgeStatements
      ])

      // Seed Feed Events
      const feedStatements = SEED_FEED.map(f => {
        const timeStr = new Date(Date.now() + f.created_offset_hours * 60 * 60 * 1000).toISOString()
        return db.prepare(`
          INSERT OR IGNORE INTO feed_events (id, group_id, user_id, event_type, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(f.id, groupId, f.user_id, f.event_type, JSON.stringify(f.payload), timeStr)
      })
      await db.batch(feedStatements)
    }

    // Get live members count
    const liveMembersCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM group_members WHERE group_id = ?
    `).bind(groupId).first()
    const liveMembersCount = liveMembersCountRow ? liveMembersCountRow.c : 1

    const finalGroup = {
      ...group,
      membersCount: liveMembersCount
    }

    // 3. Fetch Leaderboard
    const { results: rawLeaderboard } = await db.prepare(`
      SELECT 
        u.id,
        u.display_name as displayName,
        u.logging_streak_days as streakDays,
        u.avatar_url as avatarUrl
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `).bind(groupId).all()

    const leaderboard = []
    for (const member of rawLeaderboard) {
      // Get score
      const scoreRow = await db.prepare(`
        SELECT total_score as score, tier, tier_th as tierTh
        FROM score_snapshots
        WHERE user_id = ?
        ORDER BY calculated_at DESC LIMIT 1
      `).bind(member.id).first()

      // Get badges
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
        badges: badgeRows ? badgeRows.map(r => r.name) : []
      })
    }

    // Sort leaderboard by score DESC
    leaderboard.sort((a, b) => b.score - a.score)
    leaderboard.forEach((item, index) => {
      item.rank = index + 1
    })

    // 4. Fetch Feed Events
    const { results: rawFeed } = await db.prepare(`
      SELECT 
        fe.id,
        fe.user_id as userId,
        u.display_name as displayName,
        fe.event_type as eventType,
        fe.payload,
        fe.created_at as createdAt
      FROM feed_events fe
      JOIN users u ON fe.user_id = u.id
      WHERE fe.group_id = ?
      ORDER BY fe.created_at DESC
      LIMIT 25
    `).bind(groupId).all()

    const feedEvents = (rawFeed || []).map(fe => {
      let payloadObj = {}
      try {
        payloadObj = JSON.parse(fe.payload)
      } catch (e) {}

      const reactions = payloadObj.reactions || {}
      const cleanPayload = { ...payloadObj }
      delete cleanPayload.reactions

      return {
        id: fe.id,
        userId: fe.userId,
        displayName: fe.displayName,
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
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
