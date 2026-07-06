import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useScoreStore } from '~/stores/score'

export const useBudgetStore = defineStore('budget', () => {
  const categories = ref([])
  const api = useApi()

  async function fetchBudgets(month = null) {
    try {
      const url = month ? `/api/v1/budgets?month=${month}` : '/api/v1/budgets'
      const data = await api.get(url)
      categories.value = data
    } catch (err) {
      console.error('Failed to fetch budgets:', err)
    }
  }

  async function updateBudget(cats, month = null) {
    try {
      for (const cat of cats) {
        await api.put('/api/v1/budgets', {
          category: cat.category,
          limitAmount: cat.limitAmount,
          month
        })
      }
      await fetchBudgets(month)
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
      
      return categories.value
    } catch (err) {
      console.error('Failed to update budgets:', err)
      throw err
    }
  }

  async function addCategory(categoryName, limit, month = null) {
    const trimmed = categoryName.trim()
    if (!trimmed) return false
    if (categories.value.some(c => c.category.toLowerCase() === trimmed.toLowerCase())) {
      return false
    }
    
    try {
      await api.put('/api/v1/budgets', {
        category: trimmed,
        limitAmount: parseFloat(limit || 0),
        month
      })
      await fetchBudgets(month)
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
      
      return true
    } catch (err) {
      console.error('Failed to add category:', err)
      return false
    }
  }

  async function deleteCategory(categoryName, month = null) {
    try {
      await api.delete(`/api/v1/budgets/${encodeURIComponent(categoryName)}?month=${month || ''}`)
      categories.value = categories.value.filter(c => c.category !== categoryName)
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
    } catch (err) {
      console.error('Failed to delete category:', err)
      throw err
    }
  }

  async function editCategory(oldName, newName, limit, month = null) {
    const trimmedNewName = newName.trim()
    if (!trimmedNewName) return

    try {
      // If name changed, delete old and create new. Else just update limit.
      if (oldName !== trimmedNewName) {
        await api.delete(`/api/v1/budgets/${encodeURIComponent(oldName)}?month=${month || ''}`)
      }
      await api.put('/api/v1/budgets', {
        category: trimmedNewName,
        limitAmount: parseFloat(limit || 0),
        month
      })
      await fetchBudgets(month)
      
      const scoreStore = useScoreStore()
      scoreStore.recalculate()
    } catch (err) {
      console.error('Failed to edit category:', err)
    }
  }

  return {
    categories,
    fetchBudgets,
    updateBudget,
    addCategory,
    deleteCategory,
    editCategory
  }
})
