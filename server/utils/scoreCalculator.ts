import { appendGroupFeedEvent } from './groupFeed'

interface BadgeCriteria {
  code: string
  check: (ctx: {
    streakDays: number
    transactionCount: number
    budgetScore: number
    emergencyFundScore: number
  }) => boolean
}

const BADGE_CRITERIA: BadgeCriteria[] = [
  {
    code: 'FIRST_LOG',
    check: ({ transactionCount }) => transactionCount >= 1
  },
  {
    code: 'WEEK_WARRIOR',
    check: ({ streakDays }) => streakDays >= 7
  },
  {
    code: 'BUDGET_BOSS',
    check: ({ budgetScore }) => budgetScore >= 80
  },
  {
    code: 'EMERGENCY_READY',
    check: ({ emergencyFundScore }) => emergencyFundScore >= 85
  }
]

async function awardEligibleBadges(
  db: any,
  userId: string,
  ctx: {
    streakDays: number
    transactionCount: number
    budgetScore: number
    emergencyFundScore: number
  }
) {
  const { results: existingRows } = await db.prepare(`
    SELECT badge_code as code FROM user_badges WHERE user_id = ?
  `).bind(userId).all()

  const existing = new Set((existingRows || []).map((r: any) => r.code))
  const newlyEarned: { badge_code: string; badge_name: string }[] = []

  for (const { code, check } of BADGE_CRITERIA) {
    if (existing.has(code) || !check(ctx)) continue

    await db.prepare(`
      INSERT OR IGNORE INTO user_badges (user_id, badge_code)
      VALUES (?, ?)
    `).bind(userId, code).run()

    const badgeRow = await db.prepare(`
      SELECT name FROM badges WHERE code = ?
    `).bind(code).first()

    if (badgeRow?.name) {
      newlyEarned.push({ badge_code: code, badge_name: badgeRow.name })
    }
  }

  return newlyEarned
}

export async function calculateUserScore(db: any, userId: string) {
  const previousScoreRow = await db.prepare(`
    SELECT total_score as score, tier, tier_th as tierTh
    FROM score_snapshots
    WHERE user_id = ?
    ORDER BY calculated_at DESC LIMIT 1
  `).bind(userId).first()

  const previousScore = previousScoreRow ? previousScoreRow.score : null

  const user = await db.prepare(`
    SELECT logging_streak_days as streakDays, emergency_fund_amount as emergencyFund, avg_monthly_expenses as avgExpenses
    FROM users WHERE id = ?
  `).bind(userId).first()

  const streakDays = user ? user.streakDays : 0
  const emergencyFund = user ? user.emergencyFund : 0
  const avgExpenses = user ? user.avgExpenses : 0

  const txCountRow = await db.prepare(`
    SELECT COUNT(*) as c FROM transactions WHERE user_id = ?
  `).bind(userId).first()
  const transactionCount = txCountRow ? txCountRow.c : 0

  const loggingScore = Math.min(100, streakDays * 10)

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { results: budgets } = await db.prepare(`
    SELECT category, limit_amount as limitAmount
    FROM budgets WHERE user_id = ? AND year_month = ?
  `).bind(userId, yearMonth).all()

  let budgetScore = 50
  if (budgets && budgets.length > 0) {
    let totalScore = 0
    for (const b of budgets) {
      const spentRow = await db.prepare(`
        SELECT SUM(amount) as spent
        FROM transactions
        WHERE user_id = ? AND type = 'expense' AND category = ? AND date LIKE ?
      `).bind(userId, b.category, `${yearMonth}%`).first()

      const spent = spentRow && spentRow.spent ? spentRow.spent : 0
      const ratio = b.limitAmount > 0 ? spent / b.limitAmount : 0
      if (ratio <= 1) totalScore += 100
      else if (ratio <= 1.2) totalScore += 70
      else totalScore += 30
    }
    budgetScore = Math.round(totalScore / budgets.length)
  }

  let emergencyFundScore = 0
  if (avgExpenses > 0) {
    const monthsCovered = emergencyFund / avgExpenses
    emergencyFundScore = Math.min(100, Math.round((monthsCovered / 3) * 100))
  }

  const debtRow = await db.prepare(`
    SELECT SUM(balance) as totalDebt FROM debts WHERE user_id = ?
  `).bind(userId).first()
  const totalDebt = debtRow && debtRow.totalDebt ? debtRow.totalDebt : 0

  let debtScore = 100
  if (totalDebt > 0 && avgExpenses > 0) {
    const debtToIncomeRatio = totalDebt / (avgExpenses * 12)
    if (debtToIncomeRatio > 5) debtScore = 20
    else if (debtToIncomeRatio > 2) debtScore = 50
    else debtScore = 80
  }

  const totalScore = Math.round(
    loggingScore * 0.3 +
    budgetScore * 0.3 +
    emergencyFundScore * 0.2 +
    debtScore * 0.2
  )

  let tier = 'Building'
  let tierTh = 'กำลังสร้าง'
  if (totalScore >= 80) {
    tier = 'Thriving'
    tierTh = 'เติบโต'
  } else if (totalScore >= 60) {
    tier = 'Steady'
    tierTh = 'มั่นคง'
  }

  const details = {
    logging: loggingScore,
    budget: budgetScore,
    emergencyFund: emergencyFundScore,
    debt: debtScore
  }

  const snapshotId = `snp_${crypto.randomUUID().replace(/-/g, '')}`
  await db.prepare(`
    INSERT INTO score_snapshots (id, user_id, total_score, tier, tier_th, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(snapshotId, userId, totalScore, tier, tierTh, JSON.stringify(details)).run()

  if (previousScore !== null && previousScore !== totalScore) {
    await appendGroupFeedEvent(db, {
      userId,
      eventType: 'score_changed',
      payload: {
        previous_score: previousScore,
        new_score: totalScore,
        tier
      }
    })
  }

  const newBadges = await awardEligibleBadges(db, userId, {
    streakDays,
    transactionCount,
    budgetScore,
    emergencyFundScore
  })

  for (const badge of newBadges) {
    await appendGroupFeedEvent(db, {
      userId,
      eventType: 'badge_earned',
      payload: badge
    })
  }

  return {
    totalScore,
    tier,
    tierTh,
    streakDays,
    dimensions: details,
    newBadges
  }
}
