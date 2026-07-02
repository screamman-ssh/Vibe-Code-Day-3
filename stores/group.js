import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGroupStore = defineStore('group', () => {
  const currentGroup = ref({
    id: 'group-123',
    name: 'สมาคมคนรักการออม',
    inviteCode: 'DEMO01',
    maxMembers: 15,
    membersCount: 4
  })

  const leaderboard = ref([
    { rank: 1, displayName: 'Nune', score: 72, tier: 'Steady', tierTh: 'มั่นคง', badges: ['Week Warrior', 'Budget Boss'], streakDays: 12, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nune' },
    { rank: 2, displayName: 'Boss', score: 68, tier: 'Steady', tierTh: 'มั่นคง', badges: ['First Log', 'Emergency Ready'], streakDays: 8, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boss' },
    { rank: 3, displayName: 'Peak', score: 54, tier: 'Building', tierTh: 'กำลังสร้าง', badges: ['First Log'], streakDays: 3, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=peak' },
    { rank: 4, displayName: 'Jane', score: 48, tier: 'Building', tierTh: 'กำลังสร้าง', badges: ['First Log'], streakDays: 1, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane' }
  ])

  const feedEvents = ref([
    {
      id: 'feed-1',
      userId: 'user-peak',
      displayName: 'Peak',
      eventType: 'challenge_completed',
      payload: { challenge_name: 'บันทึกค่าใช้จ่ายครบ 5 ครั้ง' },
      createdAt: new Date().toISOString(),
      reactions: { '👍': 3, '🎉': 2 }
    },
    {
      id: 'feed-2',
      userId: 'user-boss',
      displayName: 'Boss',
      eventType: 'score_changed',
      payload: { previous_score: 65, new_score: 68, tier: 'Steady' },
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      reactions: { '👏': 2 }
    },
    {
      id: 'feed-3',
      userId: 'user-nune',
      displayName: 'Nune',
      eventType: 'badge_earned',
      payload: { badge_code: 'BUDGET_BOSS', badge_name: 'Budget Boss' },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      reactions: { '🎉': 4, '❤️': 2 }
    }
  ])

  function reactToEvent(eventId, emoji) {
    const event = feedEvents.value.find(e => e.id === eventId)
    if (event) {
      event.reactions[emoji] = (event.reactions[emoji] || 0) + 1
    }
  }

  function createGroup(name) {
    currentGroup.value = {
      id: `group-${Date.now()}`,
      name: name || 'กลุ่มใหม่',
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      maxMembers: 15,
      membersCount: 1
    }
    return currentGroup.value
  }

  function joinGroupByCode(code) {
    if (code.toUpperCase() === 'DEMO01') {
      currentGroup.value = {
        id: 'group-123',
        name: 'สมาคมคนรักการออม',
        inviteCode: 'DEMO01',
        maxMembers: 15,
        membersCount: 4
      }
      return currentGroup.value
    }
    throw new Error('ไม่พบรหัสกลุ่มนี้ในระบบ')
  }

  return {
    currentGroup,
    leaderboard,
    feedEvents,
    reactToEvent,
    createGroup,
    joinGroupByCode
  }
})
