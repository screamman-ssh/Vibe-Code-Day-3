<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, ClipboardList, Camera, X } from 'lucide-vue-next'
import { useTransactionStore } from '../stores/transactions'
import { useScoreStore } from '../stores/score'
import { formatTHB, formatDate } from '../composables/useFormat.js'
import { getCategoryIcon } from '../composables/useCategoryIcon.js'
import { CATEGORIES } from '../api/types.js'

const { t } = useI18n()
const txStore = useTransactionStore()
const scoreStore = useScoreStore()

const showForm = ref(false)
const editing = ref(null)
const searchQuery = ref('')
const filterType = ref('all')
const filterCategory = ref('all')

const form = ref({
  type: 'expense',
  amount: '',
  category: 'Food',
  date: new Date().toISOString().slice(0, 10),
  merchant: '',
  note: '',
})

onMounted(() => txStore.fetchAll())

const filteredTransactions = computed(() => {
  let list = txStore.items

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t =>
      (t.merchant && t.merchant.toLowerCase().includes(q)) ||
      (t.note && t.note.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    )
  }

  if (filterType.value !== 'all') {
    list = list.filter(t => t.type === filterType.value)
  }

  if (filterCategory.value !== 'all') {
    list = list.filter(t => t.category === filterCategory.value)
  }

  return [...list].sort((a, b) => b.date.localeCompare(a.date))
})

function openAdd() {
  editing.value = null
  form.value = {
    type: 'expense',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().slice(0, 10),
    merchant: '',
    note: '',
  }
  showForm.value = true
}

function openEdit(tx) {
  editing.value = tx
  form.value = { ...tx, amount: String(tx.amount) }
  showForm.value = true
}

async function save() {
  const payload = { ...form.value, amount: Number(form.value.amount) }
  if (editing.value) {
    await txStore.update(editing.value.id, payload)
  } else {
    await txStore.create(payload)
  }
  await scoreStore.fetch()
  showForm.value = false
}

async function remove(id) {
  if (confirm('ลบรายการนี้?')) {
    await txStore.remove(id)
    await scoreStore.fetch()
  }
}
</script>

