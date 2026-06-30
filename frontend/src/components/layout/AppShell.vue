<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Flame, Star } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAppNav, isNavActive } from '../../composables/useAppNav'
import BottomNav from './BottomNav.vue'

defineProps({
  showNav: { type: Boolean, default: true },
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const { sidebarTabs } = useAppNav()

const activeTab = computed(() =>
  sidebarTabs.value.find((tab) => isNavActive(route.path, tab.path)),
)

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg flex">
    <aside
      class="hidden md:flex w-64 bg-surface-card border-r border-border-subtle flex-col fixed inset-y-0 left-0 z-30 select-none"
      aria-label="Main navigation"
    >
      <div class="px-5 py-5 border-b border-border-subtle">
        <div class="flex items-center gap-2.5">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-surface-card"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </span>
          <span class="font-brand font-bold text-ink text-lg tracking-tight">MoneyCircle</span>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="App sections">
        <button
          v-for="tab in sidebarTabs"
          :key="tab.name"
          type="button"
          class="nav-item w-full flex items-center gap-3 px-3 py-2.5 min-h-11 text-sm font-bold rounded-lg cursor-pointer"
          :class="isNavActive(route.path, tab.path)
            ? 'bg-accent-emerald text-white'
            : 'text-ink-muted hover:bg-surface-bg hover:text-ink'"
          :aria-current="isNavActive(route.path, tab.path) ? 'page' : undefined"
          @click="router.push(tab.path)"
        >
          <component :is="tab.icon" class="h-5 w-5 shrink-0" :stroke-width="2" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <div v-if="auth.user" class="p-3 border-t border-border-subtle bg-surface-bg">
        <div class="flex items-center gap-3 mb-3 px-1">
          <div
            class="h-10 w-10 rounded-lg bg-accent-emerald flex items-center justify-center font-bold text-white text-base shrink-0"
            aria-hidden="true"
          >
            {{ auth.user.displayName?.charAt(0).toUpperCase() || 'U' }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-ink truncate leading-snug">{{ auth.user.displayName }}</p>
            <p class="text-xs text-streak-flame truncate font-semibold mt-0.5 flex items-center gap-1">
              <Flame class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{{ auth.user.loggingStreakDays ?? 0 }} {{ t('dashboard.days') }}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          class="nav-item w-full py-2.5 px-3 text-xs font-bold text-ink-muted hover:text-red-600 hover:bg-red-50 border border-border-subtle rounded-lg cursor-pointer"
          @click="logout"
        >
          {{ t('settings.logout') }}
        </button>
      </div>
    </aside>

    <div class="flex-1 md:pl-64 flex flex-col min-h-screen">
      <header
        class="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 md:px-6 md:py-3.5 flex items-center justify-between select-none"
      >
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="text-base font-bold text-ink md:block hidden tracking-tight truncate">
            {{ activeTab?.label || 'MoneyCircle' }}
          </h2>
          <div class="flex items-center gap-2 md:hidden min-w-0">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-surface-card"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="8" />
              </svg>
            </span>
            <h1 class="font-brand font-bold text-ink text-lg tracking-tight truncate">MoneyCircle</h1>
          </div>
        </div>

        <div v-if="auth.user" class="flex items-center gap-3 shrink-0">
          <div
            v-if="auth.user.subscriptionTier === 'premium'"
            class="flex items-center gap-1 bg-amber-100 border border-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-semibold"
          >
            <Star class="h-3 w-3" aria-hidden="true" />
            {{ t('settings.premium') }}
          </div>
          <p class="text-sm text-ink-muted md:block hidden">
            {{ t('dashboard.greeting') }},
            <strong class="text-ink font-bold">{{ auth.user.displayName }}</strong>
          </p>
        </div>
      </header>

      <main class="flex-1 px-4 py-6 md:px-8 max-w-6xl w-full mx-auto pb-24 md:pb-8">
        <slot />
      </main>

      <BottomNav v-if="showNav" class="md:hidden" />
    </div>
  </div>
</template>
