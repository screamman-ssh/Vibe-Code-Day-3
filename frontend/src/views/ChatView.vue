<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Send, Star, FileText } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { api } from '../api'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()

const messages = ref([])
const draft = ref('')
const loading = ref(false)
const error = ref('')
const messagesEl = ref(null)

function pushMessage(role, text) {
  messages.value.push({
    id: `${Date.now()}-${messages.value.length}`,
    role,
    text,
  })
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

async function sendMessage(text) {
  const trimmed = (text ?? draft.value).trim()
  if (!trimmed || loading.value) return
  draft.value = ''
  error.value = ''
  pushMessage('user', trimmed)
  await scrollToBottom()

  loading.value = true
  try {
    const reply = await api.sendChatMessage(trimmed)
    pushMessage('assistant', reply)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function requestReport() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  pushMessage('user', t('chat.requestReport'))
  await scrollToBottom()
  try {
    const report = await api.getAiAnalysisReport()
    pushMessage('assistant', report)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function loadWelcome() {
  loading.value = true
  try {
    const tips = await api.getCoachTips()
    pushMessage('assistant', tips)
  } catch (err) {
    if (err.message?.includes('Premium') || err.message?.includes('พรีเมียม')) {
      error.value = t('common.premiumOnly')
    } else {
      error.value = err.message
    }
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function upgradeToPremium() {
  loading.value = true
  try {
    await api.updateProfile({ subscriptionTier: 'premium' })
    await auth.refresh()
    messages.value = []
    if (route.query.mode === 'report') {
      await requestReport()
    } else {
      await loadWelcome()
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (auth.user?.subscriptionTier !== 'premium') return
  if (route.query.mode === 'report') {
    await requestReport()
  } else {
    await loadWelcome()
  }
})
</script>

<template>
  <div class="text-ink">
    <header class="page-shell !pb-0">
      <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
        {{ t('chat.title') }}
      </h1>
      <p class="meta-label mt-1">{{ t('chat.subtitle') }}</p>
    </header>

    <div v-if="auth.user?.subscriptionTier !== 'premium'" class="page-shell">
      <div class="mission-card text-center">
        <div class="relative z-10 mx-auto max-w-sm space-y-4">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/60">
            <Star class="h-7 w-7 text-tier-building" aria-hidden="true" />
          </div>
          <div class="space-y-2">
            <h2 class="text-lg font-semibold text-ink">{{ t('chat.premiumTitle') }}</h2>
            <p class="text-sm text-ink-muted leading-relaxed">{{ t('chat.premiumBody') }}</p>
          </div>
          <button
            type="button"
            class="btn-primary w-full"
            :disabled="loading"
            @click="upgradeToPremium"
          >
            {{ loading ? t('common.loading') : t('chat.tryPremium') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="chat-shell px-4">
      <div ref="messagesEl" class="chat-messages" role="log" aria-live="polite">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-bubble"
          :class="msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'"
        >
          <p class="whitespace-pre-line">{{ msg.text }}</p>
        </div>

        <div v-if="loading" class="chat-bubble chat-bubble--assistant">
          <p class="text-ink-muted">{{ t('chat.typing') }}</p>
        </div>
      </div>

      <p v-if="error" class="mb-2 text-sm font-medium text-tier-risk" role="alert">{{ error }}</p>

      <div class="chat-input-bar">
        <button
          type="button"
          class="circle-teaser mb-3 !py-2.5"
          :disabled="loading"
          @click="requestReport"
        >
          <span class="flex items-center gap-2">
            <FileText class="h-4 w-4 text-primary" aria-hidden="true" />
            {{ t('chat.requestReport') }}
          </span>
        </button>

        <form class="flex gap-2" @submit.prevent="sendMessage()">
          <label class="sr-only" for="chat-input">{{ t('chat.placeholder') }}</label>
          <input
            id="chat-input"
            v-model="draft"
            type="text"
            class="input-field flex-1 bg-white"
            :placeholder="t('chat.placeholder')"
            :disabled="loading"
            autocomplete="off"
          />
          <button
            type="submit"
            class="btn-primary shrink-0 px-4"
            :disabled="loading || !draft.trim()"
            :aria-label="t('chat.send')"
          >
            <Send class="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <p class="meta-label mt-3 text-center text-xs leading-normal">
          {{ t('chat.disclaimer') }}
        </p>
      </div>
    </div>
  </div>
</template>
