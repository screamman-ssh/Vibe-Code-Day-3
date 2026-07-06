import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useScoreStore } from '~/stores/score'

export const useTransactionsStore = defineStore('transactions', () => {
  const items = ref([])
  const api = useApi()

  async function fetchTransactions() {
    try {
      const txs = await api.get('/api/v1/transactions')
      items.value = txs
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
    }
  }

  async function createTransaction(data) {
    try {
      const newTx = await api.post('/api/v1/transactions', data)
      items.value.unshift(newTx)
      
      // Trigger score recalculation in the background
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
      
      return newTx
    } catch (err) {
      console.error('Failed to create transaction:', err)
      throw err
    }
  }

  async function updateTransaction(id, data) {
    try {
      const updatedTx = await api.put(`/api/v1/transactions/${id}`, data)
      const idx = items.value.findIndex(t => t.id === id)
      if (idx !== -1) {
        items.value[idx] = updatedTx
      }
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
      
      return updatedTx
    } catch (err) {
      console.error('Failed to update transaction:', err)
      throw err
    }
  }

  async function deleteTransaction(id) {
    try {
      await api.delete(`/api/v1/transactions/${id}`)
      items.value = items.value.filter(t => t.id !== id)
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      throw err
    }
  }

  return {
    items,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
  }
})
