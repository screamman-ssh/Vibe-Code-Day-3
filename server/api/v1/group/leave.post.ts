import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const membership = await db.prepare(`
      SELECT gm.group_id as groupId, gm.user_id as userId, g.owner_id as ownerId
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `).bind(userId).first()

    if (!membership) {
      return { ok: true, group: null }
    }

    const groupId = membership.groupId
    const isOwner = membership.ownerId === userId

    if (isOwner) {
      const otherMembers = await db.prepare(`
        SELECT user_id as userId FROM group_members
        WHERE group_id = ? AND user_id != ?
        ORDER BY joined_at ASC
      `).bind(groupId, userId).all()

      const others = otherMembers?.results || []

      if (others.length === 0) {
        await db.batch([
          db.prepare(`DELETE FROM feed_events WHERE group_id = ?`).bind(groupId),
          db.prepare(`DELETE FROM group_members WHERE group_id = ?`).bind(groupId),
          db.prepare(`DELETE FROM groups WHERE id = ?`).bind(groupId)
        ])
      } else {
        const newOwnerId = others[0].userId
        await db.batch([
          db.prepare(`UPDATE groups SET owner_id = ? WHERE id = ?`).bind(newOwnerId, groupId),
          db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).bind(groupId, userId)
        ])
      }
    } else {
      await db.prepare(`
        DELETE FROM group_members WHERE group_id = ? AND user_id = ?
      `).bind(groupId, userId).run()
    }

    return { ok: true, group: null }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
