import { defineEventHandler, readBody, createError } from 'h3'
import { useDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const db = useDB(event)
  const userId = auth.userId

  await db.prepare(`
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      avatar_url = COALESCE(?, avatar_url),
      emergency_fund_amount = COALESCE(?, emergency_fund_amount)
    WHERE id = ?
  `).bind(
    body.displayName ? body.displayName.trim() : null,
    body.avatarUrl || null,
    body.emergencyFundAmount !== undefined ? parseFloat(body.emergencyFundAmount) : null,
    userId
  ).run()

  const updatedUser = await db.prepare(`
    SELECT id, display_name, avatar_url, subscription_tier, emergency_fund_amount, onboarding_complete 
    FROM users WHERE id = ?
  `).bind(userId).first()

  return {
    id: updatedUser.id,
    displayName: updatedUser.display_name,
    avatarUrl: updatedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${updatedUser.display_name}`,
    subscriptionTier: updatedUser.subscription_tier,
    emergencyFundAmount: updatedUser.emergency_fund_amount,
    onboardingComplete: !!updatedUser.onboarding_complete
  }
})
