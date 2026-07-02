import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBudgetStore = defineStore('budget', () => {
  const categories = ref([
    { category: 'Food', limitAmount: 5000, spentAmount: 1450 },
    { category: 'Transport', limitAmount: 2000, spentAmount: 620 },
    { category: 'Housing', limitAmount: 10000, spentAmount: 10000 },
    { category: 'Utilities', limitAmount: 3000, spentAmount: 2100 },
    { category: 'Entertainment', limitAmount: 2500, spentAmount: 2200 },
    { category: 'Health', limitAmount: 1500, spentAmount: 0 },
    { category: 'Education', limitAmount: 2000, spentAmount: 0 },
    { category: 'Debt Payment', limitAmount: 5000, spentAmount: 3000 },
    { category: 'Savings', limitAmount: 5000, spentAmount: 1000 },
    { category: 'Other', limitAmount: 2000, spentAmount: 540 }
  ])

  function updateBudget(cats) {
    categories.value = categories.value.map(c => {
      const updated = cats.find(x => x.category === c.category)
      return updated ? { ...c, limitAmount: updated.limitAmount } : c
    })
    return categories.value
  }

  function addCategory(categoryName, limit) {
    const trimmed = categoryName.trim()
    if (!trimmed) return false
    if (categories.value.some(c => c.category.toLowerCase() === trimmed.toLowerCase())) {
      return false
    }
    categories.value.push({
      category: trimmed,
      limitAmount: parseFloat(limit || 0),
      spentAmount: 0
    })
    return true
  }

  function deleteCategory(categoryName) {
    categories.value = categories.value.filter(c => c.category !== categoryName)
  }

  function editCategory(oldName, newName, limit) {
    const trimmedNewName = newName.trim()
    if (!trimmedNewName) return
    categories.value = categories.value.map(c => {
      if (c.category === oldName) {
        return {
          ...c,
          category: trimmedNewName,
          limitAmount: parseFloat(limit || 0)
        }
      }
      return c
    })
  }

  return {
    categories,
    updateBudget,
    addCategory,
    deleteCategory,
    editCategory
  }
})
