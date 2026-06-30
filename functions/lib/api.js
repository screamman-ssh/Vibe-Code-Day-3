import {
  uuid, bangkokToday, bangkokMonth, bangkokYesterday, bangkokDayStartIso,
  jsonResponse, errorResponse, inviteCode, VALID_CATEGORIES, DEFAULT_BUDGET_CATEGORIES,
  mapUser, mapGroup, mapTransaction,
} from './utils.js'
import { signJwt, verifyJwt, randomToken } from './jwt.js'
import { calculateScore } from './score.js'

const DEMO_INVITE = 'DEMO01'

function getSecret(env) {
  return env.JWT_SECRET || 'dev_secret_key_1234567890_change_me_please'
}

async function getUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
}

async function getUserByGoogleId(db, googleId) {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first()
}

async function getGroupByUserId(db, userId) {
  const row = await db.prepare(`
    SELECT g.* FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
  `).bind(userId).first()
  return row
}

async function getLatestScore(db, userId) {
  return db.prepare(`
    SELECT * FROM score_snapshots
    WHERE user_id = ?
    ORDER BY calculated_at DESC
    LIMIT 1
  `).bind(userId).first()
}

async function getUserBadges(db, userId) {
  const { results } = await db.prepare(`
    SELECT b.name FROM user_badges ub
    JOIN badges b ON b.code = ub.badge_code
    WHERE ub.user_id = ?
  `).bind(userId).all()
  return (results || []).map((r) => r.name)
}

async function getTransactions(db, userId) {
  const { results } = await db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC
  `).bind(userId).all()
  return results || []
}

async function getBudgetCategories(db, userId, month) {
  let budget = await db.prepare(
    'SELECT * FROM budgets WHERE user_id = ? AND month = ?'
  ).bind(userId, month).first()

  if (!budget) {
    const budgetId = uuid()
    await db.prepare(
      'INSERT INTO budgets (id, user_id, month) VALUES (?, ?, ?)'
    ).bind(budgetId, userId, month).run()
    budget = { id: budgetId }
  }

  const { results: limits } = await db.prepare(
    'SELECT * FROM budget_categories WHERE budget_id = ?'
  ).bind(budget.id).all()

  const limitMap = {}
  for (const l of limits || []) limitMap[l.category] = l.limit_amount

  const txs = await getTransactions(db, userId)
  const spentMap = {}
  for (const t of txs) {
    if (t.type === 'expense' && t.date.startsWith(month)) {
      spentMap[t.category] = (spentMap[t.category] || 0) + t.amount
    }
  }

  return DEFAULT_BUDGET_CATEGORIES.map((category) => ({
    category,
    limitAmount: limitMap[category] || 0,
    spentAmount: spentMap[category] || 0,
  }))
}

async function getDebtsWithStreak(db, userId) {
  const { results: debts } = await db.prepare(
    'SELECT * FROM debts WHERE user_id = ?'
  ).bind(userId).all()

  const enriched = []
  for (const d of debts || []) {
    const { results: payments } = await db.prepare(`
      SELECT on_time FROM debt_payments WHERE debt_id = ? ORDER BY paid_at DESC LIMIT 10
    `).bind(d.id).all()
    let streak = 0
    for (const p of payments || []) {
      if (p.on_time) streak++
      else break
    }
    enriched.push({ ...d, onTimeStreak: streak })
  }
  return enriched
}

async function emitScoreChanged(db, user, groupId, prevScore, newScore, tier) {
  if (!groupId || !user) return
  await db.prepare(`
    INSERT INTO feed_events (id, group_id, user_id, display_name, event_type, payload_json)
    VALUES (?, ?, ?, ?, 'score_changed', ?)
  `).bind(
    uuid(),
    groupId,
    user.id,
    user.display_name,
    JSON.stringify({ previous_score: prevScore, new_score: newScore, tier })
  ).run()
}

async function recalculateScore(db, userId) {
  const user = await getUserById(db, userId)
  if (!user) return null

  const month = bangkokMonth()
  const budgetCats = await getBudgetCategories(db, userId, month)
  const txs = await getTransactions(db, userId)
  const debts = await getDebtsWithStreak(db, userId)

  const prevSnap = await getLatestScore(db, userId)
  const prevScore = prevSnap?.total_score ?? 50

  const result = calculateScore({
    transactions: txs.map(mapTransaction),
    budgetCategories: budgetCats,
    debts,
    emergencyFundAmount: user.emergency_fund_amount ?? 0,
    loggingStreakDays: user.logging_streak_days ?? 0,
    month,
  })

  await db.prepare(`
    INSERT INTO score_snapshots (id, user_id, total_score, tier, tier_th, dimensions_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    uuid(),
    userId,
    result.totalScore,
    result.tier,
    result.tierTh,
    JSON.stringify(result.dimensions)
  ).run()

  if (!prevSnap || Math.abs(result.totalScore - prevScore) >= 1) {
    const group = await getGroupByUserId(db, userId)
    if (group) {
      await emitScoreChanged(db, user, group.id, prevScore, result.totalScore, result.tier)
    }
  }

  return result
}

