import { defineEventHandler, readBody, createError } from 'h3'
import { useDB, getJwtSecret } from '../../../utils/db'
import { verifyJwtToken, signAccessToken, signRefreshToken } from '../../../utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || !body.refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing refreshToken'
    })
  }

  const db = useDB(event)
  const secret = getJwtSecret(event)
  const refreshToken = body.refreshToken

  // Verify signature
  const claims = await verifyJwtToken(refreshToken, secret)
  if (!claims || !claims.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid Refresh Token'
    })
  }

  const userId = claims.sub

  // Verify hash in D1 database
  const tokenHash = crypto.subtle 
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(refreshToken))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
    : `mock_hash_${Date.now()}`

  const tokenRow = await db.prepare(`
    SELECT * FROM refresh_tokens 
    WHERE token_hash = ? AND user_id = ? AND revoked = 0 AND expires_at > datetime('now')
  `).bind(tokenHash, userId).first()

  if (!tokenRow) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Revoked or Expired Refresh Token'
    })
  }

  // Load user data
  const userRow = await db.prepare(`
    SELECT id, display_name, avatar_url, subscription_tier, emergency_fund_amount, onboarding_complete 
    FROM users WHERE id = ?
  `).bind(userId).first()

  if (!userRow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User Not Found'
    })
  }

  const tier = userRow.subscription_tier
  const nextAccessToken = await signAccessToken(userId, tier, secret)
  const nextRefreshToken = await signRefreshToken(userId, secret)

  // Rotate refresh tokens
  await db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?`).bind(tokenHash).run()

  const nextTokenHash = crypto.subtle 
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nextRefreshToken))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
    : `mock_hash_${Date.now()}`

  await db.prepare(`
    INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+30 day'))
  `).bind(nextTokenHash, userId).run()

  const user = {
    id: userRow.id,
    displayName: userRow.display_name,
    avatarUrl: userRow.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userRow.display_name}`,
    subscriptionTier: userRow.subscription_tier,
    emergencyFundAmount: userRow.emergency_fund_amount || 0.00,
    onboardingComplete: !!userRow.onboarding_complete
  }

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    user
  }
})
