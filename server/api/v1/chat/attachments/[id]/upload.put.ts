import { defineEventHandler, getRouterParam, readRawBody, createError } from 'h3'
import { useDB } from '../../../../../utils/db'
import { useR2 } from '../../../../../utils/r2'

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

  const row = await db.prepare(`
    SELECT id, r2_key as r2Key, mime_type as mimeType, file_size as fileSize, status
    FROM chat_attachments
    WHERE id = ? AND user_id = ?
  `).bind(attachmentId, userId).first<{
    id: string
    r2Key: string
    mimeType: string
    fileSize: number
    status: string
  }>()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  if (row.status === 'ready') {
    return {
      attachmentId: row.id,
      status: 'ready',
      previewUrl: `/api/v1/chat/attachments/${row.id}/file`
    }
  }

  const body = await readRawBody(event, false)
  if (!body || body.byteLength === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Empty upload body' })
  }

  if (body.byteLength > row.fileSize * 1.05 + 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Uploaded file exceeds declared size' })
  }

  if (!bucket) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured' })
  }

  try {
    await bucket.put(row.r2Key, body, {
      httpMetadata: { contentType: row.mimeType }
    })

    await db.prepare(`
      UPDATE chat_attachments
      SET status = 'ready', file_size = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(body.byteLength, attachmentId, userId).run()

    return {
      attachmentId: row.id,
      status: 'ready',
      previewUrl: `/api/v1/chat/attachments/${row.id}/file`
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Upload failed: ${err.message}`
    })
  }
})
