import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const eventId = event.context.params?.id
  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing feed event ID' })
  }

  const body = await readBody(event)
  if (!body || !body.emoji) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing emoji' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const emoji = body.emoji.trim()

  try {
    // 1. Fetch feed event
    const feed = await db.prepare(`
      SELECT payload FROM feed_events WHERE id = ?
    `).bind(eventId).first()

    if (!feed) {
      throw createError({ statusCode: 404, statusMessage: 'Feed Event Not Found' })
    }

    let payloadObj = {}
    try {
      payloadObj = JSON.parse(feed.payload)
    } catch (e) {}

    const reactions = payloadObj.reactions || {}
    reactions[emoji] = (reactions[emoji] || 0) + 1
    payloadObj.reactions = reactions

    // 2. Update feed event payload
    await db.prepare(`
      UPDATE feed_events SET payload = ? WHERE id = ?
    `).bind(JSON.stringify(payloadObj), eventId).run()

    return {
      id: eventId,
      reactions
    }
  } catch (err) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})
