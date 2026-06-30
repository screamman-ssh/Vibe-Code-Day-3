<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Star, Lightbulb } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { api } from '../api'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(false)
const coachResponse = ref('')
const error = ref('')

onMounted(async () => {
  if (auth.user?.subscriptionTier === 'premium') {
    await fetchCoachTips()
  }
})

async function fetchCoachTips() {
  loading.value = true
  error.value = ''
  try {
    const tips = await api.getCoachTips()
    coachResponse.value = tips
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function upgradeToPremium() {
  loading.value = true
  try {
    await api.updateProfile({
      subscriptionTier: 'premium'
    })
    await auth.refresh()
    await fetchCoachTips()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6 text-ink select-none">
    <div>
      <h1 class="page-title">โค้ชการเงิน AI</h1>
      <p class="page-lead">รับคำแนะนำเชิงลึกส่วนบุคคลเพื่อพัฒนาสุขภาพทางการเงินของคุณ</p>
    </div>

    <div v-if="auth.user?.subscriptionTier !== 'premium'" class="surface-card p-8 text-center space-y-6">
      <div class="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 border border-amber-100">
        <Star class="h-7 w-7 text-tier-building" aria-hidden="true" />
      </div>
      <div class="space-y-2">
        <h2 class="text-lg font-semibold text-ink">ฟีเจอร์พรีเมียมเฉพาะโค้ช AI</h2>
        <p class="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
          อัปเกรดเพื่อรับการวิเคราะห์พฤติกรรมการใช้จ่าย อัตราการออม และคำแนะนำปรับโครงสร้างหนี้ตรงจุดส่วนตัวจากระบบโค้ช Gemma 4
        </p>
      </div>

      <div class="pt-4 max-w-xs mx-auto space-y-3">
        <button
          type="button"
          :disabled="loading"
          class="btn-primary w-full bg-tier-building hover:opacity-90"
          @click="upgradeToPremium"
        >
          {{ loading ? 'กำลังดำเนินการ...' : 'ทดลองเปิดใช้งานพรีเมียมฟรี (Beta)' }}
        </button>
        <button
          type="button"
          class="btn-secondary w-full"
          @click="router.push('/')"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>

    <div v-else class="surface-card space-y-6">
      <div v-if="loading" class="flex flex-col items-center justify-center py-12">
        <div class="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent-emerald animate-spin mb-4"></div>
        <p class="text-sm font-medium text-ink-muted">กำลังคุยกับโค้ช AI ทางการเงินของคุณ...</p>
      </div>

      <div v-else-if="error" class="rounded-lg bg-red-50 border border-red-100 p-4 text-tier-risk">
        <p class="text-sm font-semibold">ไม่สามารถติดต่อโค้ช AI ได้</p>
        <p class="text-xs mt-1">{{ error }}</p>
        <button
          type="button"
          class="link-quiet mt-3"
          @click="fetchCoachTips"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center gap-3 bg-emerald-50/40 border border-emerald-100 rounded-lg p-4">
          <Lightbulb class="h-6 w-6 text-accent-emerald shrink-0" aria-hidden="true" />
          <div>
            <h3 class="text-sm font-semibold text-emerald-800">โค้ชประมวลผลสำเร็จ</h3>
            <p class="text-xs text-emerald-700/80 mt-0.5">นี่คือข้อเสนอแนะ 3 ข้อเด่นในเดือนนี้ของคุณ</p>
          </div>
        </div>

        <div class="text-sm leading-relaxed text-ink whitespace-pre-line bg-surface-bg rounded-lg p-5 border border-border-subtle">
          {{ coachResponse }}
        </div>

        <p class="text-xs text-ink-muted leading-normal text-center">
          คำเตือน: ความเห็นของ AI เป็นแนวทางเชิงวิชาการเท่านั้น ไม่สามารถทดแทนคำปรึกษาจากนักวางแผนการเงินหรือผู้แนะนำการลงทุนที่ได้รับใบอนุญาต
        </p>

        <button
          type="button"
          class="btn-secondary w-full"
          @click="router.push('/')"
        >
          กลับไปหน้าหลัก
        </button>
      </div>
    </div>
  </div>
</template>
