<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAppNav, isNavActive } from '../../composables/useAppNav'

const route = useRoute()
const router = useRouter()
const { mobileTabs } = useAppNav()
</script>

<template>
  <div class="fixed bottom-0 inset-x-0 z-50 flex justify-center md:hidden select-none pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 pointer-events-none">
    <nav
      class="nav-float pointer-events-auto w-full max-w-md bg-surface-card border border-border-subtle rounded-full px-1.5 py-1.5 flex justify-around items-center"
      aria-label="Mobile navigation"
    >
      <button
        v-for="tab in mobileTabs"
        :key="tab.name"
        type="button"
        class="nav-item flex flex-col items-center justify-center rounded-full min-h-11 min-w-11 px-2 py-1.5 cursor-pointer"
        :class="isNavActive(route.path, tab.path)
          ? 'nav-item--active bg-accent-emerald text-white'
          : 'text-ink-muted hover:text-ink hover:bg-surface-bg'"
        :aria-label="tab.label"
        :aria-current="isNavActive(route.path, tab.path) ? 'page' : undefined"
        @click="router.push(tab.path)"
      >
        <component
          :is="tab.icon"
          class="h-5 w-5 shrink-0"
          :stroke-width="isNavActive(route.path, tab.path) ? 2.25 : 2"
          aria-hidden="true"
        />
        <span class="text-[11px] font-semibold leading-tight mt-0.5 max-w-[4rem] truncate text-center">
          {{ tab.label }}
        </span>
      </button>
    </nav>
  </div>
</template>
