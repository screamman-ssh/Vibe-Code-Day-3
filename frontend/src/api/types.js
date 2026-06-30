/** @typedef {'free' | 'premium'} SubscriptionTier */
/** @typedef {'income' | 'expense'} TransactionType */
/** @typedef {'manual' | 'ocr'} TransactionSource */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} displayName
 * @property {string} [avatarUrl]
 * @property {SubscriptionTier} subscriptionTier
 * @property {number} emergencyFundAmount
 * @property {number} loggingStreakDays
 * @property {boolean} onboardingComplete
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} userId
 * @property {TransactionType} type
 * @property {number} amount
 * @property {string} category
 * @property {string} [merchant]
 * @property {string} [note]
 * @property {string} date
 * @property {TransactionSource} source
 */

/**
 * @typedef {Object} BudgetCategory
 * @property {string} category
 * @property {number} limitAmount
 */

/**
 * @typedef {Object} Group
 * @property {string} id
 * @property {string} name
 * @property {string} inviteCode
 * @property {string} ownerId
 */

/** Social-safe — NO monetary fields */
/**
 * @typedef {Object} LeaderboardMember
 * @property {number} rank
 * @property {string} displayName
 * @property {string} [avatarUrl]
 * @property {number} score
 * @property {string} tier
 * @property {string} tierTh
 * @property {string[]} badges
 * @property {number} streakDays
 * @property {boolean} [hideRank]
 */

/**
 * @typedef {Object} FeedEvent
 * @property {string} id
 * @property {string} userId
 * @property {string} displayName
 * @property {'score_changed' | 'badge_earned' | 'streak_milestone' | 'challenge_completed' | 'rank_changed'} eventType
 * @property {Record<string, unknown>} payload
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ScoreDimension
 * @property {string} key
 * @property {string} label
 * @property {number} weight
 * @property {number} subscore
 */

/**
 * @typedef {Object} PrivateScore
 * @property {number} totalScore
 * @property {string} tier
 * @property {string} tierTh
 * @property {ScoreDimension[]} dimensions
 */

/**
 * @typedef {Object} PublicScore
 * @property {number} score
 * @property {string} tier
 * @property {string} tierTh
 * @property {string[]} badges
 * @property {number} streakDays
 */

export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Health',
  'Education',
  'Debt Payment',
  'Savings',
  'Income',
  'Other',
]

export const TIER_THRESHOLDS = [
  { min: 80, tier: 'Thriving', tierTh: 'รุ่งเรือง' },
  { min: 60, tier: 'Steady', tierTh: 'มั่นคง' },
  { min: 40, tier: 'Building', tierTh: 'กำลังสร้าง' },
  { min: 0, tier: 'At Risk', tierTh: 'เสี่ยง' },
]
