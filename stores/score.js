import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'

export const useScoreStore = defineStore('score', () => {
  const currentScore = ref({
    totalScore: 50,
    tier: 'Building',
    tierTh: 'กำลังสร้าง',
    streakDays: 0,
    dimensions: []
  })
  const api = useApi()

  async function fetchScore() {
    try {
      const score = await api.get('/api/v1/score')
      currentScore.value = score
    } catch (err) {
      console.error('Failed to fetch score:', err)
    }
  }

  async function recalculate() {
    try {
      const score = await api.post('/api/v1/score/recalculate')
      currentScore.value = score
      return score
    } catch (err) {
      console.error('Failed to recalculate score:', err)
    }
  }

  return {
    currentScore,
    fetchScore,
    recalculate
  }
})
