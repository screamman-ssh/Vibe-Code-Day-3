import { defineEventHandler, readBody, createError } from 'h3'
import { useDB, getJwtSecret } from '../../../utils/db'
import { signAccessToken, signRefreshToken } from '../../../utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || !body.displayName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing displayName'
    })
  }

  const db = useDB(event)
  const secret = getJwtSecret(event)
  const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`
  const guestGoogleId = `guest_gid_${userId}`

  // Insert guest user into database
  await db.prepare(`
    INSERT INTO users (id, google_id, display_name, subscription_tier, onboarding_complete)
    VALUES (?, ?, ?, 'free', 0)
  `).bind(userId, guestGoogleId, body.displayName.trim()).run()

  const accessToken = await signAccessToken(userId, 'free', secret)
  const refreshToken = await signRefreshToken(userId, secret)

  // Store refresh token
  const tokenHash = crypto.subtle 
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(refreshToken))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
    : `mock_hash_${Date.now()}`

  await db.prepare(`
    INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+30 day'))
  `).bind(tokenHash, userId).run()

  const user = {
    id: userId,
    displayName: body.displayName.trim(),
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${body.displayName}`,
    subscriptionTier: 'free',
    emergencyFundAmount: 0.00,
    onboardingComplete: false
  }

  return {
    accessToken,
    refreshToken,
    user
  }
})
