import { calculateScore, toPublicScore } from '../../services/scoreEngine.js'
import { createSeedState, currentMonth, todayStr, bangkokDateKey, uid } from './seed.js'
import { loadState, saveState, clearState } from './storage.js'
import { delay, ocrDelay } from './delays.js'

let state = loadState() || createSeedState()

function persist() {
  saveState(state)
}

function getCurrentUser() {
  if (!state.currentUserId) return null
  return state.users[state.currentUserId]
}

function recalcCurrentUserScore() {
  const user = getCurrentUser()
  if (!user) return null
  const month = currentMonth()
  const score = calculateScore({
    transactions: state.transactions.filter((t) => t.userId === user.id),
    budgetCategories: state.budgetCategories,
    debts: state.debts,
    emergencyFundAmount: user.emergencyFundAmount,
    loggingStreakDays: user.loggingStreakDays,
    month,
  })

  const prev = state.lastScore ?? score.totalScore
  if (Math.abs(score.totalScore - prev) >= 1) {
    state.feed.unshift({
      id: uid(),
      userId: user.id,
      displayName: user.displayName,
      eventType: 'score_changed',
      payload: {
        previous_score: prev,
        new_score: score.totalScore,
        tier: score.tier,
      },
      createdAt: new Date().toISOString(),
    })
    state.lastScore = score.totalScore
  }

  const member = state.members.find((m) => m.userId === user.id)
  if (member) {
    member.score = score.totalScore
    member.tier = score.tier
    member.tierTh = score.tierTh
    member.streakDays = user.loggingStreakDays
  }

  persist()
  return score
}

function updateStreak() {
  const user = getCurrentUser()
  if (!user) return
  const today = todayStr()
  if (state.lastLogDate === today) return
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)
  if (state.lastLogDate === yStr) {
    user.loggingStreakDays += 1
  } else {
    user.loggingStreakDays = 1
  }
  state.lastLogDate = today
}

