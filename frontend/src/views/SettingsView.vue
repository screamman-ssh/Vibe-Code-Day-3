<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { User, Star, Info, Camera, PieChart } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useUsageStore } from '../stores/usage'
import { api } from '../api'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const usageStore = useUsageStore()

const displayName = ref('')
const emergencyFund = ref(0)
const tier = ref('free')

onMounted(async () => {
  displayName.value = auth.user?.displayName ?? ''
  emergencyFund.value = auth.user?.emergencyFundAmount ?? 0
  tier.value = auth.user?.subscriptionTier ?? 'free'
  await usageStore.fetch()
})

async function saveProfile() {
  await api.updateProfile({
    displayName: displayName.value,
    emergencyFundAmount: emergencyFund.value,
    subscriptionTier: tier.value,
  })
  await auth.refresh()
  await usageStore.fetch()
}

function resetDemo() {
  if (!confirm(t('settings.resetConfirm'))) return
  api.resetDemo()
  auth.logout()
  router.push('/login')
}

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="page-shell text-ink">
    <header>
      <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
        {{ t('settings.title') }}
      </h1>
    </header>

    <div class="grid grid-cols-2 gap-3">
      <button type="button" class="tile-pastel tile-pastel--sky" @click="router.push('/budget')">
        <PieChart class="h-5 w-5 text-tier-steady" aria-hidden="true" />
        <p class="tile-label">{{ t('budget.title') }}</p>
      </button>
      <button type="button" class="tile-pastel tile-pastel--teal" @click="router.push('/scan')">
        <Camera class="h-5 w-5 text-primary" aria-hidden="true" />
        <p class="tile-label">{{ t('scan.title') }}</p>
      </button>
    </div>

    <section class="surface-soft space-y-4">
      <h2 class="section-title flex items-center gap-2">
        <User class="h-4 w-4 text-ink-muted" aria-hidden="true" />
        {{ t('settings.profile') }}
      </h2>

      <div class="space-y-3">
        <div>
          <label class="field-label">{{ t('settings.displayName') }}</label>
          <input v-model="displayName" class="input-field" />
        </div>
        <div>
          <label class="field-label">{{ t('settings.emergencyFund') }}</label>
          <input v-model.number="emergencyFund" type="number" class="input-field" />
        </div>
        <button type="button" class="btn-primary w-full" @click="saveProfile">
          {{ t('transactions.save') }}
        </button>
      </div>
    </section>

    <section class="surface-soft space-y-4">
      <h2 class="section-title flex items-center gap-2">
        <Star class="h-4 w-4 text-tier-building" aria-hidden="true" />
        {{ t('settings.tier') }}
      </h2>
      <p class="meta-label leading-relaxed">{{ t('settings.premiumNote') }}</p>

      <div class="tab-switch">
        <button
          type="button"
          class="tab-switch-btn"
          :class="tier === 'free' ? 'bg-ink text-white' : 'tab-switch-btn--inactive'"
          @click="tier = 'free'; saveProfile()"
        >
          {{ t('settings.free') }}
        </button>
        <button
          type="button"
          class="tab-switch-btn"
          :class="tier === 'premium' ? 'bg-tier-building text-amber-950' : 'tab-switch-btn--inactive'"
          @click="tier = 'premium'; saveProfile()"
        >
          {{ t('settings.premium') }}
        </button>
      </div>

      <div
        v-if="usageStore.usage"
        class="flex items-center justify-between rounded-xl px-4 py-3 text-sm"
        style="background: color-mix(in oklch, var(--color-accent-emerald) 10%, white)"
      >
        <span class="font-medium text-ink-muted">{{ t('settings.usage') }}</span>
        <span class="font-semibold text-accent-emerald tabular-nums">
          {{ usageStore.usage.ocrUsedToday }} / {{ usageStore.usage.ocrLimit }}
        </span>
      </div>
    </section>

    <section class="surface-soft space-y-4">
      <p class="meta-label flex gap-2 leading-relaxed">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        {{ t('settings.disclaimer') }}
      </p>

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="btn-secondary border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          @click="resetDemo"
        >
          {{ t('settings.reset') }}
        </button>
        <button type="button" class="btn-secondary" @click="logout">
          {{ t('settings.logout') }}
        </button>
      </div>
    </section>
  </div>
</template>
