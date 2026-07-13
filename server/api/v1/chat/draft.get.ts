import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../utils/db'
import { parseAttachmentIds, pruneOrphanedChatAttachments } from '../../../utils/chatAttachments'

function attachmentFilePath(id: string) {
  return `/api/v1/chat/attachments/${id}/file`
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    await pruneOrphanedChatAttachments(db, userId)

    const draft = await db.prepare(`
      SELECT text, attachment_ids_json as attachmentIdsJson, updated_at as updatedAt
      FROM chat_drafts
      WHERE user_id = ?
    `).bind(userId).first<{ text: string; attachmentIdsJson: string; updatedAt: string }>()

    if (!draft) {
      return { text: '', attachments: [], updatedAt: null }
    }

    const attachmentIds = parseAttachmentIds(draft.attachmentIdsJson)
    if (!attachmentIds.length) {
      return {
        text: draft.text || '',
        attachments: [],
        updatedAt: draft.updatedAt || null
      }
    }

    const placeholders = attachmentIds.map(() => '?').join(', ')
    const rows = await db.prepare(`
      SELECT id, mime_type as mimeType, file_name as fileName, file_size as fileSize,
             sort_order as sortOrder, status
      FROM chat_attachments
      WHERE user_id = ? AND id IN (${placeholders}) AND status != 'orphan'
    `).bind(userId, ...attachmentIds).all<{
      results: Array<{
        id: string
        mimeType: string
        fileName: string | null
        fileSize: number
        sortOrder: number
        status: string
      }>
    }>()

    const byId = new Map((rows.results || []).map(row => [row.id, row]))
    const attachments = attachmentIds
      .map((id, index) => {
        const row = byId.get(id)
        if (!row) return null
        return {
          id: row.id,
          mimeType: row.mimeType,
          fileName: row.fileName,
          fileSize: row.fileSize,
          sortOrder: index,
          status: row.status,
          url: row.status === 'ready' ? attachmentFilePath(row.id) : null
        }
      })
      .filter(Boolean)

    return {
      text: draft.text || '',
      attachments,
      updatedAt: draft.updatedAt || null
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
