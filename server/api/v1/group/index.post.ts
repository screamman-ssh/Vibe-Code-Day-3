import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing group name' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const groupId = `grp_${crypto.randomUUID().replace(/-/g, '')}`
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO groups (id, name, invite_code, owner_id, max_members)
        VALUES (?, ?, ?, ?, 15)
      `).bind(groupId, body.name.trim(), inviteCode, userId),
      db.prepare(`
        INSERT INTO group_members (group_id, user_id, joined_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET group_id = excluded.group_id
      `).bind(groupId, userId)
    ])

    return {
      id: groupId,
      name: body.name.trim(),
      inviteCode,
      maxMembers: 15,
      membersCount: 1
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
