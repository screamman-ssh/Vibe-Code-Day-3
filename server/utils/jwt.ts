import * as jose from 'jose'

export async function signAccessToken(userId: string, tier: string, secretStr: string) {
  const secret = new TextEncoder().encode(secretStr || 'change-me-in-production-use-wrangler-secret')
  return await new jose.SignJWT({ sub: userId, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

export async function signRefreshToken(userId: string, secretStr: string) {
  const secret = new TextEncoder().encode(secretStr || 'change-me-in-production-use-wrangler-secret')
  return await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyJwtToken(token: string, secretStr: string) {
  const secret = new TextEncoder().encode(secretStr || 'change-me-in-production-use-wrangler-secret')
  try {
    const { payload } = await jose.jwtVerify(token, secret)
    return payload
  } catch (err) {
    return null
  }
}
