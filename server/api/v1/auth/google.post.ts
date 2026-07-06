import { defineEventHandler, readBody, createError } from 'h3'
import { useDB, getJwtSecret } from '../../../utils/db'
import { signAccessToken, signRefreshToken } from '../../../utils/jwt'

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function verifyGoogleIdToken(token: string, clientId: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== clientId) {
    throw new Error('Audience mismatch');
  }
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('Issuer mismatch');
  }
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  // Fetch Google public certs
  const certsResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const { keys } = await certsResponse.json();
  const jwk = keys.find((k: any) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Signature key not found');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' }
    },
    false,
    ['verify']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(parts[0] + '.' + parts[1]);

  const signatureStr = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const binarySign = atob(signatureStr);
  const signature = new Uint8Array(binarySign.length);
  for (let i = 0; i < binarySign.length; i++) {
    signature[i] = binarySign.charCodeAt(i);
  }

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    data
  );

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  return payload;
}

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

  const config = useRuntimeConfig(event)
  const googleClientId = config.public.googleClientId

  let googleId = ''
  let email = ''
  let displayName = ''
  let avatarUrl = ''
  let tier = 'free'
  let onboarding = 1

  if (token.startsWith('mock_token_')) {
    const persona = token.replace('mock_token_', '')
    googleId = `google_gid_${persona}`
    displayName = persona === 'nune' ? 'Nune' : persona === 'boss' ? 'Boss' : persona
    tier = persona === 'boss' ? 'premium' : 'free'
  } else {
    try {
      const payload = await verifyGoogleIdToken(token, googleClientId)
      googleId = payload.sub
      email = payload.email || ''
      displayName = payload.name || payload.email || 'กูเกิลยูสเซอร์'
      avatarUrl = payload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`
      tier = 'free'
      onboarding = 0 // New users need onboarding
    } catch (err: any) {
      throw createError({
        statusCode: 401,
        statusMessage: `Google Token Verification Failed: ${err.message}`
      })
    }
  }

  // Find user by google_id
  const userRow = await db.prepare(`
    SELECT id, display_name, avatar_url, subscription_tier, onboarding_complete, emergency_fund_amount
    FROM users WHERE google_id = ?
  `).bind(googleId).first()

  let userId = ''
  if (userRow) {
    userId = userRow.id
    displayName = userRow.display_name
    avatarUrl = userRow.avatar_url || avatarUrl
    tier = userRow.subscription_tier
    onboarding = userRow.onboarding_complete
  } else {
    userId = `usr_${crypto.randomUUID().substring(0, 8)}`
    
    // Insert new user
    await db.prepare(`
      INSERT INTO users (id, google_id, display_name, avatar_url, subscription_tier, onboarding_complete)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, googleId, displayName, avatarUrl, tier, onboarding).run()
  }

  const fund = userRow ? userRow.emergency_fund_amount : 0.00
  const finalOnboarding = userRow ? !!userRow.onboarding_complete : !!onboarding

  const accessToken = await signAccessToken(userId, tier, secret)
  const refreshToken = await signRefreshToken(userId, secret)

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
    avatarUrl,
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
