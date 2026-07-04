<script setup>
import { ref, computed } from 'vue'
import { useRouter, useAuthStore, useUsageStore } from '#imports'
import { useI18n } from 'vue-i18n'
import { 
  User, 
  Sparkles, 
  LogOut, 
  CheckCircle, 
  ShieldCheck, 
  Globe,
  Sun,
  Moon,
  Monitor
} from 'lucide-vue-next'
import { useTheme } from '~/composables/useTheme'

const router = useRouter()
const authStore = useAuthStore()
const usageStore = useUsageStore()
const { locale, t } = useI18n()

const { theme, setTheme } = useTheme()

const user = computed(() => authStore.user || { displayName: '', subscriptionTier: 'free', emergencyFundAmount: 0 })

const displayName = ref(user.value.displayName)
const avatarUrl = ref(user.value.avatarUrl)
const emergencyFundAmount = ref(user.value.emergencyFundAmount)
const currentLocale = ref(locale.value)

const error = ref('')
const success = ref('')

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
          class="input-field"
        >
          <option value="th">{{ $t('settings.langTh') }}</option>
          <option value="en">{{ $t('settings.langEn') }}</option>
        </select>
      </div>
    </div>

    <!-- Theme Selector Card -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-2">
        <Moon class="w-4 h-4 text-primary" />
        <span>{{ $t('settings.themeSelect') }}</span>
      </h3>
      
      <div class="flex gap-1.5 p-1 bg-surface-bg rounded-xl border-2 border-border-subtle">
        <button 
          v-for="mode in ['light', 'dark', 'system']" 
          :key="mode"
          @click="setTheme(mode)"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold cursor-pointer focus:outline-none"
          :class="theme === mode 
            ? 'bg-primary text-white' 
            : 'text-ink-muted hover:text-ink hover:bg-surface-card transition-colors'"
          :style="theme === mode ? 'box-shadow: 0 2px 0 #3f8f01' : ''"
        >
          <Sun v-if="mode === 'light'" class="w-4 h-4 shrink-0" />
          <Moon v-else-if="mode === 'dark'" class="w-4 h-4 shrink-0" />
          <Monitor v-else class="w-4 h-4 shrink-0" />
          <span class="font-brand">
            {{ mode === 'light' ? $t('settings.themeLight') : mode === 'dark' ? $t('settings.themeDark') : $t('settings.themeSystem') }}
          </span>
        </button>
      </div>
    </div>

    <!-- Personal profile form -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">{{ $t('settings.personalInfo') }}</h3>

      <div class="flex items-center justify-center py-2">
        <img 
          :src="avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
          class="w-16 h-16 rounded-full border border-border-subtle bg-surface-bg" 
        />
      </div>

      <div class="space-y-3">
        <!-- Display Name -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.displayName') }}</label>
          <input 
            v-model="displayName"
            type="text" 
            class="input-field"
          />
        </div>

        <!-- Avatar URL -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.avatarUrl') }}</label>
          <input 
            v-model="avatarUrl"
            type="text" 
            class="input-field"
          />
        </div>

        <!-- Emergency Fund Amount -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">{{ $t('settings.emergencyFund') }}</label>
          <input 
            v-model="emergencyFundAmount"
            type="number" 
            placeholder="0"
            class="input-field"
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


    <!-- Membership Details -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">{{ $t('settings.membership') }}</h3>

      <div class="flex justify-between items-center bg-surface-bg border border-border-subtle p-3.5 rounded-xl text-xs">
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
          class="chip bg-emerald-50 dark:bg-emerald-950/30 text-accent-emerald border-emerald-100 dark:border-emerald-900/30 font-bold text-[9px]"
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
    <div class="surface-card-sm bg-surface-bg border border-border-subtle flex items-start gap-2 text-[10px] leading-relaxed text-ink-muted">
      <ShieldCheck class="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div>
        {{ $t('settings.disclaimer') }}
      </div>
    </div>

    <!-- Log out action -->
    <button 
      @click="handleLogout"
      class="btn-secondary w-full justify-center gap-2 text-xs py-2 min-h-10 text-tier-risk hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-tier-risk cursor-pointer"
    >
      <LogOut class="w-4 h-4" />
      <span>{{ $t('settings.logoutBtn') }}</span>
    </button>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
