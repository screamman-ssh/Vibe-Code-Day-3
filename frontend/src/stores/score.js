import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useScoreStore = defineStore('score', () => {
  const score = ref(null)
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    try {
      score.value = await api.getScore()
    } finally {
      loading.value = false
    }
  }

  function setScore(s) {
    score.value = s
  }

  return { score, loading, fetch, setScore }
})
