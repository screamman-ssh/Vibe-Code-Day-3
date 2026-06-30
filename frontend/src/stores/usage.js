import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useUsageStore = defineStore('usage', () => {
  const usage = ref(null)

  async function fetch() {
    usage.value = await api.getUsage()
  }

  return { usage, fetch }
})
