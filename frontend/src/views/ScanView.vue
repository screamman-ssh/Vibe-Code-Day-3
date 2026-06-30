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
  <div class="page-shell text-ink">
    <header>
      <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
        {{ t('scan.title') }}
      </h1>
    </header>

    <div v-if="usageStore.usage" class="surface-soft flex items-center justify-between">
      <span class="tile-label">{{ t('scan.quota') }}</span>
      <span class="chip-positive font-semibold">
        {{ usageStore.usage.ocrUsedToday }} / {{ usageStore.usage.ocrLimit }}
      </span>
    </div>

    <div class="mission-card">
      <label class="relative z-10 flex min-h-[180px] cursor-pointer flex-col items-center justify-center text-center">
        <Camera class="h-12 w-12 text-primary/80" aria-hidden="true" />
        <span class="mt-3 text-sm font-semibold text-ink">{{ t('scan.pick') }}</span>
        <span class="meta-label mt-1">{{ t('scan.tapHint') }}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          :disabled="processing"
          @change="onFileChange"
        />
      </label>
    </div>

    <div v-if="processing" class="surface-soft flex flex-col items-center justify-center py-6">
      <div class="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent-emerald" />
      <p class="text-sm font-medium text-ink-muted">{{ t('scan.processing') }}</p>
    </div>

    <div v-if="error" class="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-800">
      <AlertTriangle class="h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p class="text-sm font-semibold">{{ t('scan.processError') }}</p>
        <p class="mt-0.5 text-sm text-amber-700">{{ error }}</p>
      </div>
    </div>

    <div v-if="ocrResult && !processing" class="surface-soft space-y-4">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 class="section-title text-sm">{{ t('scan.extractedTitle') }}</h3>
          <span class="chip-positive flex items-center gap-1 text-[11px]">
            <Target class="h-3 w-3" aria-hidden="true" />
            {{ t('scan.confidence') }}: {{ Math.round(ocrResult.confidence * 100) }}%
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="scan-merchant">{{ t('transactions.merchant') }}</label>
            <input id="scan-merchant" v-model="form.merchant" class="input-field" />
          </div>
          <div>
            <label class="field-label" for="scan-amount">{{ t('transactions.amount') }} {{ t('common.baht') }}</label>
            <input id="scan-amount" v-model="form.amount" type="number" class="input-field" />
          </div>
          <div>
            <label class="field-label" for="scan-category">{{ t('transactions.category') }}</label>
            <select id="scan-category" v-model="form.category" class="input-field cursor-pointer bg-white">
              <option v-for="c in CATEGORIES.filter((x) => x !== 'Income')" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="scan-date">{{ t('transactions.date') }}</label>
            <input id="scan-date" v-model="form.date" type="date" class="input-field cursor-pointer" />
          </div>
        </div>

        <button type="button" class="btn-primary w-full" @click="confirmSave">
          {{ t('scan.confirm') }} ({{ formatTHB(Number(form.amount) || 0) }})
        </button>
      </div>
  </div>
</template>
