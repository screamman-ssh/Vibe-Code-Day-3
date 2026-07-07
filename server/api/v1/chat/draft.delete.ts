import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { useR2 } from '../../../utils/r2'
import { parseAttachmentIds } from '../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const bucket = useR2(event)
  const userId = auth.userId

  try {
    const draft = await db.prepare(`
      SELECT attachment_ids_json as attachmentIdsJson
      FROM chat_drafts
      WHERE user_id = ?
    `).bind(userId).first<{ attachmentIdsJson: string }>()

    const attachmentIds = parseAttachmentIds(draft?.attachmentIdsJson)

    if (attachmentIds.length) {
      const placeholders = attachmentIds.map(() => '?').join(', ')
      const rows = await db.prepare(`
        SELECT id, r2_key as r2Key
        FROM chat_attachments
        WHERE user_id = ? AND id IN (${placeholders})
      `).bind(userId, ...attachmentIds).all<{ results: Array<{ id: string; r2Key: string | null }> }>()

      if (bucket) {
        await Promise.all(
          (rows.results || [])
            .filter(row => row.r2Key)
            .map(row => bucket.delete(row.r2Key!))
        )
      }

      await db.prepare(`
        UPDATE chat_attachments
        SET status = 'orphan', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND id IN (${placeholders})
      `).bind(userId, ...attachmentIds).run()
    }

    await db.prepare(`DELETE FROM chat_drafts WHERE user_id = ?`).bind(userId).run()

    return { ok: true }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
