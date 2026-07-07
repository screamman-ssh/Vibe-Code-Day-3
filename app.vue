<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from '#imports'
import { useAuthStore } from './stores/auth'
import { useTransactionsStore } from './stores/transactions'
import { useBudgetStore } from './stores/budget'
import { useDebtsStore } from './stores/debts'
import { useGroupStore } from './stores/group'
import { useSocialStore } from './stores/social'
import { useScoreStore } from './stores/score'
import { useTheme } from './composables/useTheme'
import AppShell from './components/layout/AppShell.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import PwaPrompt from './components/PwaPrompt.vue'

const route = useRoute()
const auth = useAuthStore()

const txStore = useTransactionsStore()
const budgetStore = useBudgetStore()
const debtsStore = useDebtsStore()
const groupStore = useGroupStore()
const socialStore = useSocialStore()
const scoreStore = useScoreStore()

const { initTheme, applyTheme } = useTheme()

// Initialize theme
initTheme()

async function fetchAllUserData() {
  if (auth.isLoggedIn) {
    await Promise.allSettled([
      txStore.fetchTransactions(),
      budgetStore.fetchBudgets(),
      debtsStore.fetchDebts(),
      groupStore.fetchGroupDetails(),
      socialStore.fetchFeed(),
      scoreStore.fetchScore()
    ])
  }
}

onMounted(() => {
  fetchAllUserData()

  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const savedTheme = localStorage.getItem('theme') || 'light'
      if (savedTheme === 'system') {
        applyTheme()
      }
    }
    mediaQuery.addEventListener('change', handler)
  }
})

// Fetch when logged in, clear stores on logout
watch(() => auth.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    fetchAllUserData()
  } else {
    txStore.items = []
    budgetStore.categories = []
    debtsStore.items = []
    groupStore.currentGroup = null
    groupStore.leaderboard = []
    groupStore.feedEvents = []
    socialStore.reset()
    scoreStore.currentScore = {
      totalScore: 50,
      tier: 'Building',
      tierTh: 'กำลังสร้าง',
      streakDays: 0,
      dimensions: []
    }
  }
})

const showShell = computed(() => {
  return auth.isLoggedIn && route.path !== '/login' && route.path !== '/onboarding'
})
</script>

<template>
  <div id="app">
    <NuxtPwaManifest />
    <PwaPrompt />
    <ConfirmDialog />
    <AppShell v-if="showShell" :show-nav="true">
      <NuxtPage />
    </AppShell>
    <div v-else class="min-h-screen w-full">
      <NuxtPage />
    </div>
  </div>
</template>
