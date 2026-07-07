import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { normalizeAttachmentIds } from '../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const text = typeof body?.text === 'string' ? body.text : ''
  const attachmentIds = normalizeAttachmentIds(body?.attachmentIds)

  if (text.length > 8000) {
    throw createError({ statusCode: 400, statusMessage: 'Draft text is too long' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    if (!text.trim() && !attachmentIds.length) {
      await db.prepare(`DELETE FROM chat_drafts WHERE user_id = ?`).bind(userId).run()
      return { text: '', attachmentIds: [], updatedAt: null }
    }

    if (attachmentIds.length) {
      const placeholders = attachmentIds.map(() => '?').join(', ')
      const owned = await db.prepare(`
        SELECT id FROM chat_attachments
        WHERE user_id = ? AND id IN (${placeholders}) AND status = 'ready'
      `).bind(userId, ...attachmentIds).all<{ results: Array<{ id: string }> }>()

      const ownedIds = new Set((owned.results || []).map(row => row.id))
      const validIds = attachmentIds.filter(id => ownedIds.has(id))

      await db.batch(
        validIds.map((id, index) =>
          db.prepare(`
            UPDATE chat_attachments
            SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).bind(index, id, userId)
        )
      )

      await db.prepare(`
        INSERT INTO chat_drafts (user_id, text, attachment_ids_json, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          text = excluded.text,
          attachment_ids_json = excluded.attachment_ids_json,
          updated_at = CURRENT_TIMESTAMP
      `).bind(userId, text, JSON.stringify(validIds)).run()

      const row = await db.prepare(`
        SELECT updated_at as updatedAt FROM chat_drafts WHERE user_id = ?
      `).bind(userId).first<{ updatedAt: string }>()

      return {
        text,
        attachmentIds: validIds,
        updatedAt: row?.updatedAt || null
      }
    }

    await db.prepare(`
      INSERT INTO chat_drafts (user_id, text, attachment_ids_json, updated_at)
      VALUES (?, ?, '[]', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        text = excluded.text,
        attachment_ids_json = '[]',
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, text).run()

    const row = await db.prepare(`
      SELECT updated_at as updatedAt FROM chat_drafts WHERE user_id = ?
    `).bind(userId).first<{ updatedAt: string }>()

    return {
      text,
      attachmentIds: [],
      updatedAt: row?.updatedAt || null
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
