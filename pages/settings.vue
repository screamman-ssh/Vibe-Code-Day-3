<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useAuthStore, useUsageStore } from '#imports'
import { 
  User, 
  Sparkles, 
  LogOut, 
  CheckCircle, 
  ShieldCheck, 
  KeyRound 
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const usageStore = useUsageStore()

const user = computed(() => authStore.user || { displayName: '', subscriptionTier: 'free', emergencyFundAmount: 0 })

const displayName = ref(user.value.displayName)
const avatarUrl = ref(user.value.avatarUrl)
const emergencyFundAmount = ref(user.value.emergencyFundAmount)
const apiKey = ref('')

const error = ref('')
const success = ref('')

onMounted(() => {
  if (typeof window !== 'undefined') {
    apiKey.value = localStorage.getItem('openai_api_key') || ''
  }
})

const isPremium = computed(() => usageStore.tier === 'premium')

function handleSave() {
  error.value = ''
  success.value = ''

  if (!displayName.value.trim()) {
    error.value = 'กรุณากรอกชื่อแสดงผล'
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

  success.value = 'บันทึกข้อมูลตั้งค่าเรียบร้อยแล้ว!'
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
  if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="page-shell">
    
    <!-- Header -->
    <div class="py-2">
      <h1 class="page-title">ตั้งค่าผู้ใช้งาน</h1>
      <p class="page-lead">แก้ไขข้อมูลส่วนตัวและจัดการแผนการเงินของคุณ</p>
    </div>

    <!-- Personal profile form -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">ข้อมูลส่วนตัว</h3>

      <div class="flex items-center justify-center py-2">
        <img 
          :src="avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
          class="w-16 h-16 rounded-full border border-border-subtle bg-slate-50" 
        />
      </div>

      <div class="space-y-3">
        <!-- Display Name -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">ชื่อแสดงผล (Display Name)</label>
          <input 
            v-model="displayName"
            type="text" 
            class="input-field bg-slate-50 border border-slate-200"
          />
        </div>

        <!-- Avatar URL -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">ลิงก์รูปโปรไฟล์ (Avatar URL)</label>
          <input 
            v-model="avatarUrl"
            type="text" 
            class="input-field bg-slate-50 border border-slate-200"
          />
        </div>

        <!-- Emergency Fund Amount -->
        <div class="space-y-1">
          <label class="field-label font-bold text-ink">เป้าหมายเงินสำรองฉุกเฉิน (THB)</label>
          <input 
            v-model="emergencyFundAmount"
            type="number" 
            placeholder="0"
            class="input-field bg-slate-50 border border-slate-200"
          />
          <span class="text-[10px] text-ink-muted leading-relaxed block mt-1">
            *ระบบจะประเมินคะแนนโดยแบ่งสัดส่วนเทียบกับรายจ่ายเฉลี่ยประจำเดือนของคุณ*
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
        บันทึกข้อมูลส่วนตัว
      </button>
    </div>

    <!-- AI Settings Card -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-2">
        <KeyRound class="w-4 h-4 text-primary" />
        <span>ตั้งค่าระบบ AI (AI Settings)</span>
      </h3>
      
      <div class="space-y-1">
        <label class="field-label font-bold text-ink">API Key สำหรับสแกนใบเสร็จ & AI โค้ช (Bearer Token)</label>
        <input 
          v-model="apiKey"
          type="password"
          placeholder="Bearer API Key (ตัวอย่าง: sk-proj-...)"
          class="input-field bg-slate-50 border border-slate-200"
        />
        <span class="text-[10px] text-ink-muted leading-relaxed block mt-1">
          *API Key จะถูกเข้ารหัสบันทึกไว้ในเบราว์เซอร์ของคุณเพื่อเรียกใช้งานตรงไปยังเซิร์ฟเวอร์ AI*
        </span>
      </div>
    </div>

    <!-- Membership Details -->
    <div class="surface-card space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">แพ็กเกจสมาชิก</h3>

      <div class="flex justify-between items-center bg-slate-50 border border-border-subtle p-3.5 rounded-xl text-xs">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] text-ink-muted leading-none">แพ็กเกจปัจจุบัน</span>
          <span class="text-sm font-bold text-ink mt-1 flex items-center gap-1.5">
            {{ isPremium ? 'Premium (พรีเมียม)' : 'Free (ฟรี)' }}
            <Sparkles v-if="isPremium" class="w-4 h-4 text-amber-500 fill-amber-500" />
          </span>
        </div>

        <button 
          v-if="!isPremium"
          @click="handleUpgrade"
          class="btn-primary min-h-0 py-1.5 px-3 rounded-full text-[10px] bg-amber-500 hover:bg-amber-600 border border-amber-500/20 cursor-pointer"
        >
          อัปเกรดเป็นพรีเมียม (Beta)
        </button>
        <span 
          v-else
          class="chip bg-emerald-50 text-accent-emerald border-emerald-100 font-bold text-[9px]"
        >
          เปิดใช้งานถาวร
        </span>
      </div>

      <!-- OCR Quota status -->
      <div class="flex justify-between items-center text-xs pl-1">
        <span class="text-ink-muted">โควตาสแกนใบเสร็จ OCR วันนี้:</span>
        <span class="font-bold text-ink">{{ usageStore.ocrUsedToday }} / {{ usageStore.ocrLimit }} ครั้ง</span>
      </div>
    </div>

    <!-- Legal disclaimer notice -->
    <div class="surface-card-sm bg-slate-50 border border-border-subtle flex items-start gap-2 text-[10px] leading-relaxed text-ink-muted">
      <ShieldCheck class="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div>
        แอปพลิเคชัน MoneyCircle และคำแนะนำวิเคราะห์ของ AI โค้ชทั้งหมดจัดทำขึ้นเพื่อกระตุ้นและอำนวยความสะดวกในการจดบันทึกรายจ่ายส่วนบุคคลและสร้างวินัยที่ดี ไม่ใช่คำแนะนำทางการเงินที่ได้รับอนุญาตอย่างเป็นทางการ
      </div>
    </div>

    <!-- Log out action -->
    <button 
      @click="handleLogout"
      class="btn-secondary w-full justify-center gap-2 text-xs py-2 min-h-10 text-tier-risk hover:bg-red-50 hover:text-tier-risk cursor-pointer"
    >
      <LogOut class="w-4 h-4" />
      <span>ออกจากระบบ</span>
    </button>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
