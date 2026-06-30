import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'
import { useScoreStore } from './score'

export const useTransactionStore = defineStore('transactions', () => {
  const items = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      items.value = await api.getTransactions()
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const { transaction, score } = await api.createTransaction(data)
    items.value.unshift(transaction)
    if (score) useScoreStore().setScore(score)
    return transaction
  }

  async function update(id, data) {
    const { transaction, score } = await api.updateTransaction(id, data)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = transaction
    if (score) useScoreStore().setScore(score)
    return transaction
  }

  async function remove(id) {
    const { score } = await api.deleteTransaction(id)
    items.value = items.value.filter((t) => t.id !== id)
    if (score) useScoreStore().setScore(score)
  }

  return { items, loading, fetchAll, create, update, remove }
})
