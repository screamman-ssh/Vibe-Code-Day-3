import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.inviteCode) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing inviteCode' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const code = body.inviteCode.trim().toUpperCase()

  try {
    const groupRow = await db.prepare(`
      SELECT id, name, invite_code, max_members
      FROM groups WHERE invite_code = ?
    `).bind(code).first()

    if (!groupRow) {
      throw createError({ statusCode: 404, statusMessage: 'ไม่พบกลุ่มจากรหัสเชิญนี้' })
    }

    const membersCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM group_members WHERE group_id = ?
    `).bind(groupRow.id).first()
    const count = membersCountRow ? membersCountRow.c : 0

    if (count >= groupRow.max_members) {
      throw createError({ statusCode: 400, statusMessage: 'กลุ่มเต็มแล้ว (รับสมาชิกสูงสุด 15 คน)' })
    }

    await db.prepare(`
      INSERT INTO group_members (group_id, user_id, joined_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET group_id = excluded.group_id
    `).bind(groupRow.id, userId).run()

    return {
      id: groupRow.id,
      name: groupRow.name,
      inviteCode: groupRow.invite_code,
      maxMembers: groupRow.max_members,
      membersCount: count + 1
    }
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
