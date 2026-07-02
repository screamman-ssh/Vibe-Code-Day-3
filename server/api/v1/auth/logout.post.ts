import { defineEventHandler, readBody } from 'h3'
import { useDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (body && body.refreshToken) {
    const db = useDB(event)
    const tokenHash = crypto.subtle 
      ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.refreshToken))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
      : `mock_hash_${Date.now()}`

    await db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?`).bind(tokenHash).run()
  }
  return { success: true }
})
