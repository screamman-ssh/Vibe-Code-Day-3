import { useAuthStore } from '~/stores/auth'
import { useTransactionsStore } from '~/stores/transactions'
import { useBudgetStore } from '~/stores/budget'
import { useScoreStore } from '~/stores/score'
import { useDebtsStore } from '~/stores/debts'

export const TOOL_LABELS = {
  get_user_profile: 'โปรไฟล์ผู้ใช้',
  get_cashflow_summary: 'กระแสเงินสด',
  get_budget_status: 'งบประมาณ',
  get_transactions: 'รายการธุรกรรม',
  get_debt_overview: 'หนี้สิน',
  get_financial_score: 'คะแนนสุขภาพการเงิน'
}

export const financialToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'ดึงข้อมูลโปรไฟล์ผู้ใช้ เช่น ชื่อ แผนสมาชิก เงินสำรองฉุกเฉิน',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_cashflow_summary',
      description: 'ดึงสรุปรายรับ รายจ่าย เงินเหลือ และอัตราออมของเดือนปัจจุบัน',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'เดือนในรูปแบบ YYYY-MM (ค่าเริ่มต้นเดือนปัจจุบัน)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_status',
      description: 'ดึงสถานะงบประมาณรายหมวด เช่น ใช้ไปกี่ % เกินงบหรือไม่',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'ชื่อหมวด เช่น Food, Housing' },
          over_budget_only: { type: 'boolean', description: 'คืนเฉพาะหมวดที่เกินงบ' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_transactions',
      description: 'ดึงรายการธุรกรรมล่าสุดของผู้ใช้',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'จำนวนรายการสูงสุด (สูงสุด 20)' },
          type: { type: 'string', enum: ['income', 'expense'], description: 'กรองตามประเภท' },
          category: { type: 'string', description: 'กรองตามหมวด' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_debt_overview',
      description: 'ดึงภาพรวมหนี้สินทั้งหมด ยอดคงค้าง APR และยอดจ่ายขั้นต่ำ',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_score',
      description: 'ดึงคะแนนสุขภาพการเงิน ระดับ และมิติย่อย',
      parameters: { type: 'object', properties: {} }
    }
  }
]

function currentMonthPrefix() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Whether the user has logged meaningful financial activity in the app */
export function assessFinancialDataState() {
  const txStore = useTransactionsStore()
  const debtsStore = useDebtsStore()
  const budgetStore = useBudgetStore()
  const hasTransactions = txStore.items.length > 0
  const hasDebts = debtsStore.items.length > 0
  const hasBudgetActivity = budgetStore.categories.some(c => c.spentAmount > 0)
  return {
    hasTransactions,
    hasDebts,
    hasBudgetActivity,
    hasAnyData: hasTransactions || hasDebts || hasBudgetActivity
  }
}

function withMeta(data, empty) {
  return { ok: true, data, empty: !!empty }
}

function getUserProfile() {
  const auth = useAuthStore()
  const user = auth.user || {}
  return withMeta({
    displayName: user.displayName || 'ผู้ใช้',
    subscriptionTier: user.subscriptionTier || 'free',
    emergencyFundAmount: user.emergencyFundAmount ?? 0
  }, !user.displayName && !auth.user)
}

function getCashflowSummary(args = {}) {
  const txStore = useTransactionsStore()
  const month = args.month || currentMonthPrefix()
  const items = txStore.items.filter(t => t.date?.startsWith(month))
  const income = items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense
  const savingsRate = income > 0 ? Math.round((net / income) * 1000) / 10 : 0
  return withMeta({ month, income, expense, net, savingsRatePercent: savingsRate }, items.length === 0)
}

function getBudgetStatus(args = {}) {
  const budgetStore = useBudgetStore()
  let cats = budgetStore.categories.map(c => {
    const pct = c.limitAmount > 0 ? Math.round((c.spentAmount / c.limitAmount) * 100) : 0
    return {
      category: c.category,
      limitAmount: c.limitAmount,
      spentAmount: c.spentAmount,
      percentUsed: pct,
      overBudget: c.spentAmount > c.limitAmount
    }
  })
  if (args.category) {
    const q = args.category.toLowerCase()
    cats = cats.filter(c => c.category.toLowerCase().includes(q))
  }
  if (args.over_budget_only) {
    cats = cats.filter(c => c.overBudget)
  }
  const totalLimit = cats.reduce((s, c) => s + c.limitAmount, 0)
  const totalSpent = cats.reduce((s, c) => s + c.spentAmount, 0)
  const empty = cats.every(c => c.spentAmount === 0)
  return withMeta({ categories: cats, totalLimit, totalSpent }, empty)
}

