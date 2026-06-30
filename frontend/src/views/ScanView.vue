<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Camera, AlertTriangle, Target } from 'lucide-vue-next'
import { useUsageStore } from '../stores/usage'
import { useTransactionStore } from '../stores/transactions'
import { useScoreStore } from '../stores/score'
import { api } from '../api'
import { formatTHB } from '../composables/useFormat.js'
import { CATEGORIES } from '../api/types.js'

const { t } = useI18n()
const usageStore = useUsageStore()
const txStore = useTransactionStore()
const scoreStore = useScoreStore()

const processing = ref(false)
const ocrResult = ref(null)
const error = ref('')
const form = ref({
  amount: '',
  category: 'Food',
  merchant: '',
  date: new Date().toISOString().slice(0, 10),
})

onMounted(() => usageStore.fetch())

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  processing.value = true
  error.value = ''
  ocrResult.value = null
  try {
    const result = await api.runOcr(file)
    ocrResult.value = result
    form.value = {
      amount: String(result.amount),
      category: result.category,
      merchant: result.merchant,
      date: result.date,
    }
    await usageStore.fetch()
  } catch (err) {
    if (err.code === 'QUOTA_EXCEEDED') {
      error.value = t('scan.quotaExceeded')
    } else {
      error.value = err.message
    }
  } finally {
    processing.value = false
    e.target.value = ''
  }
}

async function confirmSave() {
  await txStore.create({
    type: 'expense',
    amount: Number(form.value.amount),
    category: form.value.category,
    merchant: form.value.merchant,
    date: form.value.date,
    source: 'ocr',
  })
  await scoreStore.fetch()
  ocrResult.value = null
  form.value = { amount: '', category: 'Food', merchant: '', date: new Date().toISOString().slice(0, 10) }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6 text-ink select-none">
    <div>
      <h1 class="page-title">{{ t('scan.title') }}</h1>
      <p class="page-lead">อัปโหลดรูปภาพใบเสร็จเพื่อถอดข้อความแบบอัตโนมัติด้วยระบบ AI OCR</p>
    </div>

    <div class="surface-card space-y-6">

      <div v-if="usageStore.usage" class="surface-card-sm flex justify-between items-center bg-surface-bg">
        <span class="meta-label">โควต้าสแกนวันนี้</span>
        <span class="chip-positive font-semibold">
          {{ usageStore.usage.ocrUsedToday }} / {{ usageStore.usage.ocrLimit }} ครั้ง
        </span>
      </div>

      <label
        class="nav-item flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-surface-bg hover:border-accent-emerald hover:bg-emerald-50/30 p-6 text-center group relative overflow-hidden"
      >
        <div class="absolute top-5 left-5 w-5 h-5 border-t-2 border-l-2 border-slate-400 group-hover:border-accent-emerald transition-colors"></div>
        <div class="absolute top-5 right-5 w-5 h-5 border-t-2 border-r-2 border-slate-400 group-hover:border-accent-emerald transition-colors"></div>
        <div class="absolute bottom-5 left-5 w-5 h-5 border-b-2 border-l-2 border-slate-400 group-hover:border-accent-emerald transition-colors"></div>
        <div class="absolute bottom-5 right-5 w-5 h-5 border-b-2 border-r-2 border-slate-400 group-hover:border-accent-emerald transition-colors"></div>

        <Camera class="h-12 w-12 text-ink-muted group-hover:text-accent-emerald transition-colors" aria-hidden="true" />
        <span class="mt-3 font-semibold text-ink text-sm">{{ t('scan.pick') }}</span>
        <span class="mt-1 meta-label">สแกนเพื่ออ่านใบเสร็จสะสมเหรียญการเงิน</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          :disabled="processing"
          @change="onFileChange"
        />
      </label>

      <div v-if="processing" class="flex flex-col items-center justify-center py-6 border border-border-subtle rounded-lg bg-surface-bg">
        <div class="w-8 h-8 rounded-full border-4 border-slate-200 border-t-accent-emerald animate-spin mb-3"></div>
        <p class="text-sm font-medium text-ink-muted">{{ t('scan.processing') }}</p>
      </div>

      <div v-if="error" class="rounded-lg bg-amber-50 border border-amber-100 p-4 flex gap-3 text-amber-800">
        <AlertTriangle class="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p class="text-sm font-semibold">เกิดข้อผิดพลาดในการประมวลผล</p>
          <p class="text-xs text-amber-700 mt-0.5">{{ error }}</p>
        </div>
      </div>

      <div v-if="ocrResult && !processing" class="border border-border-subtle rounded-lg bg-surface-bg p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 class="section-title text-sm">ข้อมูลที่ประมวลผลได้</h3>
          <span class="chip-positive flex items-center gap-1 text-[11px]">
            <Target class="h-3 w-3" aria-hidden="true" />
            {{ t('scan.confidence') }}: {{ Math.round(ocrResult.confidence * 100) }}%
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="field-label">{{ t('transactions.merchant') }}</label>
            <input v-model="form.merchant" class="input-field" />
          </div>
          <div>
            <label class="field-label">{{ t('transactions.amount') }} (บาท)</label>
            <input v-model="form.amount" type="number" class="input-field" />
          </div>
          <div>
            <label class="field-label">{{ t('transactions.category') }}</label>
            <select v-model="form.category" class="input-field cursor-pointer bg-white">
              <option v-for="c in CATEGORIES.filter((x) => x !== 'Income')" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">{{ t('transactions.date') }}</label>
            <input v-model="form.date" type="date" class="input-field cursor-pointer" />
          </div>
        </div>

        <button
          type="button"
          class="btn-primary w-full mt-2"
          @click="confirmSave"
        >
          {{ t('scan.confirm') }} ({{ formatTHB(Number(form.amount) || 0) }})
        </button>
      </div>

    </div>
  </div>
</template>
