/**
 * Client-side score engine — mirrors prd.md §6
 * Weights: budget 25%, savings 20%, debt 25%, emergency 15%, streak 15%
 */

import { TIER_THRESHOLDS } from '../api/types.js'

const WEIGHTS = {
  budgetAdherence: 0.25,
  savingsRate: 0.2,
  debtHealth: 0.25,
  emergencyFund: 0.15,
  consistencyStreak: 0.15,
}

export function getTier(totalScore) {
  const clamped = Math.max(0, Math.min(100, Math.round(totalScore)))
  for (const t of TIER_THRESHOLDS) {
    if (clamped >= t.min) return { tier: t.tier, tierTh: t.tierTh }
  }
  return { tier: 'At Risk', tierTh: 'เสี่ยง' }
}

function savingsRateSubscore(rate) {
  if (rate <= 0) return 0
  if (rate <= 5) return 40
  if (rate <= 10) return 70
  if (rate <= 20) return 90
  return 100
}

function emergencyFundSubscore(months) {
  if (months <= 0) return 0
  if (months < 1) return 30
  if (months <= 2) return 60
  if (months <= 5) return 85
  return 100
}

function streakSubscore(days) {
  if (days <= 0) return 0
  if (days <= 3) return 30
  if (days <= 7) return 60
  if (days <= 14) return 80
  return 100
}

function dtiSubscore(dti) {
  if (dti <= 0) return 100
  if (dti <= 15) return 90
  if (dti <= 30) return 70
  if (dti <= 45) return 40
  return 10
}

function computeBudgetAdherence(budgetCategories, transactions, month) {
  if (!budgetCategories?.length) return 50
  const expenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(month)
  )
  let within = 0
  for (const cat of budgetCategories) {
    if (cat.limitAmount <= 0) continue
    const spent = expenses
      .filter((t) => t.category === cat.category)
      .reduce((s, t) => s + t.amount, 0)
    if (spent <= cat.limitAmount) within++
  }
  const total = budgetCategories.filter((c) => c.limitAmount > 0).length
  if (total === 0) return 50
  return Math.round((within / total) * 100)
}

function computeSavingsRate(transactions, month) {
  const monthTx = transactions.filter((t) => t.date.startsWith(month))
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  if (income <= 0) return 50
  const rate = ((income - expense) / income) * 100
  return savingsRateSubscore(rate)
}

function computeDebtHealth(debts, transactions, month) {
  if (!debts?.length) return 50
  const monthTx = transactions.filter((t) => t.date.startsWith(month))
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const debtPayments = monthTx
    .filter((t) => t.category === 'Debt Payment')
    .reduce((s, t) => s + t.amount, 0)
  const dti = income > 0 ? (debtPayments / income) * 100 : 0
  const dtiScore = dtiSubscore(dti)
  const onTimeStreak = debts.reduce((max, d) => Math.max(max, d.onTimeStreak || 0), 0)
  const streakScore = Math.min(100, onTimeStreak * 20)
  return Math.round(dtiScore * 0.5 + streakScore * 0.5)
}

function computeEmergencyFund(emergencyFundAmount, avgMonthlyExpenses) {
  if (!avgMonthlyExpenses || avgMonthlyExpenses <= 0) return 50
  const months = emergencyFundAmount / avgMonthlyExpenses
  return emergencyFundSubscore(months)
}

/**
 * @param {Object} input
 * @param {import('../api/types.js').Transaction[]} input.transactions
 * @param {import('../api/types.js').BudgetCategory[]} input.budgetCategories
 * @param {Object[]} [input.debts]
 * @param {number} input.emergencyFundAmount
 * @param {number} input.loggingStreakDays
 * @param {string} input.month YYYY-MM
 */
export function calculateScore(input) {
  const {
    transactions = [],
    budgetCategories = [],
    debts = [],
    emergencyFundAmount = 0,
    loggingStreakDays = 0,
    month,
  } = input

  const monthExpenses = transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)
  const avgMonthlyExpenses = monthExpenses || 15000

  const dimensions = [
    {
      key: 'budgetAdherence',
      label: 'การทำตามงบประมาณ',
      weight: WEIGHTS.budgetAdherence,
      subscore: computeBudgetAdherence(budgetCategories, transactions, month),
    },
    {
      key: 'savingsRate',
      label: 'อัตราการออม',
      weight: WEIGHTS.savingsRate,
      subscore: computeSavingsRate(transactions, month),
    },
    {
      key: 'debtHealth',
      label: 'สุขภาพหนี้',
      weight: WEIGHTS.debtHealth,
      subscore: computeDebtHealth(debts, transactions, month),
    },
    {
      key: 'emergencyFund',
      label: 'กองทุนฉุกเฉิน',
      weight: WEIGHTS.emergencyFund,
      subscore: computeEmergencyFund(emergencyFundAmount, avgMonthlyExpenses),
    },
    {
      key: 'consistencyStreak',
      label: 'ความสม่ำเสมอ',
      weight: WEIGHTS.consistencyStreak,
      subscore: streakSubscore(loggingStreakDays),
    },
  ]

  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.subscore * d.weight, 0)
  )
  const { tier, tierTh } = getTier(totalScore)

  return { totalScore, tier, tierTh, dimensions }
}

/** @returns {import('../api/types.js').PublicScore} */
export function toPublicScore(score, badges = [], streakDays = 0) {
  return {
    score: score.totalScore,
    tier: score.tier,
    tierTh: score.tierTh,
    badges,
    streakDays,
  }
}
