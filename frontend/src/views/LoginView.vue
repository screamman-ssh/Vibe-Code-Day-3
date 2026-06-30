<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const guestName = ref('')
const loading = ref(false)

async function pick(persona) {
  loading.value = true
  try {
    await auth.loginAsPersona(persona)
    router.push(auth.needsOnboarding ? '/onboarding' : '/')
  } finally {
    loading.value = false
  }
}

async function guest() {
  if (!guestName.value.trim()) return
  loading.value = true
  try {
    await auth.loginAsGuest(guestName.value.trim())
    router.push('/onboarding')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col justify-center bg-primary px-6 py-12 text-white select-none">
    <div class="mx-auto w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <span
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white/15 text-white"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </span>
        <h1 class="font-brand text-3xl font-bold tracking-tight mt-2">{{ t('app.name') }}</h1>
        <p class="text-sm text-white/70 font-medium">{{ t('app.tagline') }}</p>
      </div>

      <div class="bg-surface-card rounded-lg border border-border-subtle p-6 space-y-4 text-ink">
        <div>
          <p class="text-sm font-semibold text-ink">{{ t('login.title') }}</p>
          <p class="text-xs text-ink-muted mt-0.5">{{ t('login.demoNote') }}</p>
        </div>

        <div class="space-y-3">
          <button
            type="button"
            class="btn-secondary w-full min-h-12 justify-start gap-3 p-3"
            :disabled="loading"
            @click="pick('nune')"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-base font-bold text-emerald-800">N</span>
            <div class="min-w-0 text-left">
              <p class="font-semibold text-sm text-ink">Nune</p>
              <p class="text-xs text-ink-muted mt-0.5 truncate">{{ t('login.nune') }}</p>
            </div>
          </button>

          <button
            type="button"
            class="btn-secondary w-full min-h-12 justify-start gap-3 p-3"
            :disabled="loading"
            @click="pick('boss')"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-base font-bold text-amber-900">B</span>
            <div class="min-w-0 text-left">
              <p class="font-semibold text-sm text-ink">Boss</p>
              <p class="text-xs text-ink-muted mt-0.5 truncate">{{ t('login.boss') }}</p>
            </div>
          </button>
        </div>

        <div class="relative flex items-center justify-center py-2">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-border-subtle"></div>
          </div>
          <span class="relative bg-surface-card px-3 text-xs font-medium text-ink-muted">หรือ</span>
        </div>

        <div class="space-y-3">
          <input
            v-model="guestName"
            type="text"
            :placeholder="t('login.guestPlaceholder')"
            class="input-field"
          />
          <button
            type="button"
            class="btn-primary w-full"
            :disabled="loading || !guestName.trim()"
            @click="guest"
          >
            {{ t('login.continueGuest') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
