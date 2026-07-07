import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../../utils/db'
import { normalizeAttachmentIds } from '../../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const attachmentIds = normalizeAttachmentIds(body?.attachmentIds)

  if (!attachmentIds.length) {
    return { attachmentIds: [], updatedAt: null }
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    const placeholders = attachmentIds.map(() => '?').join(', ')
    const rows = await db.prepare(`
      SELECT id FROM chat_attachments
      WHERE user_id = ? AND id IN (${placeholders}) AND status = 'ready'
    `).bind(userId, ...attachmentIds).all<{ results: Array<{ id: string }> }>()

    const readyIds = new Set((rows.results || []).map(row => row.id))
    const validIds = attachmentIds.filter(id => readyIds.has(id))

    await db.batch(
      validIds.map((id, index) =>
        db.prepare(`
          UPDATE chat_attachments
          SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).bind(index, id, userId)
      )
    )

    const draft = await db.prepare(`
      SELECT text FROM chat_drafts WHERE user_id = ?
    `).bind(userId).first<{ text: string }>()

    await db.prepare(`
      INSERT INTO chat_drafts (user_id, text, attachment_ids_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        attachment_ids_json = excluded.attachment_ids_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, draft?.text || '', JSON.stringify(validIds)).run()

    const updated = await db.prepare(`
      SELECT updated_at as updatedAt FROM chat_drafts WHERE user_id = ?
    `).bind(userId).first<{ updatedAt: string }>()

    return {
      attachmentIds: validIds,
      updatedAt: updated?.updatedAt || null
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
