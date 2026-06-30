import { calculateScore } from '../../services/scoreEngine.js'

function uid() {
  return crypto.randomUUID()
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function bangkokDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function createSeedState() {
  const month = currentMonth()
  const nuneId = 'user-nune'
  const bossId = 'user-boss'
  const friendAId = 'user-friend-a'
  const friendBId = 'user-friend-b'
  const groupId = 'group-demo'

  const budgetCategories = [
    { category: 'Food', limitAmount: 5000 },
    { category: 'Transport', limitAmount: 2000 },
    { category: 'Entertainment', limitAmount: 1500 },
    { category: 'Utilities', limitAmount: 2500 },
    { category: 'Health', limitAmount: 1000 },
  ]

  const transactions = [
    { id: uid(), userId: nuneId, type: 'income', amount: 35000, category: 'Income', merchant: 'Freelance', date: `${month}-01`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 120, category: 'Food', merchant: '7-Eleven', date: `${month}-02`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 85, category: 'Transport', merchant: 'BTS', date: `${month}-03`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 450, category: 'Food', merchant: 'ร้านอาหาร', date: `${month}-05`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 320, category: 'Entertainment', merchant: 'Netflix', date: `${month}-06`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 1500, category: 'Utilities', merchant: 'การไฟฟ้า', date: `${month}-08`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 200, category: 'Food', merchant: 'คาเฟ่', date: `${month}-10`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 3500, category: 'Debt Payment', merchant: 'บัตรเครดิต', date: `${month}-12`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 180, category: 'Transport', merchant: 'Grab', date: `${month}-14`, source: 'manual' },
    { id: uid(), userId: nuneId, type: 'expense', amount: 95, category: 'Food', merchant: 'ร้านส้มตำ', date: `${month}-15`, source: 'manual' },
  ]

  const nuneUser = {
    id: nuneId,
    displayName: 'Nune',
    avatarUrl: '',
    subscriptionTier: 'free',
    emergencyFundAmount: 12000,
    loggingStreakDays: 12,
    onboardingComplete: false,
  }

  const members = [
    {
      userId: nuneId,
      displayName: 'Nune',
      score: 72,
      tier: 'Steady',
      tierTh: 'มั่นคง',
      badges: ['Week Warrior', 'Budget Boss'],
      streakDays: 12,
      hideRank: false,
    },
    {
      userId: bossId,
      displayName: 'Boss',
      score: 81,
      tier: 'Thriving',
      tierTh: 'รุ่งเรือง',
      badges: ['Month Master', 'Debt Destroyer'],
      streakDays: 22,
      hideRank: false,
    },
    {
      userId: friendAId,
      displayName: 'มิ้นท์',
      score: 55,
      tier: 'Building',
      tierTh: 'กำลังสร้าง',
      badges: ['First Log'],
      streakDays: 5,
      hideRank: false,
    },
    {
      userId: friendBId,
      displayName: 'เจมส์',
      score: 44,
      tier: 'Building',
      tierTh: 'กำลังสร้าง',
      badges: [],
      streakDays: 2,
      hideRank: false,
    },
  ]

  const score = calculateScore({
    transactions,
    budgetCategories,
    debts: [{ onTimeStreak: 3 }],
    emergencyFundAmount: nuneUser.emergencyFundAmount,
    loggingStreakDays: nuneUser.loggingStreakDays,
    month,
  })

  const feed = [
    {
      id: uid(),
      userId: bossId,
      displayName: 'Boss',
      eventType: 'badge_earned',
      payload: { badge_code: 'debt_destroyer', badge_name: 'Debt Destroyer' },
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: uid(),
      userId: nuneId,
      displayName: 'Nune',
      eventType: 'score_changed',
      payload: { previous_score: 68, new_score: 72, tier: 'Steady' },
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: uid(),
      userId: friendAId,
      displayName: 'มิ้นท์',
      eventType: 'streak_milestone',
      payload: { streak_days: 5 },
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ]

  return {
    currentUserId: null,
    users: {
      [nuneId]: nuneUser,
      [bossId]: {
        id: bossId,
        displayName: 'Boss',
        subscriptionTier: 'premium',
        emergencyFundAmount: 50000,
        loggingStreakDays: 22,
        onboardingComplete: true,
      },
    },
    group: {
      id: groupId,
      name: 'เพื่อนติวการเงิน',
      inviteCode: 'DEMO01',
      ownerId: bossId,
      memberIds: [nuneId, bossId, friendAId, friendBId],
    },
    groupJoined: false,
    transactions,
    budgetCategories,
    debts: [],
    members,
    feed,
    lastScore: score.totalScore,
    ocrUsage: { date: bangkokDateKey(), count: 0 },
    lastLogDate: todayStr(),
  }
}

export { currentMonth, todayStr, bangkokDateKey, uid }
