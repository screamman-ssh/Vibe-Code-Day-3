<script setup>
import { useRoute, useRouter } from '#imports'
import {
  LayoutDashboard,
  Receipt,
  Globe,
  Sparkles,
  LayoutGrid
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const hubPaths = ['/hub', '/budget', '/debts', '/settings', '/social']

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/tracker', labelKey: 'nav.tracker', icon: Receipt },
  { path: '/chat', labelKey: 'nav.chat', icon: Sparkles },
  { path: '/hub', labelKey: 'nav.hub', icon: LayoutGrid },
  { path: '/social', labelKey: 'nav.social', icon: Globe },
]

function isActive(path) {
  if (path === '/hub') return hubPaths.includes(route.path) && route.path !== '/social'
  if (path === '/social') return route.path.startsWith('/social')
  return route.path === path
}

function navigate(path) {
  router.push(path)
}
</script>

<template>
  <nav class="md:hidden fixed bottom-4 left-4 right-4 z-50 bg-surface-card/95 backdrop-blur-md border border-border-subtle rounded-full px-6 py-2 nav-float flex justify-between items-center max-w-lg mx-auto">
    <button
      v-for="item in navItems"
      :key="item.path"
      @click="navigate(item.path)"
      class="nav-item flex flex-col items-center justify-center gap-1 cursor-pointer py-1 flex-1 relative group focus:outline-none"
      :class="isActive(item.path) ? 'text-accent-emerald' : 'text-ink-muted hover:text-ink'"
    >
      <div 
        class="p-2 rounded-full transition-colors duration-200"
        :class="isActive(item.path) ? 'bg-accent-emerald/10' : 'group-hover:bg-surface-bg'"
      >
        <component :is="item.icon" class="w-5 h-5" :stroke-width="isActive(item.path) ? 2.5 : 2" />
      </div>
      <span class="text-caption font-semibold font-brand leading-none">
        {{ $t(item.labelKey) }}
      </span>
      <div 
        v-if="isActive(item.path)"
        class="absolute -bottom-1 w-1 h-1 bg-accent-emerald rounded-full"
      />
    </button>
  </nav>
</template>

<style scoped>
.nav-item {
  -webkit-tap-highlight-color: transparent;
}
</style>
