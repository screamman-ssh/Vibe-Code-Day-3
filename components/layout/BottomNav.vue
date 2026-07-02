<script setup>
import { useRoute, useRouter } from '#imports'
import {
  LayoutDashboard,
  Receipt,
  Users,
  Sparkles,
  LayoutGrid
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const hubPaths = ['/hub', '/budget', '/debts', '/settings']

const navItems = [
  { path: '/', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { path: '/tracker', label: 'บันทึกเงิน', icon: Receipt },
  { path: '/chat', label: 'AI โค้ช', icon: Sparkles },
  { path: '/hub', label: 'เครื่องมือ', icon: LayoutGrid },
  { path: '/circle', label: 'กลุ่ม', icon: Users },
]

function isActive(path) {
  if (path === '/hub') return hubPaths.includes(route.path)
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
      <span class="text-[10px] font-semibold font-brand leading-none">
        {{ item.label }}
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
