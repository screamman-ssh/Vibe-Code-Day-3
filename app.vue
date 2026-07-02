<script setup>
import { computed } from 'vue'
import { useRoute } from '#imports'
import { useAuthStore } from './stores/auth'
import AppShell from './components/layout/AppShell.vue'

const route = useRoute()
const auth = useAuthStore()

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
