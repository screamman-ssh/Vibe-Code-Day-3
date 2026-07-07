<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useI18n } from 'vue-i18n'
import { confirmDialog } from '~/composables/useConfirmDialog'
import BottomNav from './BottomNav.vue'
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Wallet,
  Users,
  Globe,
  Settings,
  LogOut,
  Sparkles,
  LayoutGrid
} from 'lucide-vue-next'

defineProps({
  showNav: {
    type: Boolean,
    default: true,
  }
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const user = computed(() => authStore.user || { displayName: 'ผู้ใช้', avatarUrl: '', subscriptionTier: 'free' })
const activePath = computed(() => route.path)
const isChatPage = computed(() => route.path === '/chat')

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/hub', labelKey: 'nav.hub', icon: LayoutGrid },
  { path: '/tracker', labelKey: 'nav.tracker', icon: Receipt },
  { path: '/budget', labelKey: 'nav.budget', icon: PiggyBank },
  { path: '/debts', labelKey: 'nav.debts', icon: Wallet },
  { path: '/chat', labelKey: 'nav.chat', icon: Sparkles },
  { path: '/circle', labelKey: 'nav.circle', icon: Users },
  { path: '/social', labelKey: 'nav.social', icon: Globe },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings },
]

function navigate(path) {
  router.push(path)
}

async function handleLogout() {
  const ok = await confirmDialog(t('shell.logoutConfirm'), { variant: 'danger' })
  if (ok) {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg text-ink flex flex-col md:flex-row antialiased">
    
    <!-- Desktop Left Sidebar -->
    <aside 
      v-if="showNav"
      class="hidden md:flex sticky top-0 h-screen w-64 bg-surface-card border-r border-border-subtle p-6 flex-col justify-between z-40 shrink-0"
    >
      <div class="space-y-6">
        <!-- Brand logo -->
        <div class="px-2">
          <h1 class="text-2xl font-black font-brand text-primary tracking-tight">MoneyCircle</h1>
          <span class="text-micro font-black text-ink-muted uppercase tracking-wider block mt-1">
            Score your habits, not your wealth
          </span>
        </div>

        <!-- Navigation list -->
        <nav class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.path"
            @click="navigate(item.path)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer focus:outline-none"
            :class="(item.path === '/social' ? activePath.startsWith('/social') : activePath === item.path)
              ? 'bg-accent-emerald/10 text-accent-emerald' 
              : 'text-ink-muted hover:text-ink hover:bg-surface-bg'"
          >
            <component :is="item.icon" class="w-4 h-4 shrink-0" :stroke-width="(item.path === '/social' ? activePath.startsWith('/social') : activePath === item.path) ? 2.5 : 2" />
            <span class="font-brand">{{ $t(item.labelKey) }}</span>
          </button>
        </nav>
      </div>

      <!-- Bottom User details + logout -->
      <div class="space-y-4 pt-4 border-t border-border-subtle">
        <div class="flex items-center gap-3 px-2">
          <img 
            :src="user.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
            class="w-9 h-9 rounded-full border border-border-subtle bg-slate-50 shrink-0" 
          />
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-bold text-ink truncate flex items-center gap-1">
              {{ user.displayName }}
              <Sparkles v-if="user.subscriptionTier === 'premium'" class="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
            </span>
            <span class="text-micro text-ink-muted uppercase leading-none mt-1">
              {{ user.subscriptionTier === 'premium' ? $t('shell.premiumMember') : $t('shell.freeAccount') }}
            </span>
          </div>
        </div>

        <button 
          @click="handleLogout"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-tier-risk hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer text-left focus:outline-none"
        >
          <LogOut class="w-4 h-4 shrink-0" />
          <span class="font-brand">{{ $t('nav.logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- Main content container -->
    <main 
      class="flex-1 min-w-0 px-4 md:px-8 pt-3 md:pt-5 relative"
      :class="isChatPage ? 'pb-0 md:pb-6' : 'pb-20 md:pb-6'"
    >
      <div class="max-w-5xl mx-auto w-full">
        <slot />
      </div>
    </main>

    <!-- Bottom Navigation (Mobile Only) -->
    <BottomNav v-if="showNav" />
  </div>
</template>

<style scoped>
/* Disable tap highlighting on iOS */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>
