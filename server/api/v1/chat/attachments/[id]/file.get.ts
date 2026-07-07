import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3'
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
    SELECT r2_key as r2Key, mime_type as mimeType, status
    FROM chat_attachments
    WHERE id = ? AND user_id = ? AND status = 'ready'
  `).bind(attachmentId, userId).first<{
    r2Key: string
    mimeType: string
    status: string
  }>()

  if (!row?.r2Key) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  if (!bucket) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured' })
  }

  const object = await bucket.get(row.r2Key)
  if (!object) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found in storage' })
  }

  setHeader(event, 'Content-Type', object.httpMetadata?.contentType || row.mimeType)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')

  return object.body
})
