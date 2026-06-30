export function uuid() {
  return crypto.randomUUID()
}

export function bangkokToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function bangkokMonth() {
  const parts = bangkokToday().split('-')
  return `${parts[0]}-${parts[1]}`
}

export function bangkokYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function bangkokDayStartIso() {
  const today = bangkokToday()
  return `${today}T00:00:00+07:00`
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  })
}

export function errorResponse(message, status = 400, code) {
  const body = { error: message }
  if (code) body.code = code
  return jsonResponse(body, status)
}

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function handleOptions(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  return null
}

export function inviteCode() {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}

export const VALID_CATEGORIES = new Set([
  'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
  'Health', 'Education', 'Debt Payment', 'Savings', 'Income', 'Other',
])

export const DEFAULT_BUDGET_CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
  'Health', 'Education', 'Debt Payment', 'Savings', 'Other',
]

export function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || undefined,
    subscriptionTier: row.subscription_tier,
    emergencyFundAmount: row.emergency_fund_amount ?? 0,
    loggingStreakDays: row.logging_streak_days ?? 0,
    onboardingComplete: !!row.onboarding_complete,
  }
}

export function mapGroup(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    ownerId: row.owner_id,
  }
}

export function mapTransaction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    category: row.category,
    merchant: row.merchant || undefined,
    note: row.note || undefined,
    date: row.date,
    source: row.source,
  }
}
