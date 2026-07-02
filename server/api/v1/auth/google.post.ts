import { defineEventHandler, readBody, createError } from 'h3'
import { useDB, getJwtSecret } from '../../../utils/db'
import { signAccessToken, signRefreshToken } from '../../../utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || !body.id_token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing id_token'
    })
  }

  const db = useDB(event)
  const secret = getJwtSecret(event)
  const token = body.id_token

  let userId = ''
  let displayName = ''
  let tier = 'free'
  let onboarding = 1

  if (token.startsWith('mock_token_')) {
    const persona = token.replace('mock_token_', '')
    userId = `usr_google_${persona}`
    displayName = persona === 'nune' ? 'Nune' : persona === 'boss' ? 'Boss' : persona
    tier = persona === 'boss' ? 'premium' : 'free'
  } else {
    // Standard Google token parsing logic mock/fallback for demo
    userId = `usr_google_${crypto.randomUUID().substring(0, 8)}`
    displayName = 'กูเกิลยูสเซอร์'
    tier = 'free'
    onboarding = 0
  }

  // Upsert user into D1
  await db.prepare(`
    INSERT INTO users (id, google_id, display_name, subscription_tier, onboarding_complete)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      subscription_tier = excluded.subscription_tier
  `).bind(userId, `google_gid_${userId}`, displayName, tier, onboarding).run()

  // Fetch current state of emergency fund if existing
  const row = await db.prepare(`SELECT emergency_fund_amount, onboarding_complete FROM users WHERE id = ?`).bind(userId).first()
  const fund = row ? row.emergency_fund_amount : 0.00
  const finalOnboarding = row ? !!row.onboarding_complete : !!onboarding

  const accessToken = await signAccessToken(userId, tier, secret)
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
    displayName,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`,
    subscriptionTier: tier,
    emergencyFundAmount: fund,
    onboardingComplete: finalOnboarding
  }

  return {
    accessToken,
    refreshToken,
    user
  }
})
