<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { User, Star, Info } from 'lucide-vue-next'
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
  <div class="space-y-6 text-ink select-none">
    <div>
      <h1 class="page-title">{{ t('settings.title') }}</h1>
      <p class="page-lead">จัดการข้อมูลโปรไฟล์ ความเป็นส่วนตัว และตั้งค่าแพ็กเกจการใช้งาน</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

      <section class="surface-card space-y-4">
        <h2 class="section-title text-sm flex items-center gap-2 border-b border-border-subtle pb-3">
          <User class="h-4 w-4 text-ink-muted" aria-hidden="true" />
          {{ t('settings.profile') }}
        </h2>

        <div class="space-y-3.5">
          <div>
            <label class="field-label">{{ t('settings.displayName') }}</label>
            <input v-model="displayName" class="input-field" />
          </div>
          <div>
            <label class="field-label">{{ t('settings.emergencyFund') }}</label>
            <input
              v-model.number="emergencyFund"
              type="number"
              class="input-field"
            />
          </div>
          <button
            type="button"
            class="btn-primary w-full mt-2"
            @click="saveProfile"
          >
            {{ t('transactions.save') }}
          </button>
        </div>
      </section>

      <section class="surface-card space-y-4">
        <h2 class="section-title text-sm flex items-center gap-2 border-b border-border-subtle pb-3">
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

        <div v-if="usageStore.usage" class="surface-card-sm bg-emerald-50/40 border-emerald-100 flex justify-between items-center text-sm">
          <span class="text-ink-muted font-medium">{{ t('settings.usage') }}</span>
          <span class="font-semibold text-accent-emerald">
            {{ usageStore.usage.ocrUsedToday }} / {{ usageStore.usage.ocrLimit }} ครั้ง
          </span>
        </div>
        <p class="meta-label text-right text-tier-building">
          {{ t('settings.comingSoon') }}
        </p>
      </section>
    </div>

    <div class="surface-card space-y-4">
      <p class="meta-label leading-relaxed bg-surface-bg p-4 rounded-lg border border-border-subtle flex gap-2">
        <Info class="h-4 w-4 shrink-0 text-ink-muted mt-0.5" aria-hidden="true" />
        {{ t('settings.disclaimer') }}
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          class="btn-secondary w-full border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          @click="resetDemo"
        >
          {{ t('settings.reset') }}
        </button>
        <button
          type="button"
          class="btn-secondary w-full"
          @click="logout"
        >
          {{ t('settings.logout') }}
        </button>
      </div>
    </div>
  </div>
</template>