<template>
  <div class="space-y-6 text-ink select-none">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">{{ t('transactions.title') }}</h1>
        <p class="page-lead">ประวัติการรับจ่ายและการจัดการบันทึกรายวันของคุณ</p>
      </div>
      <button
        type="button"
        class="btn-primary"
        @click="openAdd"
      >
        + {{ t('transactions.add') }}
      </button>
    </div>

    <div class="surface-card-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex-1 max-w-md relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="ค้นหาตามร้านค้า หรือหมวดหมู่..."
          class="input-field pl-9"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="filterType"
          class="input-field w-auto min-w-[160px] cursor-pointer bg-white"
        >
          <option value="all">ทั้งหมด (รายรับ/รายจ่าย)</option>
          <option value="income">เฉพาะรายรับ</option>
          <option value="expense">เฉพาะรายจ่าย</option>
        </select>

        <select
          v-model="filterCategory"
          class="input-field w-auto min-w-[140px] cursor-pointer bg-white"
        >
          <option value="all">ทุกหมวดหมู่</option>
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <div v-if="txStore.loading" class="text-center py-10 text-ink-muted font-medium">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="!filteredTransactions.length" class="surface-card p-12 text-center text-ink-muted">
      <ClipboardList class="mx-auto h-10 w-10 mb-3 text-ink-muted" aria-hidden="true" />
      <p class="font-semibold text-ink">ไม่พบรายการธุรกรรม</p>
      <p class="meta-label mt-1">ลองเปลี่ยนฟิลเตอร์หรือเพิ่มรายการธุรกรรมใหม่</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="tx in filteredTransactions"
        :key="tx.id"
        class="nav-item surface-card-sm flex items-center justify-between cursor-pointer hover:border-accent-emerald/30"
        @click="openEdit(tx)"
      >
        <div class="min-w-0 flex-1 pr-3">
          <p class="font-semibold text-ink truncate text-sm">
            {{ tx.merchant || tx.category }}
          </p>
          <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span class="meta-label">{{ formatDate(tx.date) }}</span>
            <span class="text-border-subtle">•</span>
            <span class="chip text-[11px] text-ink-muted bg-surface-bg border-border-subtle">
              {{ tx.category }}
            </span>
            <span v-if="tx.source === 'ocr'" class="chip text-[11px] text-tier-building bg-amber-50 border-amber-100 inline-flex items-center gap-0.5">
              <Camera class="h-3 w-3" aria-hidden="true" />
              OCR
            </span>
          </div>
          <p v-if="tx.note" class="text-xs text-ink-muted mt-2 truncate bg-surface-bg p-2 rounded-lg border border-border-subtle">
            {{ tx.note }}
          </p>
        </div>

        <div class="ml-3 text-right shrink-0 flex flex-col justify-between h-full min-h-[68px]">
          <p
            class="stat-value text-sm"
            :class="tx.type === 'income' ? 'text-accent-emerald' : 'text-tier-risk'"
          >
            {{ tx.type === 'income' ? '+' : '-' }}{{ formatTHB(tx.amount) }}
          </p>
          <button
            type="button"
            class="link-quiet text-tier-risk hover:text-tier-risk mt-2 self-end"
            @click.stop="remove(tx.id)"
          >
            {{ t('transactions.delete') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      @click.self="showForm = false"
    >
      <div class="w-full max-w-md rounded-t-lg md:rounded-lg bg-surface-card p-6 border border-border-subtle">
        <div class="flex items-center justify-between mb-5">
          <h2 class="section-title">{{ editing ? 'แก้ไขธุรกรรม' : t('transactions.add') }}</h2>
          <button
            type="button"
            class="nav-item text-ink-muted hover:text-ink h-8 w-8 rounded-lg flex items-center justify-center bg-surface-bg cursor-pointer"
            @click="showForm = false"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div class="tab-switch mb-4">
          <button
            type="button"
            class="tab-switch-btn"
            :class="form.type === 'expense' ? 'bg-red-50 text-tier-risk border border-red-100' : 'tab-switch-btn--inactive'"
            @click="form.type = 'expense'"
          >
            {{ t('transactions.expense') }}
          </button>
          <button
            type="button"
            class="tab-switch-btn"
            :class="form.type === 'income' ? 'bg-emerald-50 text-accent-emerald border border-emerald-100' : 'tab-switch-btn--inactive'"
            @click="form.type = 'income'"
          >
            {{ t('transactions.income') }}
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="field-label">{{ t('transactions.amount') }}</label>
            <input
              v-model="form.amount"
              type="number"
              :placeholder="t('transactions.amount')"
              class="input-field"
            />
          </div>

          <div>
            <label class="field-label">{{ t('transactions.category') }}</label>
            <select
              v-model="form.category"
              class="input-field cursor-pointer bg-white"
            >
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div>
            <label class="field-label">{{ t('transactions.date') }}</label>
            <input
              v-model="form.date"
              type="date"
              class="input-field cursor-pointer"
            />
          </div>

          <div>
            <label class="field-label">{{ t('transactions.merchant') }} (ถ้ามี)</label>
            <input
              v-model="form.merchant"
              :placeholder="t('transactions.merchant')"
              class="input-field"
            />
          </div>

          <div>
            <label class="field-label">{{ t('transactions.note') }} (ถ้ามี)</label>
            <input
              v-model="form.note"
              :placeholder="t('transactions.note')"
              class="input-field"
            />
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            type="button"
            class="btn-secondary flex-1"
            @click="showForm = false"
          >
            {{ t('transactions.cancel') }}
          </button>
          <button
            type="button"
            class="btn-primary flex-1"
            @click="save"
          >
            {{ t('transactions.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
