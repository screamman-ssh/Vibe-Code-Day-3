export const TX_CATEGORIES = [
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
  'Other'
]

export const CATEGORY_LABELS = {
  Food: 'อาหาร',
  Transport: 'การเดินทาง',
  Housing: 'ที่อยู่อาศัย',
  Utilities: 'สาธารณูปโภค',
  Entertainment: 'บันเทิง',
  Health: 'สุขภาพ',
  Education: 'การศึกษา',
  'Debt Payment': 'ชำระหนี้',
  Savings: 'ออม',
  Income: 'รายรับ',
  Other: 'อื่นๆ'
}

export const ACTION_TYPES = {
  CREATE_TX: 'create_transaction',
  UPDATE_TX: 'update_transaction',
  DELETE_TX: 'delete_transaction',
  SET_BUDGET: 'set_budget',
  ADD_DEBT: 'add_debt',
  RECORD_DEBT_PAYMENT: 'record_debt_payment',
  CREATE_SOCIAL_POST: 'create_social_post'
}

export function formatCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '-'
}

export function normalizeCategory(input) {
  if (!input || typeof input !== 'string') return 'Other'
  const trimmed = input.trim()
  const exact = TX_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase())
  if (exact) return exact

  const thaiMap = {
    อาหาร: 'Food',
    กิน: 'Food',
    เดินทาง: 'Transport',
    รถ: 'Transport',
    ที่อยู่: 'Housing',
    ค่าน้ำ: 'Utilities',
    ค่าไฟ: 'Utilities',
    บันเทิง: 'Entertainment',
    สุขภาพ: 'Health',
    ยา: 'Health',
    การศึกษา: 'Education',
    หนี้: 'Debt Payment',
    ออม: 'Savings',
    รายรับ: 'Income',
    เงินเดือน: 'Income'
  }

  for (const [key, value] of Object.entries(thaiMap)) {
    if (trimmed.includes(key)) return value
  }

  return 'Other'
}

export function resolveActionDate(value) {
  if (!value || value === 'today') {
    return new Date().toISOString().slice(0, 10)
  }
  return value
}

export function createEmptyTransaction() {
  return {
    type: ACTION_TYPES.CREATE_TX,
    data: {
      txType: 'expense',
      amount: 0,
      category: 'Food',
      merchant: '',
      note: '',
      date: 'today'
    }
  }
}

export function normalizeAction(action) {
  if (!action?.type || !action?.data) return null

  const d = { ...action.data }

  switch (action.type) {
    case ACTION_TYPES.CREATE_TX: {
      const amount = Number(d.amount)
      if (!Number.isFinite(amount) || amount <= 0) return null
      return {
        type: action.type,
        data: {
          txType: d.txType === 'income' ? 'income' : 'expense',
          amount,
          category: normalizeCategory(d.category),
          merchant: typeof d.merchant === 'string' ? d.merchant.trim() : '',
          note: typeof d.note === 'string' ? d.note.trim() : '',
          date: d.date || 'today'
        }
      }
    }
    case ACTION_TYPES.UPDATE_TX: {
      if (!d.transactionId) return null
      const patch = { transactionId: d.transactionId }
      if (d.txType) patch.txType = d.txType === 'income' ? 'income' : 'expense'
      if (d.amount != null) patch.amount = Number(d.amount)
      if (d.category) patch.category = normalizeCategory(d.category)
      if (d.merchant != null) patch.merchant = String(d.merchant).trim()
      if (d.note != null) patch.note = String(d.note).trim()
      if (d.date) patch.date = d.date
      return { type: action.type, data: patch }
    }
    case ACTION_TYPES.DELETE_TX:
      if (!d.transactionId) return null
      return { type: action.type, data: { transactionId: d.transactionId } }
    case ACTION_TYPES.SET_BUDGET: {
      const limit = Number(d.limitAmount)
      if (!d.category || !Number.isFinite(limit) || limit < 0) return null
      return {
        type: action.type,
        data: {
          category: normalizeCategory(d.category),
          limitAmount: limit,
          month: d.month || null
        }
      }
    }
    case ACTION_TYPES.ADD_DEBT: {
      const balance = Number(d.balance)
      if (!d.name || !Number.isFinite(balance) || balance < 0) return null
      return {
        type: action.type,
        data: {
          name: String(d.name).trim(),
          balance,
          apr: d.apr != null ? Number(d.apr) : 0,
          minimumPayment: d.minimumPayment != null ? Number(d.minimumPayment) : 0,
          dueDay: d.dueDay != null ? Number(d.dueDay) : 15
        }
      }
    }
    case ACTION_TYPES.RECORD_DEBT_PAYMENT: {
      const amount = Number(d.amount)
      if (!d.debtName || !Number.isFinite(amount) || amount <= 0) return null
      return {
        type: action.type,
        data: {
          debtName: String(d.debtName).trim(),
          amount
        }
      }
    }
    case ACTION_TYPES.CREATE_SOCIAL_POST: {
      const content = typeof d.content === 'string' ? d.content.trim() : ''
      if (!content || content.length > 500) return null
      return { type: action.type, data: { content } }
    }
    default:
      return null
  }
}

export function normalizeActions(actions = []) {
  if (!Array.isArray(actions)) return []
  return actions
    .map(normalizeAction)
    .filter(Boolean)
    .slice(0, 12)
}

export function countTransactionActions(actions = []) {
  return actions.filter(a => a.type === ACTION_TYPES.CREATE_TX).length
}

export function planSummary(actions = []) {
  const txCount = countTransactionActions(actions)
  const social = actions.some(a => a.type === ACTION_TYPES.CREATE_SOCIAL_POST)
  if (txCount && social) return `จะบันทึก ${txCount} รายการ และโพสต์ไปชุมชน`
  if (txCount > 1) return `จะบันทึก ${txCount} รายการ`
  if (txCount === 1) return 'จะบันทึก 1 รายการ'
  if (social) return 'จะโพสต์ไปชุมชน'
  return 'ฉันจะทำสิ่งนี้ให้ไหม?'
}