function getTransactions(args = {}) {
  const txStore = useTransactionsStore()
  const limit = Math.min(Math.max(args.limit || 10, 1), 20)
  let items = [...txStore.items]
  if (args.type) items = items.filter(t => t.type === args.type)
  if (args.category) {
    const q = args.category.toLowerCase()
    items = items.filter(t => t.category?.toLowerCase().includes(q))
  }
  items = items.slice(0, limit).map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    merchant: t.merchant,
    note: t.note,
    date: t.date
  }))
  return withMeta({ transactions: items, count: items.length }, items.length === 0)
}

function getDebtOverview() {
  const debtsStore = useDebtsStore()
  const debts = debtsStore.items.map(d => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    originalAmount: d.originalAmount,
    apr: d.apr,
    minimumPayment: d.minimumPayment,
    dueDay: d.dueDay,
    onTimeStreak: d.onTimeStreak
  }))
  return withMeta({
    debts,
    totalBalance: debtsStore.totalBalance,
    totalMinimumPayment: debtsStore.totalMinimumPayment,
    weightedApr: debtsStore.weightedApr,
    count: debts.length
  }, debts.length === 0)
}

function getFinancialScore() {
  const scoreStore = useScoreStore()
  const s = scoreStore.currentScore
  return {
    ok: true,
    empty: false,
    data: {
      totalScore: s.totalScore,
      tier: s.tier,
      tierTh: s.tierTh,
      streakDays: s.streakDays,
      dimensions: s.dimensions.map(d => ({
        name: d.name,
        label: d.label,
        score: d.score,
        valueText: d.valueText
      }))
    }
  }
}

export function buildGeneralFinancialAdvice(userMessage) {
  const q = (userMessage || '').toLowerCase()
  const profile = getUserProfile()
  const name = profile.data?.displayName || 'คุณ'

  if (/หนี้|ปลดหนี้|ดอกเบี้ย|debt/.test(q)) {
    return `**แนวทางปลดหนี้ (ทั่วไป)**

คุณ ${name} ยังไม่มีข้อมูลหนี้ในแอป หลักการสำคัญ:

- **Avalanche** — จ่ายหนี้ดอกเบี้ยสูงก่อน ประหยัดดอกระยะยาว
- **Snowball** — ปิดหนี้ยอดเล็กก่อน สร้างแรงใจ
- จ่ายขั้นต่ำทุกบัญชีให้ครบ แล้วค่อยโปะหนี้เป้าหมาย

เพิ่มหนี้ที่หน้า **หนี้สิน** แล้วถามอีกครั้ง ผมจะช่วยจัดลำดับให้ครับ`
  }

  if (/งบ|รายจ่าย|ใช้จ่าย|budget|คุมงบ|ประหยัด|ออม/.test(q)) {
    return `**คุมงบเบื้องต้น**

คุณ ${name} ยังไม่มีข้อมูลรายจ่ายในแอป ลองเริ่มจาก:

- **50/30/20** — จำเป็น 50% · ส่วนตัว 30% · ออม/หนี้ 20%
- บันทึกทุกรายการ 7 วัน จะเห็นภาพจริง
- ตัดค่าใช้จ่ายอัตโนมัติที่ไม่จำเป็น

บันทึกที่หน้า **บันทึกเงิน** แล้วถามวิเคราะห์ได้เลยครับ`
  }

  if (/คะแนน|สุขภาพการเงิน|score/.test(q)) {
    return `**สุขภาพการเงินพื้นฐาน**

คุณ ${name} ยังไม่มีคะแนนเฉพาะบุคคล เป้าหมายหลัก:

- เงินสำรอง **3–6 เดือน** ของค่าใช้จ่าย
- ออม **10–20%** ของรายรับ
- หนี้ต่อรายได้ต่ำกว่า **40%**

บันทึกข้อมูลในแอป ระบบจะคำนวณคะแนนให้ครับ`
  }

  return `**เริ่มต้นจัดการเงิน**

คุณ ${name}! ยังไม่มีข้อมูลในแอป เริ่ม 3 ขั้นนี้:

1. บันทึกรายรับ-รายจ่ายทุกวัน
2. ตั้งงบรายหมวดตามความจริง
3. เก็บเงินสำรองฉุกเฉิน เริ่มจาก 1 เดือน

ถามเรื่องงบ ออม หรือหนี้ได้เลยครับ`
}