export const mockApi = {
  async loginAsPersona(persona) {
    await delay(200)
    const seed = createSeedState()
    const personas = {
      nune: 'user-nune',
      boss: 'user-boss',
    }
    const userId = personas[persona] || 'user-nune'
    if (!state.users[userId]) {
      state.users[userId] = seed.users[userId] || {
        id: userId,
        displayName: persona,
        subscriptionTier: 'free',
        emergencyFundAmount: 0,
        loggingStreakDays: 0,
        onboardingComplete: false,
      }
    }
    state.currentUserId = userId
    if (persona === 'boss') {
      state.groupJoined = true
    }
    persist()
    return getCurrentUser()
  },

  async loginAsGuest(displayName) {
    await delay(200)
    const id = uid()
    state.users[id] = {
      id,
      displayName: displayName || 'ผู้ใช้ใหม่',
      subscriptionTier: 'free',
      emergencyFundAmount: 0,
      loggingStreakDays: 0,
      onboardingComplete: false,
    }
    state.currentUserId = id
    state.members.push({
      userId: id,
      displayName: displayName || 'ผู้ใช้ใหม่',
      score: 50,
      tier: 'Building',
      tierTh: 'กำลังสร้าง',
      badges: [],
      streakDays: 0,
      hideRank: false,
    })
    persist()
    return getCurrentUser()
  },

  async logout() {
    state.currentUserId = null
    persist()
  },

  getMe() {
    return getCurrentUser()
  },

  async completeOnboarding({ action, groupName, inviteCode }) {
    await delay(300)
    const user = getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    user.onboardingComplete = true
    if (action === 'create') {
      state.group = {
        id: uid(),
        name: groupName || 'กลุ่มของฉัน',
        inviteCode: 'DEMO01',
        ownerId: user.id,
      }
      state.groupJoined = true
      if (!state.members.find((m) => m.userId === user.id)) {
        state.members.push({
          userId: user.id,
          displayName: user.displayName,
          score: 50,
          tier: 'Building',
          tierTh: 'กำลังสร้าง',
          badges: [],
          streakDays: 0,
          hideRank: false,
        })
      }
    } else if (action === 'join' && inviteCode?.toUpperCase() === 'DEMO01') {
      state.groupJoined = true
    }
    persist()
    return user
  },

  async getTransactions() {
    await delay(100)
    const user = getCurrentUser()
    return state.transactions
      .filter((t) => t.userId === user?.id)
      .sort((a, b) => b.date.localeCompare(a.date))
  },

  async createTransaction(data) {
    await delay(150)
    const user = getCurrentUser()
    const tx = {
      id: uid(),
      userId: user.id,
      type: data.type,
      amount: Number(data.amount),
      category: data.category,
      merchant: data.merchant || '',
      note: data.note || '',
      date: data.date || todayStr(),
      source: data.source || 'manual',
    }
    state.transactions.push(tx)
    updateStreak()
    const score = recalcCurrentUserScore()
    persist()
    return { transaction: tx, score }
  },

  async updateTransaction(id, data) {
    await delay(150)
    const user = getCurrentUser()
    const idx = state.transactions.findIndex((t) => t.id === id && t.userId === user?.id)
    if (idx === -1) throw new Error('Not found')
    state.transactions[idx] = { ...state.transactions[idx], ...data, amount: Number(data.amount) }
    const score = recalcCurrentUserScore()
    persist()
    return { transaction: state.transactions[idx], score }
  },

  async deleteTransaction(id) {
    await delay(150)
    const user = getCurrentUser()
    state.transactions = state.transactions.filter((t) => !(t.id === id && t.userId === user?.id))
    const score = recalcCurrentUserScore()
    persist()
    return { score }
  },

  async getBudget() {
    await delay(100)
    const user = getCurrentUser()
    const month = currentMonth()
    const expenses = state.transactions.filter(
      (t) => t.userId === user?.id && t.type === 'expense' && t.date.startsWith(month)
    )
    return state.budgetCategories.map((cat) => {
      const spent = expenses
        .filter((t) => t.category === cat.category)
        .reduce((s, t) => s + t.amount, 0)
      return { ...cat, spentAmount: spent }
    })
  },

  async updateBudget(categories) {
    await delay(150)
    state.budgetCategories = categories
    const score = recalcCurrentUserScore()
    persist()
    return { budget: state.budgetCategories, score }
  },

  async getScore() {
    await delay(100)
    const user = getCurrentUser()
    const month = currentMonth()
    return calculateScore({
      transactions: state.transactions.filter((t) => t.userId === user?.id),
      budgetCategories: state.budgetCategories,
      debts: state.debts,
      emergencyFundAmount: user?.emergencyFundAmount ?? 0,
      loggingStreakDays: user?.loggingStreakDays ?? 0,
      month,
    })
  },

  async getLeaderboard() {
    await delay(150)
    const sorted = [...state.members].sort((a, b) => b.score - a.score)
    return sorted.map((m, i) => ({
      rank: m.hideRank ? null : i + 1,
      displayName: m.displayName,
      score: m.score,
      tier: m.tier,
      tierTh: m.tierTh,
      badges: m.badges,
      streakDays: m.streakDays,
      hideRank: m.hideRank,
    }))
  },

  async getFeed() {
    await delay(100)
    return state.feed.slice(0, 50)
  },

  async getGroup() {
    return state.groupJoined ? state.group : null
  },

  async getUsage() {
    const user = getCurrentUser()
    const today = bangkokDateKey()
    if (state.ocrUsage.date !== today) {
      state.ocrUsage = { date: today, count: 0 }
      persist()
    }
    return {
      ocrUsedToday: state.ocrUsage.count,
      ocrLimit: user?.subscriptionTier === 'premium' ? 999 : 5,
      tier: user?.subscriptionTier ?? 'free',
      premiumFeaturesLocked: user?.subscriptionTier !== 'premium',
    }
  },

  async runOcr() {
    const user = getCurrentUser()
    const today = bangkokDateKey()
    if (state.ocrUsage.date !== today) {
      state.ocrUsage = { date: today, count: 0 }
    }
    const limit = user?.subscriptionTier === 'premium' ? 999 : 5
    if (state.ocrUsage.count >= limit) {
      const err = new Error('OCR quota exceeded')
      err.code = 'QUOTA_EXCEEDED'
      throw err
    }
    await ocrDelay()
    state.ocrUsage.count += 1
    persist()
    return {
      merchant: '7-Eleven',
      amount: 89,
      date: todayStr(),
      category: 'Food',
      confidence: 0.91,
    }
  },

  async updateProfile(data) {
    await delay(150)
    const user = getCurrentUser()
    if (data.displayName) user.displayName = data.displayName
    if (data.emergencyFundAmount != null) user.emergencyFundAmount = Number(data.emergencyFundAmount)
    if (data.subscriptionTier) user.subscriptionTier = data.subscriptionTier
    const member = state.members.find((m) => m.userId === user.id)
    if (member && data.displayName) member.displayName = data.displayName
    recalcCurrentUserScore()
    persist()
    return user
  },

  resetDemo() {
    clearState()
    state = createSeedState()
    persist()
    return state
  },

  getPublicScore() {
    const user = getCurrentUser()
    const member = state.members.find((m) => m.userId === user?.id)
    const month = currentMonth()
    const score = calculateScore({
      transactions: state.transactions.filter((t) => t.userId === user?.id),
      budgetCategories: state.budgetCategories,
      debts: state.debts,
      emergencyFundAmount: user?.emergencyFundAmount ?? 0,
      loggingStreakDays: user?.loggingStreakDays ?? 0,
      month,
    })
    return toPublicScore(score, member?.badges ?? [], user?.loggingStreakDays ?? 0)
  },
}

export function getMockState() {
  return state
}
