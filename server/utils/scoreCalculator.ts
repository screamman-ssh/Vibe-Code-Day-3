import { useDB } from './db'

function currentMonthPrefix() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function calculateUserScore(event: any, userId: string) {
  const db = useDB(event)
  const month = currentMonthPrefix()

  // 1. Fetch User details
  const user = await db.prepare(`
    SELECT emergency_fund_amount, avg_monthly_expenses, logging_streak_days
    FROM users WHERE id = ?
  `).bind(userId).first()

  const streakDays = user ? user.logging_streak_days : 0
  const emergencyFundAmount = user ? user.emergency_fund_amount : 0
  const avgExpenses = user && user.avg_monthly_expenses ? user.avg_monthly_expenses : 30000 // default fallback

  // 2. Dimension: Budget Adherence (Weight: 25%)
  // Get all budgets and calculate spent amounts
  const { results: budgets } = await db.prepare(`
    SELECT 
      limit_amount,
      COALESCE((
        SELECT SUM(t.amount) 
        FROM transactions t 
        WHERE t.user_id = b.user_id 
          AND t.category = b.category 
          AND t.type = 'expense'
          AND t.date LIKE ?
      ), 0.0) as spent
    FROM budgets b
    WHERE b.user_id = ? AND b.year_month = ?
  `).bind(month + '%', userId, month).all()

  let budgetScore = 100
  if (budgets && budgets.length > 0) {
    let overBudgetCount = 0
    for (const b of budgets) {
      if (b.spent > b.limit_amount) {
        overBudgetCount++
      }
    }
    budgetScore = Math.max(100 - overBudgetCount * 15, 40)
  }

  // 3. Dimension: Savings Rate (Weight: 20%)
  const cashflow = await db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0.0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0.0) as expense
    FROM transactions
    WHERE user_id = ? AND date LIKE ?
  `).bind(userId, month + '%').first()

  const income = cashflow ? cashflow.income : 0
  const expense = cashflow ? cashflow.expense : 0
  let savingsRateScore = 60 // default neutral

  if (income > 0) {
    const net = income - expense
    const rate = net / income
    if (rate >= 0.20) savingsRateScore = 100
    else if (rate >= 0.10) savingsRateScore = 80
    else if (rate >= 0.0) savingsRateScore = 65
    else savingsRateScore = 30
  }

  // 4. Dimension: Debt Health (Weight: 25%)
  const { results: debts } = await db.prepare(`
    SELECT on_time_streak FROM debts WHERE user_id = ?
  `).bind(userId).all()

  let debtScore = 100
  if (debts && debts.length > 0) {
    const totalStreak = debts.reduce((sum, d) => sum + d.on_time_streak, 0)
    const avgStreak = totalStreak / debts.length
    debtScore = Math.min(Math.max(40 + Math.round(avgStreak * 8), 40), 100)
  }

  // 5. Dimension: Emergency Fund (Weight: 15%)
  let emergencyFundScore = 40
  if (avgExpenses > 0) {
    const monthsCovered = emergencyFundAmount / avgExpenses
    if (monthsCovered >= 6.0) emergencyFundScore = 100
    else if (monthsCovered >= 3.0) emergencyFundScore = 85
    else if (monthsCovered >= 1.0) emergencyFundScore = 65
    else emergencyFundScore = 40
  } else {
    emergencyFundScore = 60
  }

  // 6. Dimension: Consistency Streak (Weight: 15%)
  const consistencyScore = Math.min(Math.max(40 + streakDays * 5, 40), 100)

  // 7. Calculate Total Score
  const totalScore = Math.round(
    budgetScore * 0.25 +
    savingsRateScore * 0.20 +
    debtScore * 0.25 +
    emergencyFundScore * 0.15 +
    consistencyScore * 0.15
  )

  // Determine tier
  let tier = 'Building'
  let tierTh = 'กำลังสร้าง'

  if (totalScore >= 80) {
    tier = 'Secure'
    tierTh = 'มั่นคงมั่งคั่ง'
  } else if (totalScore >= 60) {
    tier = 'Steady'
    tierTh = 'มั่นคง'
  } else if (totalScore >= 40) {
    tier = 'Building'
    tierTh = 'กำลังสร้าง'
  } else {
    tier = 'At Risk'
    tierTh = 'เสี่ยง'
  }

  const dimensions = [
    { name: 'budgetAdherence', score: budgetScore, weight: 25, label: 'การคุมงบประมาณ', valueText: budgetScore >= 80 ? 'อยู่ในเกณฑ์ดี คุมส่วนใหญ่ได้ดี' : 'งบประมาณรั่วไหลบางหมวด' },
    { name: 'savingsRate', score: savingsRateScore, weight: 20, label: 'อัตราการออมเงิน', valueText: income > 0 ? `อัตราออมเงินเดือนนี้ ${Math.round((income - expense) / income * 100)}%` : 'ไม่มีรายได้บันทึก' },
    { name: 'debtHealth', score: debtScore, weight: 25, label: 'สุขภาพหนี้สิน', valueText: debts.length > 0 ? `กำลังผ่อนจ่ายหนี้สินอยู่ (${debts.length} บัญชี)` : 'ไม่มีหนี้สิน คล่องตัวสูง' },
    { name: 'emergencyFund', score: emergencyFundScore, weight: 15, label: 'เงินสำรองฉุกเฉิน', valueText: avgExpenses > 0 ? `สำรองประมาณ ${Math.round(emergencyFundAmount / avgExpenses * 10) / 10} เดือน` : 'ยังไม่มีค่าใช้จ่ายเฉลี่ย' },
    { name: 'consistencyStreak', score: consistencyScore, weight: 15, label: 'ความต่อเนื่องในการจด', valueText: streakDays > 0 ? `บันทึกติดต่อกัน ${streakDays} วัน` : 'เริ่มบันทึกเงินเพื่อสร้างวินัย' }
  ]

  const snapshotId = `snp_${crypto.randomUUID().replace(/-/g, '')}`

  // Write snapshot to DB
  await db.prepare(`
    INSERT INTO score_snapshots (id, user_id, total_score, tier, tier_th, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(snapshotId, userId, totalScore, tier, tierTh, JSON.stringify(dimensions)).run()

  return {
    totalScore,
    tier,
    tierTh,
    streakDays,
    dimensions
  }
}