export function executeFinancialTool(name, args = {}) {
  try {
    switch (name) {
      case 'get_user_profile': return getUserProfile()
      case 'get_cashflow_summary': return getCashflowSummary(args)
      case 'get_budget_status': return getBudgetStatus(args)
      case 'get_transactions': return getTransactions(args)
      case 'get_debt_overview': return getDebtOverview()
      case 'get_financial_score': return getFinancialScore()
      default: return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export function summarizeToolResult(name, result) {
  if (!result?.ok) return 'ไม่สำเร็จ'
  const d = result.data
  switch (name) {
    case 'get_user_profile': return d.displayName
    case 'get_cashflow_summary': return `รายรับ ${d.income.toLocaleString()} บาท`
    case 'get_budget_status': return `${d.categories.length} หมวด`
    case 'get_transactions': return `${d.count} รายการ`
    case 'get_debt_overview': return `ยอดรวม ${d.totalBalance.toLocaleString()} บาท`
    case 'get_financial_score': return `คะแนน ${d.totalScore}`
    default: return 'สำเร็จ'
  }
}

const INTENT_RULES = [
  { keywords: ['หนี้', 'ปลดหนี้', 'ดอกเบี้ย', 'debt'], tools: ['get_debt_overview', 'get_cashflow_summary'] },
  { keywords: ['คะแนน', 'สุขภาพการเงิน', 'score', 'tier'], tools: ['get_financial_score'] },
  { keywords: ['รายการ', 'ธุรกรรม', 'transaction', 'ร้าน', 'merchant'], tools: ['get_transactions'] },
  { keywords: ['งบ', 'รายจ่าย', 'ใช้จ่าย', 'budget', 'คุมงบ', 'ประหยัด'], tools: ['get_cashflow_summary', 'get_budget_status'] },
  { keywords: ['วิเคราะห์', 'สรุป', 'ภาพรวม'], tools: ['get_cashflow_summary', 'get_budget_status', 'get_debt_overview', 'get_financial_score'] }
]

const FINANCIAL_HINT_KEYWORDS = [
  'เงิน', 'บาท', 'การเงิน', 'ออม', 'เก็บเงิน', 'ลงทุน', 'รายได้', 'เงินเดือน',
  'money', 'finance', 'save', 'saving', 'invest', 'income', 'salary', 'expense',
  'บัญชี', 'โปะ', 'ผ่อน', 'สินเชื่อ', 'บัตรเครดิต'
]

/** Does the question relate to personal finance / the user's app data? */
export function hasFinancialIntent(userMessage) {
  const q = (userMessage || '').toLowerCase()
  if (INTENT_RULES.some(rule => rule.keywords.some(kw => q.includes(kw)))) return true
  return FINANCIAL_HINT_KEYWORDS.some(kw => q.includes(kw))
}

export function resolveToolsByIntent(userMessage) {
  const q = userMessage.toLowerCase()
  const matched = new Set()
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some(kw => q.includes(kw))) {
      rule.tools.forEach(t => matched.add(t))
    }
  }
  if (matched.size === 0) {
    // Generic finance question: pull a broad snapshot
    return ['get_cashflow_summary', 'get_budget_status', 'get_debt_overview']
  }
  return [...matched]
}

export function runIntentRouterTools(userMessage, callbacks = {}) {
  const toolNames = resolveToolsByIntent(userMessage)
  const trace = []
  const syntheticId = () => `intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  for (const name of toolNames) {
    callbacks.onToolStart?.(name)
    const result = executeFinancialTool(name, {})
    callbacks.onToolDone?.(name, result)
    trace.push({ name, args: {}, summary: summarizeToolResult(name, result), result })
  }

  return {
    toolMessages: trace.map(t => ({
      role: 'tool',
      tool_call_id: syntheticId(),
      content: JSON.stringify(t.result)
    })),
    toolTrace: trace.map(({ name, args, summary }) => ({ name, args, summary }))
  }
}
