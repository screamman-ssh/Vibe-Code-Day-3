<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from '#imports'
import { useAuthStore } from './stores/auth'
import { useTheme } from './composables/useTheme'
import AppShell from './components/layout/AppShell.vue'

const route = useRoute()
const auth = useAuthStore()

const { initTheme, applyTheme } = useTheme()

// Initialize theme
initTheme()

onMounted(() => {
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

const showShell = computed(() => {
  return auth.isLoggedIn && route.path !== '/login' && route.path !== '/onboarding'
})
</script>

<template>
  <div id="app">
    <AppShell v-if="showShell" :show-nav="true">
      <NuxtPage />
    </AppShell>
    <div v-else class="min-h-screen w-full">
      <NuxtPage />
    </div>
  </div>
</template>
