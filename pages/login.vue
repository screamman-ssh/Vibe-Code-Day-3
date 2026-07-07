<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useAuthStore, useRuntimeConfig } from '#imports'

const router = useRouter()
const authStore = useAuthStore()
const config = useRuntimeConfig()

const error = ref('')

onMounted(() => {
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: config.public.googleClientId,
        callback: handleGoogleCallback
      })
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', shape: 'pill', width: 380 }
      )
    }
  }
  document.head.appendChild(script)
})

async function handleGoogleCallback(response) {
  try {
    await authStore.loginWithGoogle(response.credential)
    router.push('/')
  } catch (err) {
    error.value = 'การเข้าสู่ระบบด้วย Google ล้มเหลว'
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-surface-card border-2 border-border-subtle rounded-xl p-8 space-y-6">
      
      <!-- Brand Header -->
      <div class="text-center space-y-2">
        <h1 class="text-3xl font-black font-brand text-primary tracking-tight">MoneyCircle</h1>
        <p class="text-xs font-semibold text-ink-muted leading-relaxed uppercase tracking-wider">
          Accountability with friends — score your habits, not your wealth
        </p>
      </div>

      <div class="border-t border-border-subtle" />

      <!-- Google SSO -->
      <div class="space-y-3">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider text-center">เข้าสู่ระบบด้วย Google</h3>
        <div class="flex justify-center w-full">
          <div id="google-signin-btn" class="w-full"></div>
        </div>
        <span v-if="error" class="text-xs font-semibold text-tier-risk block text-center">{{ error }}</span>
      </div>

      <!-- Disclaimer warning -->
      <div class="text-caption text-ink-muted text-center pt-2 leading-relaxed">
        *ข้อแนะนำทั้งหมดเป็นข้อมูลเพื่อการศึกษาทางการเงินเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Disable tap highlighting */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>