async function updateStreak(db, userId) {
  const user = await getUserById(db, userId)
  if (!user) return

  const today = bangkokToday()
  if (user.last_log_date === today) return

  const yesterday = bangkokYesterday()
  let streak = user.logging_streak_days ?? 0
  if (user.last_log_date === yesterday) streak += 1
  else streak = 1

  await db.prepare(`
    UPDATE users SET logging_streak_days = ?, last_log_date = ? WHERE id = ?
  `).bind(streak, today, userId).run()
}

async function ensureDemoGroup(db, user) {
  if (!user?.google_id?.includes('boss')) return

  let group = await db.prepare(
    'SELECT * FROM groups WHERE invite_code = ?'
  ).bind(DEMO_INVITE).first()

  if (!group) {
    const groupId = uuid()
    await db.prepare(`
      INSERT INTO groups (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)
    `).bind(groupId, 'Demo Circle', DEMO_INVITE, user.id).run()
    group = { id: groupId }
  } else if (group.owner_id !== user.id) {
    await db.prepare('UPDATE groups SET owner_id = ? WHERE id = ?')
      .bind(user.id, group.id).run()
  }

  const member = await db.prepare(
    'SELECT 1 FROM group_members WHERE user_id = ?'
  ).bind(user.id).first()

  if (!member) {
    await db.prepare(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)'
    ).bind(group.id, user.id).run()
  }

  if (!user.onboarding_complete) {
    await db.prepare(
      'UPDATE users SET onboarding_complete = 1 WHERE id = ?'
    ).bind(user.id).run()
  }
}

