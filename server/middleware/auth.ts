import { defineEventHandler, createError } from 'h3'
import { verifyJwtToken } from '../utils/jwt'
import { getJwtSecret } from '../utils/db'

export default defineEventHandler(async (event) => {
  const path = event.path
  
  // Only protect routes under /api/v1/
  if (!path.startsWith('/api/v1/')) {
    return
  }

  // Exempt auth public pathways
  const publicPaths = [
    '/api/v1/auth/google',
    '/api/v1/auth/guest',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/score/public'
  ]

  // Exact path or path with query parameters checks
  const parsedUrl = new URL(path, 'http://localhost')
  const cleanPath = parsedUrl.pathname
  
  if (publicPaths.some(p => cleanPath === p)) {
    return
  }

  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Missing Authorization Header'
    })
  }

  const token = authHeader.substring(7)
  const secret = getJwtSecret(event)
  const claims = await verifyJwtToken(token, secret)

  if (!claims || !claims.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid Token signature or expired'
    })
  }

  // Store user context
  event.context.auth = {
    userId: claims.sub,
    tier: claims.tier || 'free'
  }
})
