<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Star, ClipboardList } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { api } from '../api'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(false)
const report = ref('')
const error = ref('')

onMounted(async () => {
  if (auth.user?.subscriptionTier === 'premium') {
    await fetchAnalysisReport()
  }
})

async function fetchAnalysisReport() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.getAiAnalysisReport()
    report.value = data
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
    await fetchAnalysisReport()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const parsedReport = computed(() => {
  if (!report.value) return ''
  return report.value
    .replace(/# (.*)/g, '<h1 class="text-lg font-semibold text-ink mt-6 mb-3 border-b border-border-subtle pb-2">$1</h1>')
    .replace(/## (.*)/g, '<h2 class="text-sm font-semibold text-ink mt-4 mb-2">$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-accent-emerald">$1</strong>')
    .replace(/- (.*)/g, '<li class="ml-4 list-disc text-ink-muted text-sm my-1 leading-relaxed">$1</li>')
    .replace(/\n/g, '<br/>')
})
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6 text-ink select-none">
    <div>
      <h1 class="page-title">รายงานวิเคราะห์การเงิน AI</h1>
      <p class="page-lead">บทวิเคราะห์แนวโน้ม สัดส่วนการใช้จ่าย และแผนจำลองปลดหนี้รายเดือน</p>
    </div>

    <div v-if="auth.user?.subscriptionTier !== 'premium'" class="surface-card p-8 text-center space-y-6">
      <div class="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 border border-amber-100">
        <Star class="h-7 w-7 text-tier-building" aria-hidden="true" />
      </div>
      <div class="space-y-2">
        <h2 class="text-lg font-semibold text-ink">วิเคราะห์เชิงลึกด้วย AI พรีเมียม</h2>
        <p class="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
          อัปเกรดเพื่อรับรายงานสรุปความคุ้มค่างบประมาณ ค่าเฉลี่ยการออม 3-6 เดือนย้อนหลัง และแผนจำลองลดดอกเบี้ยชำระหนี้จากระบบวิเคราะห์เชิงกลยุทธ์
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
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div class="w-9 h-9 rounded-full border-4 border-slate-200 border-t-accent-emerald animate-spin"></div>
        <div>
          <p class="text-sm font-medium text-ink-muted">กำลังประมวลผลข้อมูลธุรกรรมย้อนหลัง...</p>
          <p class="text-xs text-ink-muted mt-1">ขั้นตอนนี้อาจใช้เวลาถึง 10-30 วินาที เพื่อสร้างแผนจำลองหนี้ที่มีประสิทธิภาพที่สุด</p>
        </div>
      </div>

      <div v-else-if="error" class="rounded-lg bg-red-50 border border-red-100 p-4 text-tier-risk">
        <p class="text-sm font-semibold">ไม่สามารถสร้างรายงานวิเคราะห์การเงินได้</p>
        <p class="text-xs mt-1">{{ error }}</p>
        <button
          type="button"
          class="link-quiet mt-3"
          @click="fetchAnalysisReport"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center gap-3 bg-blue-50/40 border border-blue-100 rounded-lg p-4">
          <ClipboardList class="h-6 w-6 text-tier-steady shrink-0" aria-hidden="true" />
          <div>
            <h3 class="text-sm font-semibold text-blue-800">รายงานของคุณได้รับการประมวลผลแล้ว</h3>
            <p class="text-xs text-blue-700/85 mt-0.5">แผนวิเคราะห์ส่วนบุคคลสำหรับเดือนปัจจุบัน</p>
          </div>
        </div>

        <div
          class="text-sm text-ink leading-relaxed bg-surface-bg rounded-lg p-6 border border-border-subtle overflow-x-auto"
          v-html="parsedReport"
        />

        <p class="text-xs text-ink-muted leading-normal text-center">
          คำเตือน: บทวิเคราะห์นี้เป็นคำแนะนำเชิงวิชาการจากข้อมูลประวัติการบันทึกของคุณเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต
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
