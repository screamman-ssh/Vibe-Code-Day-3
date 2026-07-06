import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { useScoreStore } from '~/stores/score'

export const useDebtsStore = defineStore('debts', () => {
  const items = ref([])
  const api = useApi()

  async function fetchDebts() {
    try {
      const data = await api.get('/api/v1/debts')
      items.value = data
    } catch (err) {
      console.error('Failed to fetch debts:', err)
    }
  }

  const totalBalance = computed(() =>
    items.value.reduce((sum, d) => sum + d.balance, 0)
  )

  const totalOriginalAmount = computed(() =>
    // Default fallback to balance if originalAmount is missing in schema rows
    items.value.reduce((sum, d) => sum + (d.originalAmount ?? d.balance), 0)
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

  async function addDebt(data) {
    try {
      const newDebt = await api.post('/api/v1/debts', {
        name: data.name,
        balance: parseFloat(data.balance ?? data.originalAmount),
        apr: parseFloat(data.apr || 0),
        minimumPayment: parseFloat(data.minimumPayment || 0),
        dueDay: parseInt(data.dueDay || 15)
      })
      items.value.push(newDebt)

      const scoreStore = useScoreStore()
      scoreStore.recalculate()

      return newDebt
    } catch (err) {
      console.error('Failed to add debt:', err)
      throw err
    }
  }

  async function updateDebt(id, data) {
    try {
      const updated = await api.put(`/api/v1/debts/${id}`, {
        name: data.name,
        balance: data.balance != null ? parseFloat(data.balance) : undefined,
        apr: data.apr != null ? parseFloat(data.apr) : undefined,
        minimumPayment: data.minimumPayment != null ? parseFloat(data.minimumPayment) : undefined,
        dueDay: data.dueDay != null ? parseInt(data.dueDay) : undefined
      })
      
      const idx = items.value.findIndex(d => d.id === id)
      if (idx !== -1) {
        items.value[idx] = updated
      }

      const scoreStore = useScoreStore()
      scoreStore.recalculate()

      return updated
    } catch (err) {
      console.error('Failed to update debt:', err)
      throw err
    }
  }

  async function deleteDebt(id) {
    try {
      await api.delete(`/api/v1/debts/${id}`)
      items.value = items.value.filter(d => d.id !== id)

      const scoreStore = useScoreStore()
      scoreStore.recalculate()
    } catch (err) {
      console.error('Failed to delete debt:', err)
      throw err
    }
  }

  async function recordPayment(id, amount) {
    try {
      const res = await api.post(`/api/v1/debts/${id}/payments`, { amount })
      
      const idx = items.value.findIndex(d => d.id === id)
      if (idx !== -1) {
        items.value[idx].balance = res.balance
        items.value[idx].onTimeStreak = res.onTimeStreak
      }

      const scoreStore = useScoreStore()
      scoreStore.recalculate()

      return items.value[idx]
    } catch (err) {
      console.error('Failed to record payment:', err)
      throw err
    }
  }

  return {
    items,
    totalBalance,
    totalOriginalAmount,
    totalMinimumPayment,
    weightedApr,
    fetchDebts,
    addDebt,
    updateDebt,
    deleteDebt,
    recordPayment
  }
})
