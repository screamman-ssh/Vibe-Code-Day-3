import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useDB } from '../../../../utils/db'
import { useR2 } from '../../../../utils/r2'
import { parseAttachmentIds } from '../../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const attachmentId = getRouterParam(event, 'id')
  if (!attachmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing attachment id' })
  }

  const db = useDB(event)
  const bucket = useR2(event)
  const userId = auth.userId

  try {
    const row = await db.prepare(`
      SELECT id, r2_key as r2Key
      FROM chat_attachments
      WHERE id = ? AND user_id = ?
    `).bind(attachmentId, userId).first<{ id: string; r2Key: string | null }>()

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
    }

    if (row.r2Key && bucket) {
      await bucket.delete(row.r2Key)
    }

    await db.prepare(`
      UPDATE chat_attachments
      SET status = 'orphan', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(attachmentId, userId).run()

    const draft = await db.prepare(`
      SELECT attachment_ids_json as attachmentIdsJson
      FROM chat_drafts
      WHERE user_id = ?
    `).bind(userId).first<{ attachmentIdsJson: string }>()

    if (draft) {
      const nextIds = parseAttachmentIds(draft.attachmentIdsJson)
        .filter(id => id !== attachmentId)

      await db.prepare(`
        UPDATE chat_drafts
        SET attachment_ids_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(JSON.stringify(nextIds), userId).run()
    }

    return { ok: true }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
