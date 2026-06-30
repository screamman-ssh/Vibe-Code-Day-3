import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useGroupStore = defineStore('group', () => {
  const group = ref(null)
  const leaderboard = ref([])
  const feed = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      group.value = await api.getGroup()
      leaderboard.value = await api.getLeaderboard()
      feed.value = await api.getFeed()
    } finally {
      loading.value = false
    }
  }

  return { group, leaderboard, feed, loading, fetchAll }
})
