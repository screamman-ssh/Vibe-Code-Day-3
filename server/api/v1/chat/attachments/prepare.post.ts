import { defineEventHandler, readBody, createError, getRequestURL } from 'h3'
import { useDB } from '../../../../utils/db'
import {
  MAX_CHAT_ATTACHMENTS,
  createAttachmentId,
  chatAttachmentKey,
  validateAttachmentMeta,
  pruneOrphanedChatAttachments,
  countComposerAttachments
} from '../../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const validated = validateAttachmentMeta(body?.fileName, body?.mimeType, body?.fileSize)
  if (!validated.ok) {
    throw createError({ statusCode: 400, statusMessage: validated.error })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    await pruneOrphanedChatAttachments(db, userId)

    const activeCount = await countComposerAttachments(db, userId)
    if (activeCount >= MAX_CHAT_ATTACHMENTS) {
      throw createError({ statusCode: 400, statusMessage: 'Maximum 8 images per draft' })
    }

    const attachmentId = createAttachmentId()
    const r2Key = chatAttachmentKey(userId, attachmentId, validated.mimeType)

    await db.prepare(`
      INSERT INTO chat_attachments (
        id, user_id, r2_key, mime_type, file_name, file_size, sort_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      attachmentId,
      userId,
      r2Key,
      validated.mimeType,
      validated.fileName,
      validated.fileSize,
      activeCount
    ).run()

    const origin = getRequestURL(event).origin
    const uploadUrl = `${origin}/api/v1/chat/attachments/${attachmentId}/upload`

    return {
      attachmentId,
      uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': validated.mimeType
      },
      previewUrl: `/api/v1/chat/attachments/${attachmentId}/file`
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