function verifyGoogleToken(idToken) {
  if (idToken.startsWith('mock_token_')) {
    const persona = idToken.slice('mock_token_'.length)
    const personas = {
      nune: {
        sub: 'google-user-nune',
        name: 'Nune',
        picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nune',
      },
      boss: {
        sub: 'google-user-boss',
        name: 'Boss',
        picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boss',
      },
    }
    const info = personas[persona] || {
      sub: `google-user-${persona}`,
      name: persona,
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${persona}`,
    }
    return info
  }
  throw new Error('Real Google OAuth not configured — use mock_token_* personas')
}

async function createTokenPair(db, env, userId, tier) {
  const secret = getSecret(env)
  const accessToken = await signJwt({ sub: userId, tier }, secret, 900)
  const refreshToken = randomToken()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await db.prepare(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(refreshToken, userId, expires).run()
  return { accessToken, refreshToken }
}

async function authResult(db, env, user) {
  const tokens = await createTokenPair(db, env, user.id, user.subscription_tier)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: mapUser(user),
  }
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const payload = await verifyJwt(auth.slice(7), getSecret(env))
    return payload.sub
  } catch {
    return null
  }
}

async function loginGoogle(db, env, body) {
  const info = verifyGoogleToken(body.id_token || '')
  let user = await getUserByGoogleId(db, info.sub)
  const isNew = !user

  if (!user) {
    const id = uuid()
    await db.prepare(`
      INSERT INTO users (id, google_id, display_name, avatar_url)
      VALUES (?, ?, ?, ?)
    `).bind(id, info.sub, info.name, info.picture).run()
    user = await getUserById(db, id)
  }

  if (isNew) await recalculateScore(db, user.id)
  await ensureDemoGroup(db, user)
  user = await getUserById(db, user.id)
  return authResult(db, env, user)
}

async function loginGuest(db, env, body) {
  const id = uuid()
  const name = body.displayName || 'ผู้ใช้ใหม่'
  await db.prepare(`
    INSERT INTO users (id, google_id, display_name, avatar_url)
    VALUES (?, ?, ?, ?)
  `).bind(id, `guest-${id}`, name, `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`).run()

  const user = await getUserById(db, id)
  await recalculateScore(db, id)
  return authResult(db, env, user)
}

async function refreshSession(db, env, body) {
  const row = await db.prepare(
    'SELECT * FROM refresh_tokens WHERE token = ?'
  ).bind(body.refreshToken || '').first()

  if (!row) throw new Error('invalid refresh token')
  if (new Date(row.expires_at) < new Date()) {
    await db.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(row.token).run()
    throw new Error('refresh token expired')
  }

  const user = await getUserById(db, row.user_id)
  if (!user) throw new Error('user not found')
  return authResult(db, env, user)
}

async function createGroup(db, userId, name) {
  const existing = await getGroupByUserId(db, userId)
  if (existing) throw new Error('ALREADY_IN_GROUP')

  const groupId = uuid()
  const code = inviteCode()
  await db.prepare(`
    INSERT INTO groups (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)
  `).bind(groupId, name || 'กลุ่มของฉัน', code, userId).run()
  await db.prepare(
    'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)'
  ).bind(groupId, userId).run()
  await db.prepare(
    'UPDATE users SET onboarding_complete = 1 WHERE id = ?'
  ).bind(userId).run()

  return mapGroup(await db.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first())
}

async function joinGroup(db, userId, inviteCodeInput) {
  const existing = await getGroupByUserId(db, userId)
  if (existing) throw new Error('ALREADY_IN_GROUP')

  const code = (inviteCodeInput || '').toUpperCase()
  const group = await db.prepare(
    'SELECT * FROM groups WHERE invite_code = ?'
  ).bind(code).first()
  if (!group) throw new Error('INVALID_INVITE_CODE')

  const count = await db.prepare(
    'SELECT COUNT(*) as c FROM group_members WHERE group_id = ?'
  ).bind(group.id).first()
  if ((count?.c || 0) >= group.max_members) throw new Error('GROUP_FULL')

  await db.prepare(
    'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)'
  ).bind(group.id, userId).run()
  await db.prepare(
    'UPDATE users SET onboarding_complete = 1 WHERE id = ?'
  ).bind(userId).run()

  return mapGroup(group)
}

async function getLeaderboard(db, userId, groupId) {
  const member = await db.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first()
  if (!member) throw new Error('UNAUTHORIZED_NOT_MEMBER')

  const { results: members } = await db.prepare(`
    SELECT u.*, gm.hide_rank FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).bind(groupId).all()

  const list = []
  for (const u of members || []) {
    const snap = await getLatestScore(db, u.id)
    const badges = await getUserBadges(db, u.id)
    list.push({
      displayName: u.display_name,
      avatarUrl: u.avatar_url || undefined,
      score: snap?.total_score ?? 50,
      tier: snap?.tier ?? 'Building',
      tierTh: snap?.tier_th ?? 'กำลังสร้าง',
      badges,
      streakDays: u.logging_streak_days ?? 0,
      hideRank: !!u.hide_rank,
      _sortScore: snap?.total_score ?? 50,
    })
  }

  list.sort((a, b) => b._sortScore - a._sortScore)
  return list.map((m, i) => {
    const { _sortScore, ...rest } = m
    return {
      ...rest,
      rank: m.hideRank ? undefined : i + 1,
    }
  })
}

async function getFeed(db, userId, groupId) {
  const member = await db.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, userId).first()
  if (!member) throw new Error('UNAUTHORIZED_NOT_MEMBER')

  const { results: events } = await db.prepare(`
    SELECT * FROM feed_events WHERE group_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).bind(groupId).all()

  const { results: reactions } = await db.prepare(`
    SELECT fr.* FROM feed_reactions fr
    JOIN feed_events fe ON fe.id = fr.event_id
    WHERE fe.group_id = ?
  `).bind(groupId).all()

  const reactMap = {}
  for (const r of reactions || []) {
    if (!reactMap[r.event_id]) reactMap[r.event_id] = {}
    reactMap[r.event_id][r.reaction] = (reactMap[r.event_id][r.reaction] || 0) + 1
  }

  return (events || []).map((e) => ({
    id: e.id,
    userId: e.user_id,
    displayName: e.display_name,
    eventType: e.event_type,
    payload: JSON.parse(e.payload_json || '{}'),
    createdAt: e.created_at,
    reactions: reactMap[e.id] || {},
  }))
}

async function getUsage(db, userId) {
  const user = await getUserById(db, userId)
  const dayStart = bangkokDayStartIso()
  const count = await db.prepare(`
    SELECT COUNT(*) as c FROM llm_usage_logs
    WHERE user_id = ? AND feature_type = 'ocr' AND created_at >= ?
  `).bind(userId, dayStart).first()

  const isPremium = user.subscription_tier === 'premium'
  return {
    ocrUsedToday: count?.c || 0,
    ocrLimit: isPremium ? 999 : 5,
    tier: user.subscription_tier,
    premiumFeaturesLocked: !isPremium,
  }
}

const COACH_MOCK =
  'คำแนะนำจากโค้ช AI สำหรับวันนี้:\n' +
  '1. ยอดเยี่ยมมากที่คุณสามารถคุมรายจ่ายในหมวดอาหารไม่ให้เกินงบประหยัดที่ตั้งไว้ได้ แนะนำให้รักษาวินัยแบบนี้ต่อไป\n' +
  '2. อัตราการออมเงินในเดือนนี้อยู่ที่ 8% ซึ่งถือว่าเป็นจุดเริ่มต้นที่ดี แต่หากปรับลดค่าหมวดบันเทิงลงอีกนิด จะช่วยยกระดับให้ถึงเป้าหมาย 10% ได้ง่ายขึ้น\n' +
  '3. สุขภาพหนี้ของคุณมีความก้าวหน้าที่น่าสนใจ แนะนำให้พิจารณาใช้สูตรชำระหนี้แบบ Snowball เพื่อลดดอกเบี้ยสะสมโดยรวมของหนี้บัตรเครดิตที่มี APR สูงสุด\n\n' +
  '*หมายเหตุ: ข้อแนะนำนี้เป็นข้อมูลเพื่อการศึกษาทางการเงินเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*'

const ANALYZE_MOCK =
  'รายงานวิเคราะห์สุขภาพทางการเงิน:\n\n' +
  '**ภาพรวม:** คะแนนสุขภาพทางการเงินของคุณอยู่ในระดับที่พอใช้ มีจุดแข็งด้านความสม่ำเสมอในการบันทึกรายการ\n\n' +
  '**จุดแข็ง:** การคุมงบประมาณในหมวดอาหารและค่าเดินทางทำได้ดี\n\n' +
  '**จุดที่ควรปรับปรุง:** อัตราการออมยังต่ำกว่าเป้าหมาย 10% แนะนำให้ลดรายจ่ายที่ไม่จำเป็นในหมวดบันเทิง\n\n' +
  '*ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*'

export async function handleApiRequest(request, env, path) {
  const db = env.DB
  if (!db) return errorResponse('Database not configured', 500)

  const method = request.method
  const segments = (path || '').split('/').filter(Boolean)
  const route = segments.join('/')

  // Public auth routes
  if (method === 'POST' && route === 'auth/google') {
    const body = await request.json()
    try {
      return jsonResponse(await loginGoogle(db, env, body))
    } catch (e) {
      return errorResponse(e.message, 401)
    }
  }

  if (method === 'POST' && route === 'auth/guest') {
    const body = await request.json()
    return jsonResponse(await loginGuest(db, env, body))
  }

  if (method === 'POST' && route === 'auth/refresh') {
    const body = await request.json()
    try {
      return jsonResponse(await refreshSession(db, env, body))
    } catch {
      return errorResponse('invalid or expired refresh token', 401)
    }
  }

  if (method === 'POST' && route === 'auth/logout') {
    const body = await request.json().catch(() => ({}))
    if (body.refreshToken) {
      await db.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(body.refreshToken).run()
    }
    return jsonResponse({ message: 'Logged out' })
  }

  const userId = await requireAuth(request, env)
  if (!userId) return errorResponse('Unauthorized', 401)

  if (method === 'GET' && route === 'me') {
    const user = await getUserById(db, userId)
    return user ? jsonResponse(mapUser(user)) : errorResponse('User not found', 404)
  }

  if (method === 'PUT' && route === 'me') {
    const body = await request.json()
    const user = await getUserById(db, userId)
    if (!user) return errorResponse('User not found', 404)

    if (body.displayName) user.display_name = body.displayName
    if (body.avatarUrl) user.avatar_url = body.avatarUrl
    if (typeof body.emergencyFundAmount === 'number' && body.emergencyFundAmount >= 0) {
      user.emergency_fund_amount = body.emergencyFundAmount
    }
    if (body.subscriptionTier) user.subscription_tier = body.subscriptionTier
    if (body.onboardingComplete) user.onboarding_complete = 1

    await db.prepare(`
      UPDATE users SET display_name = ?, avatar_url = ?, emergency_fund_amount = ?,
        subscription_tier = ?, onboarding_complete = ? WHERE id = ?
    `).bind(
      user.display_name, user.avatar_url, user.emergency_fund_amount,
      user.subscription_tier, user.onboarding_complete ? 1 : 0, userId
    ).run()

    await recalculateScore(db, userId)
    return jsonResponse(mapUser(await getUserById(db, userId)))
  }

  if (method === 'POST' && route === 'auth/onboarding') {
    const body = await request.json()
    if (body.action === 'create') {
      await createGroup(db, userId, body.groupName)
    } else if (body.action === 'join') {
      try {
        await joinGroup(db, userId, body.inviteCode)
      } catch (e) {
        return errorResponse(e.message, 400)
      }
    } else {
      await db.prepare('UPDATE users SET onboarding_complete = 1 WHERE id = ?').bind(userId).run()
    }
    const user = await getUserById(db, userId)
    return jsonResponse(mapUser(user))
  }

  if (method === 'GET' && route === 'groups/me') {
    const group = await getGroupByUserId(db, userId)
    return jsonResponse(group ? mapGroup(group) : null)
  }

  if (method === 'GET' && route === 'transactions') {
    const txs = await getTransactions(db, userId)
    return jsonResponse(txs.map(mapTransaction))
  }

  if (method === 'POST' && route === 'transactions') {
    const body = await request.json()
    if (!body.type || !VALID_CATEGORIES.has(body.category) || !body.amount || body.amount <= 0) {
      return errorResponse('Invalid transaction', 400)
    }
    const txId = uuid()
    const source = body.source || 'manual'
    await db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, category, merchant, note, date, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId, userId, body.type, body.amount, body.category,
      body.merchant || null, body.note || null, body.date, source
    ).run()
    await updateStreak(db, userId)
    const score = await recalculateScore(db, userId)
    const tx = await db.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first()
    return jsonResponse({ transaction: mapTransaction(tx), score })
  }

  const txMatch = route.match(/^transactions\/([^/]+)$/)
  if (txMatch) {
    const txId = txMatch[1]
    const existing = await db.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first()
    if (!existing || existing.user_id !== userId) return errorResponse('Not found', 404)

    if (method === 'PUT') {
      const body = await request.json()
      await db.prepare(`
        UPDATE transactions SET type = ?, amount = ?, category = ?, merchant = ?, note = ?, date = ?, source = ?
        WHERE id = ?
      `).bind(
        body.type, body.amount, body.category, body.merchant || null,
        body.note || null, body.date, body.source || existing.source, txId
      ).run()
      const score = await recalculateScore(db, userId)
      const tx = await db.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first()
      return jsonResponse({ transaction: mapTransaction(tx), score })
    }

    if (method === 'DELETE') {
      await db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').bind(txId, userId).run()
      const score = await recalculateScore(db, userId)
      return jsonResponse({ score })
    }
  }

  if (method === 'GET' && route === 'budgets/current') {
    const cats = await getBudgetCategories(db, userId, bangkokMonth())
    return jsonResponse(cats)
  }

  if (method === 'PUT' && route === 'budgets/current') {
    const items = await request.json()
    const month = bangkokMonth()
    let budget = await db.prepare(
      'SELECT * FROM budgets WHERE user_id = ? AND month = ?'
    ).bind(userId, month).first()

    if (!budget) {
      const budgetId = uuid()
      await db.prepare('INSERT INTO budgets (id, user_id, month) VALUES (?, ?, ?)')
        .bind(budgetId, userId, month).run()
      budget = { id: budgetId }
    }

    await db.prepare('DELETE FROM budget_categories WHERE budget_id = ?').bind(budget.id).run()
    for (const item of items) {
      await db.prepare(`
        INSERT INTO budget_categories (id, budget_id, category, limit_amount) VALUES (?, ?, ?, ?)
      `).bind(uuid(), budget.id, item.category, item.limitAmount || 0).run()
    }

    const score = await recalculateScore(db, userId)
    const budgetList = await getBudgetCategories(db, userId, month)
    return jsonResponse({ budget: budgetList, score })
  }

  if (method === 'GET' && route === 'score') {
    const score = await recalculateScore(db, userId)
    return score ? jsonResponse(score) : errorResponse('No score', 404)
  }

  if (method === 'GET' && route === 'score/public') {
    const score = await recalculateScore(db, userId)
    const user = await getUserById(db, userId)
    const badges = await getUserBadges(db, userId)
    return jsonResponse({
      score: score.totalScore,
      tier: score.tier,
      tierTh: score.tierTh,
      badges,
      streakDays: user.logging_streak_days ?? 0,
    })
  }

  if (method === 'GET' && route === 'usage') {
    return jsonResponse(await getUsage(db, userId))
  }

  const lbMatch = route.match(/^groups\/([^/]+)\/leaderboard$/)
  if (method === 'GET' && lbMatch) {
    try {
      return jsonResponse(await getLeaderboard(db, userId, lbMatch[1]))
    } catch {
      return errorResponse('Forbidden', 403)
    }
  }

  const feedMatch = route.match(/^groups\/([^/]+)\/feed$/)
  if (method === 'GET' && feedMatch) {
    try {
      return jsonResponse(await getFeed(db, userId, feedMatch[1]))
    } catch {
      return errorResponse('Forbidden', 403)
    }
  }

  const reactMatch = route.match(/^groups\/([^/]+)\/feed\/([^/]+)\/react$/)
  if (method === 'POST' && reactMatch) {
    const body = await request.json()
    if (!body.reaction) return errorResponse('Invalid reaction', 400)
    await db.prepare(`
      INSERT OR IGNORE INTO feed_reactions (event_id, user_id, reaction) VALUES (?, ?, ?)
    `).bind(reactMatch[2], userId, body.reaction).run()
    return jsonResponse({ message: 'Reaction added' })
  }

  if (method === 'POST' && route === 'llm/ocr') {
    const user = await getUserById(db, userId)
    const usage = await getUsage(db, userId)
    if (usage.ocrUsedToday >= usage.ocrLimit) {
      return jsonResponse({ error: 'OCR quota exceeded', code: 'QUOTA_EXCEEDED' }, 402)
    }

    const form = await request.formData()
    if (!form.get('image')) return errorResponse('Missing image file', 400)

    await db.prepare(`
      INSERT INTO llm_usage_logs (id, user_id, feature_type, tokens_estimated, request_id)
      VALUES (?, ?, 'ocr', 500, ?)
    `).bind(uuid(), userId, `ocr-${Date.now()}`).run()

    return jsonResponse({
      merchant: '7-Eleven',
      amount: 89,
      date: bangkokToday(),
      category: 'Food',
      confidence: 0.95,
    })
  }

  if (method === 'POST' && route === 'llm/coach') {
    const user = await getUserById(db, userId)
    if (user.subscription_tier !== 'premium') {
      return errorResponse('Premium subscription required', 403)
    }
    const score = await recalculateScore(db, userId)
    await db.prepare(`
      INSERT INTO llm_usage_logs (id, user_id, feature_type, tokens_estimated, request_id)
      VALUES (?, ?, 'coach', 300, ?)
    `).bind(uuid(), userId, `coach-${Date.now()}`).run()
    return jsonResponse({ response: COACH_MOCK })
  }

  if (method === 'POST' && route === 'llm/analyze') {
    const user = await getUserById(db, userId)
    if (user.subscription_tier !== 'premium') {
      return errorResponse('Premium subscription required', 403)
    }
    await db.prepare(`
      INSERT INTO llm_usage_logs (id, user_id, feature_type, tokens_estimated, request_id)
      VALUES (?, ?, 'analyze', 400, ?)
    `).bind(uuid(), userId, `analyze-${Date.now()}`).run()
    return jsonResponse({ response: ANALYZE_MOCK })
  }

  return errorResponse('Not found', 404)
}
