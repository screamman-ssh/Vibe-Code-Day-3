<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import AppShell from './components/layout/AppShell.vue'

const route = useRoute()
const auth = useAuthStore()

const showShell = computed(() => {
  return auth.isLoggedIn && !route.meta.public && route.name !== 'onboarding' && route.name !== 'login'
})
</script>

<template>
  <AppShell v-if="showShell" :show-nav="true">
    <RouterView />
  </AppShell>
  <div v-else class="min-h-screen w-full">
    <RouterView />
  </div>
</template>
