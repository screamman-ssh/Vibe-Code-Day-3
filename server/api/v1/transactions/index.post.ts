import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.type || body.amount === undefined || !body.category || !body.date) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing required transaction fields'
    })
  }

  const db = useDB(event)
  const userId = auth.userId
  const txId = `tx_${crypto.randomUUID().replace(/-/g, '')}`

  try {
    await db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, category, merchant, note, date, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      userId,
      body.type,
      parseFloat(body.amount),
      body.category.trim(),
      body.merchant ? body.merchant.trim() : null,
      body.note ? body.note.trim() : null,
      body.date,
      body.source || 'manual'
    ).run()

    return {
      id: txId,
      type: body.type,
      amount: parseFloat(body.amount),
      category: body.category.trim(),
      merchant: body.merchant ? body.merchant.trim() : null,
      note: body.note ? body.note.trim() : null,
      date: body.date,
      source: body.source || 'manual'
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database error: ${err.message}`
    })
  }
})
