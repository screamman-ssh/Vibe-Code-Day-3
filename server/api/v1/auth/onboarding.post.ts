import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.action) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing action' })
  }

  const db = useDB(event)
  const userId = auth.userId

  if (body.action === 'create') {
    if (!body.groupName) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing groupName' })
    }
    const groupId = `grp_${crypto.randomUUID().replace(/-/g, '')}`
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Run batch transaction insert
    await db.batch([
      db.prepare(`
        INSERT INTO groups (id, name, invite_code, owner_id, max_members)
        VALUES (?, ?, ?, ?, 15)
      `).bind(groupId, body.groupName.trim(), inviteCode, userId),
      db.prepare(`
        INSERT INTO group_members (group_id, user_id, joined_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET group_id = excluded.group_id
      `).bind(groupId, userId),
      db.prepare(`
        UPDATE users SET onboarding_complete = 1 WHERE id = ?
      `).bind(userId)
    ])
  } else if (body.action === 'join') {
    if (!body.inviteCode) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing inviteCode' })
    }
    
    const code = body.inviteCode.trim().toUpperCase()
    const groupRow = await db.prepare(`SELECT id, max_members FROM groups WHERE invite_code = ?`).bind(code).first()

    if (!groupRow) {
      throw createError({ statusCode: 404, statusMessage: 'Group Not Found' })
    }

    const membersCountRow = await db.prepare(`SELECT COUNT(*) as c FROM group_members WHERE group_id = ?`).bind(groupRow.id).first()
    const count = membersCountRow ? membersCountRow.c : 0

    if (count >= groupRow.max_members) {
      throw createError({ statusCode: 400, statusMessage: 'Group is full (max 15 members)' })
    }

    await db.batch([
      db.prepare(`
        INSERT INTO group_members (group_id, user_id, joined_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET group_id = excluded.group_id
      `).bind(groupRow.id, userId),
      db.prepare(`
        UPDATE users SET onboarding_complete = 1 WHERE id = ?
      `).bind(userId)
    ])
  } else {
    // Just complete onboarding without group
    await db.prepare(`UPDATE users SET onboarding_complete = 1 WHERE id = ?`).bind(userId).run()
  }

  // Retrieve user updated profiles
  const updatedUser = await db.prepare(`
    SELECT id, display_name, avatar_url, subscription_tier, emergency_fund_amount, onboarding_complete 
    FROM users WHERE id = ?
  `).bind(userId).first()

  return {
    id: updatedUser.id,
    displayName: updatedUser.display_name,
    avatarUrl: updatedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${updatedUser.display_name}`,
    subscriptionTier: updatedUser.subscription_tier,
    emergencyFundAmount: updatedUser.emergency_fund_amount,
    onboardingComplete: !!updatedUser.onboarding_complete
  }
})
