import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'moneycircle_debts'

const DEFAULT_DEBTS = [
  { id: 'd-1', name: 'บัตรเครดิตธนาคาร A', originalAmount: 50000, balance: 35000, apr: 16, minimumPayment: 1750, dueDay: 15, onTimeStreak: 4 },
  { id: 'd-2', name: 'สินเชื่อส่วนบุคคล B', originalAmount: 100000, balance: 65000, apr: 18, minimumPayment: 3250, dueDay: 28, onTimeStreak: 2 }
]

function loadDebts() {
  if (typeof window === 'undefined') return [...DEFAULT_DEBTS]
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return [...DEFAULT_DEBTS]
}

export const useDebtsStore = defineStore('debts', () => {
  const items = ref(loadDebts())

  watch(items, (val) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }
  }, { deep: true })

  const totalBalance = computed(() =>
    items.value.reduce((sum, d) => sum + d.balance, 0)
  )

  const totalOriginalAmount = computed(() =>
    items.value.reduce((sum, d) => sum + d.originalAmount, 0)
  )

  const totalMinimumPayment = computed(() =>
    items.value.reduce((sum, d) => sum + d.minimumPayment, 0)
  )

  const weightedApr = computed(() => {
    const total = totalBalance.value
    if (total <= 0) return 0
    const weighted = items.value.reduce((sum, d) => sum + d.balance * d.apr, 0)
    return Math.round((weighted / total) * 10) / 10
  })

  function addDebt(data) {
    const orig = parseFloat(data.originalAmount)
    const bal = parseFloat(data.balance ?? data.originalAmount)
    const debt = {
      id: `d-${Date.now()}`,
      name: data.name,
      originalAmount: orig,
      balance: bal,
      apr: parseFloat(data.apr || 0),
      minimumPayment: parseFloat(data.minimumPayment || bal * 0.05),
      dueDay: parseInt(data.dueDay || 15),
      onTimeStreak: 0
    }
    items.value.push(debt)
    return debt
  }

  function updateDebt(id, data) {
    const idx = items.value.findIndex(d => d.id === id)
    if (idx === -1) return null
    const current = items.value[idx]
    items.value[idx] = {
      ...current,
      ...data,
      originalAmount: data.originalAmount != null ? parseFloat(data.originalAmount) : current.originalAmount,
      balance: data.balance != null ? parseFloat(data.balance) : current.balance,
      apr: data.apr != null ? parseFloat(data.apr) : current.apr,
      minimumPayment: data.minimumPayment != null ? parseFloat(data.minimumPayment) : current.minimumPayment,
      dueDay: data.dueDay != null ? parseInt(data.dueDay) : current.dueDay
    }
    return items.value[idx]
  }

  function deleteDebt(id) {
    items.value = items.value.filter(d => d.id !== id)
  }

  function recordPayment(id, amount) {
    const debt = items.value.find(d => d.id === id)
    if (!debt) return null
    debt.balance = Math.max(debt.balance - parseFloat(amount), 0)
    debt.onTimeStreak++
    return debt
  }

  return {
    items,
    totalBalance,
    totalOriginalAmount,
    totalMinimumPayment,
    weightedApr,
    addDebt,
    updateDebt,
    deleteDebt,
    recordPayment
  }
})
