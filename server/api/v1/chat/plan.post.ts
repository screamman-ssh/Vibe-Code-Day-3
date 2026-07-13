import { defineEventHandler, readBody, createError } from 'h3'
import { planChatActions } from '../../../utils/chatPlanner'
import { normalizeAttachmentIds } from '../../../utils/chatAttachments'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const attachmentIds = normalizeAttachmentIds(body?.attachmentIds)

  if (!message && !attachmentIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Missing message or attachmentIds' })
  }

  const actions = await planChatActions(event, {
    userId: auth.userId,
    message: message || 'บันทึกรายการจากรูปที่แนบมาให้หน่อย',
    attachmentIds
  })

  return { actions }
})
