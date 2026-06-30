<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Shield, Check, X } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const acknowledged = ref(false)
const tab = ref('join')
const groupName = ref('เพื่อนติวการเงิน')
const inviteCode = ref('DEMO01')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!acknowledged.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.completeOnboarding({
      action: tab.value,
      groupName: groupName.value,
      inviteCode: inviteCode.value,
    })
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg px-4 py-8 text-ink select-none flex flex-col justify-center">
    <div class="mx-auto max-w-md w-full surface-card space-y-6">
      <div class="text-center space-y-1.5">
        <Shield class="mx-auto h-10 w-10 text-accent-emerald" aria-hidden="true" />
        <h1 class="page-title">{{ t('onboarding.title') }}</h1>
        <p class="page-lead">มาทำความเข้าใจเกี่ยวกับความเป็นส่วนตัวการเงินของคุณกันก่อน</p>
      </div>

      <div class="space-y-3">
        <div class="surface-card-sm border-emerald-100 bg-emerald-50/40">
          <p class="font-semibold text-emerald-800 text-sm flex items-center gap-1.5">
            <Check class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t('onboarding.visible') }}
          </p>
          <p class="mt-1.5 text-xs text-emerald-700/80 leading-relaxed">{{ t('onboarding.visibleList') }}</p>
        </div>

        <div class="surface-card-sm border-rose-100 bg-rose-50/40">
          <p class="font-semibold text-rose-800 text-sm flex items-center gap-1.5">
            <X class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t('onboarding.hidden') }}
          </p>
          <p class="mt-1.5 text-xs text-rose-700/80 leading-relaxed">{{ t('onboarding.hiddenList') }}</p>
        </div>
      </div>

      <label class="flex items-center gap-3 cursor-pointer p-3 bg-surface-bg border border-border-subtle rounded-lg nav-item">
        <input
          v-model="acknowledged"
          type="checkbox"
          class="h-5 w-5 rounded border-slate-200 text-accent-emerald focus:ring-0 cursor-pointer"
        />
        <span class="text-sm font-medium text-ink select-none">{{ t('onboarding.acknowledge') }}</span>
      </label>

      <div v-if="acknowledged" class="space-y-4 pt-2 border-t border-border-subtle">
        <div class="tab-switch">
          <button
            type="button"
            class="tab-switch-btn"
            :class="tab === 'join' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
            @click="tab = 'join'"
          >
            {{ t('onboarding.joinGroup') }}
          </button>
          <button
            type="button"
            class="tab-switch-btn"
            :class="tab === 'create' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
            @click="tab = 'create'"
          >
            {{ t('onboarding.createGroup') }}
          </button>
        </div>

        <div v-if="tab === 'join'">
          <label class="field-label">{{ t('onboarding.inviteCode') }}</label>
          <input
            v-model="inviteCode"
            class="input-field uppercase font-semibold"
          />
          <p class="mt-1 text-xs text-ink-muted">{{ t('onboarding.inviteHint') }}</p>
        </div>

        <div v-else>
          <label class="field-label">{{ t('onboarding.groupName') }}</label>
          <input
            v-model="groupName"
            class="input-field"
          />
        </div>

        <p v-if="error" class="text-sm text-tier-risk bg-red-50 border border-red-100 p-2.5 rounded-lg">{{ error }}</p>

        <button
          type="button"
          class="btn-primary w-full"
          :disabled="loading"
          @click="submit"
        >
          {{ t('onboarding.continue') }}
        </button>
      </div>
    </div>
  </div>
</template>
