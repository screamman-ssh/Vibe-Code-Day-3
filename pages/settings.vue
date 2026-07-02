<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useAuthStore, useUsageStore } from '#imports'
import { useI18n } from 'vue-i18n'
import { 
  User, 
  Sparkles, 
  LogOut, 
  CheckCircle, 
  ShieldCheck, 
  KeyRound,
  Globe
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const usageStore = useUsageStore()
const { locale, t } = useI18n()

const user = computed(() => authStore.user || { displayName: '', subscriptionTier: 'free', emergencyFundAmount: 0 })

const displayName = ref(user.value.displayName)
const avatarUrl = ref(user.value.avatarUrl)
const emergencyFundAmount = ref(user.value.emergencyFundAmount)
const apiKey = ref('')
const currentLocale = ref(locale.value)

const error = ref('')
const success = ref('')

onMounted(() => {
  if (typeof window !== 'undefined') {
    apiKey.value = localStorage.getItem('openai_api_key') || ''
  }
})

const isPremium = computed(() => usageStore.tier === 'premium')

function handleLanguageChange() {
  locale.value = currentLocale.value
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', currentLocale.value)
  }
}

function handleSave() {
  error.value = ''
  success.value = ''

  if (!displayName.value.trim()) {
    error.value = t('settings.enterDisplayName')
    return
  }

  // Update user store state
  authStore.user.displayName = displayName.value.trim()
  authStore.user.avatarUrl = avatarUrl.value
  authStore.user.emergencyFundAmount = parseFloat(emergencyFundAmount.value || 0)

  if (typeof window !== 'undefined') {
    localStorage.setItem('openai_api_key', apiKey.value.trim())
    localStorage.setItem('user', JSON.stringify(authStore.user)) // Sync to local storage
  }

  success.value = t('settings.saveSuccess')
  setTimeout(() => {
    success.value = ''
  }, 2500)
}

function handleUpgrade() {
  usageStore.unlockPremium()
  authStore.user.subscriptionTier = 'premium'
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(authStore.user))
  }
}

function handleLogout() {
  if (confirm(t('shell.logoutConfirm'))) {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="page-shell">
    
    <!-- Header -->
    <div class="py-2">
      <h1 class="page-title">{{ $t('settings.title') }}</h1>
      <p class="page-lead">{{ $t('settings.lead') }}</p>
    </div>

    <!-- Language Selector Card -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-2">
        <Globe class="w-4 h-4 text-primary" />
        <span>{{ $t('settings.langSelect') }}</span>
      </h3>
      
      <div class="space-y-1">
        <select 
          v-model="currentLocale" 
          @change="handleLanguageChange"
          class="input-field bg-slate-50 border border-slate-200"
        >
          <option value="th">{{ $t('settings.langTh') }}</option>
          <option value="en">{{ $t('settings.langEn') }}</option>
        </select>
      </div>
    </div>

    <!-- Personal profile form -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">{{ $t('settings.personalInfo') }}</h3>

      <div class="flex items-center justify-center py-2">
        <img 
          :src="avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
          class="w-16 h-16 rounded-full border border-border-subtle bg-slate-50" 
        />
      </div>

      <div class="space-y-3">
        <!-- Display Name -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.displayName') }}</label>
          <input 
            v-model="displayName"
            type="text" 
            class="input-field bg-slate-50 border border-slate-200"
          />
        </div>

        <!-- Avatar URL -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.avatarUrl') }}</label>
          <input 
            v-model="avatarUrl"
            type="text" 
            class="input-field bg-slate-50 border border-slate-200"
          />
        </div>

        <!-- Emergency Fund Amount -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.emergencyFund') }}</label>
          <input 
            v-model="emergencyFundAmount"
            type="number" 
            placeholder="0"
            class="input-field bg-slate-50 border border-slate-200"
          />
          <span class="text-[10px] text-ink-muted leading-relaxed block mt-1">
            {{ $t('settings.emergencyFundHint') }}
          </span>
        </div>
      </div>

      <span v-if="error" class="text-xs font-semibold text-tier-risk block">{{ error }}</span>
      <span v-if="success" class="text-xs font-semibold text-accent-emerald block flex items-center gap-1">
        <CheckCircle class="w-4 h-4 fill-emerald-50" />
        {{ success }}
      </span>

      <button 
        @click="handleSave"
        class="btn-primary w-full justify-center text-sm cursor-pointer"
      >
        {{ $t('settings.save') }}
      </button>
    </div>

    <!-- AI Settings Card -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-2">
        <KeyRound class="w-4 h-4 text-primary" />
        <span>{{ $t('settings.aiSettings') }}</span>
      </h3>
      
      <div class="space-y-1">
        <label class="field-label font-bold text-ink">{{ $t('settings.apiKey') }}</label>
        <input 
          v-model="apiKey"
          type="password"
          placeholder="Bearer API Key (ตัวอย่าง: sk-proj-...)"
          class="input-field bg-slate-50 border border-slate-200"
        />
        <span class="text-[10px] text-ink-muted leading-relaxed block mt-1">
          {{ $t('settings.apiKeyHint') }}
        </span>
      </div>
    </div>

    <!-- Membership Details -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">{{ $t('settings.membership') }}</h3>

      <div class="flex justify-between items-center bg-slate-50 border border-border-subtle p-3.5 rounded-xl text-xs">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] text-ink-muted leading-none">{{ $t('settings.currentPackage') }}</span>
          <span class="text-sm font-bold text-ink mt-1 flex items-center gap-1.5">
            {{ isPremium ? $t('dashboard.premium') : $t('dashboard.free') }}
            <Sparkles v-if="isPremium" class="w-4 h-4 text-amber-500 fill-amber-500" />
          </span>
        </div>

        <button 
          v-if="!isPremium"
          @click="handleUpgrade"
          class="btn-primary min-h-0 py-1.5 px-3 rounded-full text-[10px] bg-amber-500 hover:bg-amber-600 border border-amber-500/20 cursor-pointer"
        >
          {{ $t('settings.upgradeBtn') }}
        </button>
        <span 
          v-else
          class="chip bg-emerald-50 text-accent-emerald border-emerald-100 font-bold text-[9px]"
        >
          {{ $t('settings.lifetimeActive') }}
        </span>
      </div>

      <!-- OCR Quota status -->
      <div class="flex justify-between items-center text-xs pl-1">
        <span class="text-ink-muted">{{ $t('settings.ocrQuota') }}</span>
        <span class="font-bold text-ink">{{ usageStore.ocrUsedToday }} / {{ usageStore.ocrLimit }} {{ $t('settings.quotaSuffix') }}</span>
      </div>
    </div>

    <!-- Legal disclaimer notice -->
    <div class="surface-card-sm bg-slate-50 border border-border-subtle flex items-start gap-2 text-[10px] leading-relaxed text-ink-muted">
      <ShieldCheck class="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div>
        {{ $t('settings.disclaimer') }}
      </div>
    </div>

    <!-- Log out action -->
    <button 
      @click="handleLogout"
      class="btn-secondary w-full justify-center gap-2 text-xs py-2 min-h-10 text-tier-risk hover:bg-red-50 hover:text-tier-risk cursor-pointer"
    >
      <LogOut class="w-4 h-4" />
      <span>{{ $t('settings.logoutBtn') }}</span>
    </button>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
