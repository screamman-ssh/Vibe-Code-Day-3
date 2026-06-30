<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import { useBudgetStore } from '../stores/budget'
import { useScoreStore } from '../stores/score'
import { formatTHB } from '../composables/useFormat.js'
import { getCategoryIcon } from '../composables/useCategoryIcon.js'

const { t } = useI18n()
const budgetStore = useBudgetStore()
const scoreStore = useScoreStore()
const editing = ref(false)
const editLimits = ref({})

onMounted(() => budgetStore.fetch())

function startEdit() {
  editLimits.value = Object.fromEntries(
    budgetStore.categories.map((c) => [c.category, c.limitAmount])
  )
  editing.value = true
}

async function save() {
  const updated = budgetStore.categories.map((c) => ({
    category: c.category,
    limitAmount: Number(editLimits.value[c.category]) || 0,
  }))
  await budgetStore.save(updated)
  await scoreStore.fetch()
  editing.value = false
}

function pct(spent, limit) {
  if (!limit) return 0
  return Math.min(100, Math.round((spent / limit) * 100))
}

const aggregate = computed(() => {
  const totalLimit = budgetStore.categories.reduce((sum, c) => sum + c.limitAmount, 0)
  const totalSpent = budgetStore.categories.reduce((sum, c) => sum + c.spentAmount, 0)
  const remaining = Math.max(0, totalLimit - totalSpent)
  const percent = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0
  return { totalLimit, totalSpent, remaining, percent }
})
</script>

<template>
  <div class="space-y-6 text-ink select-none">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">{{ t('budget.title') }}</h1>
        <p class="page-lead">ตั้งและควบคุมงบรายจ่ายแต่ละหมวดหมู่เพื่อคะแนนสุขภาพทางการเงินที่ดี</p>
      </div>
      <button
        type="button"
        class="nav-item min-h-11 rounded-lg px-5 text-sm font-semibold cursor-pointer"
        :class="editing ? 'btn-primary' : 'btn-secondary'"
        @click="editing ? save() : startEdit()"
      >
        {{ editing ? t('budget.save') : t('budget.edit') }}
      </button>
    </div>

    <div v-if="budgetStore.loading" class="text-center py-10 text-ink-muted font-medium">
      {{ t('common.loading') }}
    </div>

    <div v-else class="space-y-6">
      <div class="surface-card">
        <h3 class="meta-label mb-4">ภาพรวมงบประมาณรายเดือน</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div class="border-r border-border-subtle pr-4 last:border-0">
            <p class="meta-label">วงเงินงบประมาณทั้งหมด</p>
            <p class="stat-value mt-1.5">{{ formatTHB(aggregate.totalLimit) }}</p>
          </div>
          <div class="border-r border-border-subtle pr-4 last:border-0">
            <p class="meta-label">ใช้ไปแล้ว</p>
            <p class="stat-value mt-1.5" :class="{ 'text-tier-risk': aggregate.totalSpent > aggregate.totalLimit }">
              {{ formatTHB(aggregate.totalSpent) }}
            </p>
          </div>
          <div>
            <p class="meta-label">คงเหลือใช้อีก</p>
            <p class="stat-value mt-1.5 text-accent-emerald">
              {{ formatTHB(aggregate.remaining) }}
            </p>
          </div>
        </div>

        <div class="mt-6">
          <div class="flex justify-between text-xs text-ink-muted font-medium mb-1.5">
            <span>ใช้ไปแล้ว {{ aggregate.percent }}%</span>
            <span>เหลืออีก {{ 100 - aggregate.percent }}%</span>
          </div>
          <div class="h-2.5 overflow-hidden rounded-full bg-surface-bg">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="aggregate.percent > 100 ? 'bg-tier-risk' : 'bg-accent-emerald'"
              :style="{ width: `${aggregate.percent}%` }"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="cat in budgetStore.categories"
          :key="cat.category"
          class="surface-card-sm flex flex-col justify-between"
        >
          <div>
            <div class="flex justify-between items-start text-sm">
              <span class="font-semibold text-ink text-base flex items-center gap-2">
                <span class="icon-tile">
                  <component :is="getCategoryIcon(cat.category)" class="h-5 w-5" aria-hidden="true" />
                </span>
                <span>{{ cat.category }}</span>
              </span>
              <span v-if="!editing" class="chip text-[11px] text-ink-muted bg-surface-bg border-border-subtle">
                โควต้า
              </span>
            </div>

            <div class="mt-4 flex justify-between items-baseline">
              <div v-if="!editing" class="space-y-0.5">
                <span class="stat-value">{{ formatTHB(cat.spentAmount) }}</span>
                <span class="text-sm text-ink-muted"> / {{ formatTHB(cat.limitAmount) }}</span>
              </div>
              <div class="flex items-center gap-2 w-full mt-2" v-else>
                <span class="meta-label shrink-0">จำกัดวงเงิน</span>
                <input
                  v-model.number="editLimits[cat.category]"
                  type="number"
                  class="input-field flex-1 text-right"
                  placeholder="฿ 0"
                />
              </div>
            </div>

            <div v-if="!editing" class="mt-4">
              <div class="h-2 overflow-hidden rounded-full bg-surface-bg">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="cat.spentAmount > cat.limitAmount ? 'bg-tier-risk' : 'bg-accent-emerald'"
                  :style="{ width: `${pct(cat.spentAmount, cat.limitAmount)}%` }"
                />
              </div>
              <div class="flex justify-between items-center mt-1.5">
                <span class="meta-label">ใช้ไป {{ pct(cat.spentAmount, cat.limitAmount) }}%</span>
                <span
                  v-if="cat.spentAmount > cat.limitAmount"
                  class="chip-negative text-[11px] inline-flex items-center gap-0.5"
                >
                  <AlertTriangle class="h-3 w-3" aria-hidden="true" />
                  {{ t('budget.over') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
