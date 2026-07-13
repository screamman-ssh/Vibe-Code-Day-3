import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'

export const useGroupStore = defineStore('group', () => {
  const currentGroup = ref(null)
  const leaderboard = ref([])
  const feedEvents = ref([])
  const api = useApi()

  async function fetchGroupDetails() {
    try {
      const data = await api.get('/api/v1/group')
      currentGroup.value = data.group
      leaderboard.value = data.leaderboard
      feedEvents.value = data.feedEvents
    } catch (err) {
      console.error('Failed to fetch group details:', err)
    }
  }

  async function reactToEvent(eventId, emoji) {
    try {
      const res = await api.post(`/api/v1/group/feed/${eventId}/react`, { emoji })
      const event = feedEvents.value.find(e => e.id === eventId)
      if (event) {
        event.reactions = res.reactions
      }
    } catch (err) {
      console.error('Failed to react to event:', err)
    }
  }

  async function createGroup(name) {
    try {
      const group = await api.post('/api/v1/group', { name })
      currentGroup.value = group
      await fetchGroupDetails()
      return group
    } catch (err) {
      console.error('Failed to create group:', err)
      throw err
    }
  }

  async function joinGroupByCode(code) {
    try {
      const group = await api.post('/api/v1/group/join', { inviteCode: code })
      currentGroup.value = group
      await fetchGroupDetails()
      return group
    } catch (err) {
      console.error('Failed to join group:', err)
      throw err
    }
  }

  async function leaveGroup() {
    try {
      await api.post('/api/v1/group/leave')
      currentGroup.value = null
      leaderboard.value = []
      feedEvents.value = []
      return { ok: true }
    } catch (err) {
      console.error('Failed to leave group:', err)
      throw err
    }
  }

  return {
    currentGroup,
    leaderboard,
    feedEvents,
    fetchGroupDetails,
    reactToEvent,
    createGroup,
    joinGroupByCode,
    leaveGroup
  }
})
