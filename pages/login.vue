<script setup>
import { ref } from 'vue'
import { useRouter, useAuthStore } from '#imports'
import { LogIn, User } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const guestName = ref('')
const error = ref('')

function handlePersonaLogin(persona) {
  authStore.loginAsPersona(persona)
  router.push('/')
}

function handleGuestLogin() {
  if (!guestName.value.trim()) {
    error.value = 'กรุณากรอกชื่อสำหรับแสดงผล'
    return
  }
  authStore.loginAsGuest(guestName.value.trim())
  router.push('/onboarding')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-primary to-emerald-950 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl space-y-6">
      
      <!-- Brand Header -->
      <div class="text-center space-y-2">
        <h1 class="text-3xl font-black font-brand text-primary tracking-tight">MoneyCircle</h1>
        <p class="text-xs font-semibold text-ink-muted leading-relaxed uppercase tracking-wider">
          Accountability with friends — score your habits, not your wealth
        </p>
      </div>

      <div class="border-t border-border-subtle" />

      <!-- Development Personas -->
      <div class="space-y-3">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider text-center">เข้าสู่ระบบด้วย Persona (สำหรับนักพัฒนา)</h3>
        <div class="grid grid-cols-2 gap-3">
          <button 
            @click="handlePersonaLogin('nune')"
            class="flex items-center justify-center gap-2 p-3 border border-border-subtle rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer text-ink"
          >
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=nune" class="w-6 h-6 rounded-full" />
            <span>Nune (Free)</span>
          </button>
          
          <button 
            @click="handlePersonaLogin('boss')"
            class="flex items-center justify-center gap-2 p-3 border border-border-subtle rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer text-ink"
          >
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=boss" class="w-6 h-6 rounded-full" />
            <span>Boss (Premium)</span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-ink-muted font-bold py-1">
        <div class="w-full border-t border-border-subtle" />
        <span class="px-3">หรือ</span>
        <div class="w-full border-t border-border-subtle" />
      </div>

      <!-- Guest Login Form -->
      <div class="space-y-4">
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">สร้างบัญชีผู้ใช้ชั่วคราว</label>
          <div class="relative flex items-center">
            <User class="w-4 h-4 text-ink-muted absolute left-3 pointer-events-none" />
            <input 
              v-model="guestName"
              type="text" 
              placeholder="กรอกชื่อของคุณ..." 
              class="input-field pl-10 bg-slate-50 border border-slate-200"
              @keyup.enter="handleGuestLogin"
            />
          </div>
          <span v-if="error" class="text-xs font-semibold text-tier-risk block mt-1">{{ error }}</span>
        </div>

        <button 
          @click="handleGuestLogin"
          class="btn-primary w-full gap-2 text-sm cursor-pointer justify-center"
        >
          <LogIn class="w-4 h-4" />
          <span>เริ่มต้นใช้งานทันที</span>
        </button>
      </div>

      <!-- Disclaimer warning -->
      <div class="text-[10px] text-ink-muted text-center pt-2 leading-relaxed">
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
