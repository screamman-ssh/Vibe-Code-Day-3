import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'
import { useScoreStore } from './score'

export const useBudgetStore = defineStore('budget', () => {
  const categories = ref([])
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    try {
      categories.value = await api.getBudget()
    } finally {
      loading.value = false
    }
  }

  async function save(updated) {
    const { budget, score } = await api.updateBudget(updated)
    categories.value = budget.map((cat) => {
      const existing = categories.value.find((c) => c.category === cat.category)
      return { ...cat, spentAmount: existing?.spentAmount ?? 0 }
    })
    await fetch()
    if (score) useScoreStore().setScore(score)
  }

  return { categories, loading, fetch, save }
})
