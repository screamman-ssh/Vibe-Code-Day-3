import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTransactionsStore = defineStore('transactions', () => {
  const items = ref([
    {
      id: 'tx-1',
      type: 'expense',
      amount: 89,
      category: 'Food',
      merchant: '7-Eleven',
      note: 'ข้าวกล่องและน้ำดื่ม',
      date: new Date().toISOString().split('T')[0],
      source: 'ocr'
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 120,
      category: 'Transport',
      merchant: 'BTS',
      note: 'ค่าเดินทางไปทำงาน',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      source: 'manual'
    },
    {
      id: 'tx-3',
      type: 'expense',
      amount: 450,
      category: 'Entertainment',
      merchant: 'Major Cineplex',
      note: 'ตั๋วหนังและป๊อปคอร์น',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      source: 'manual'
    },
    {
      id: 'tx-4',
      type: 'income',
      amount: 28000,
      category: 'Other',
      merchant: 'บริษัทจำกัด',
      note: 'เงินเดือนประจำเดือน',
      date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      source: 'manual'
    }
  ])

  function createTransaction(data) {
    const newTx = {
      id: `tx-${Date.now()}`,
      ...data,
      source: data.source || 'manual'
    }
    items.value.unshift(newTx)
    return newTx
  }

  function updateTransaction(id, data) {
    const idx = items.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], ...data }
      return items.value[idx]
    }
    return null
  }

  function deleteTransaction(id) {
    items.value = items.value.filter(t => t.id !== id)
  }

  return {
    items,
    createTransaction,
    updateTransaction,
    deleteTransaction
  }
})
