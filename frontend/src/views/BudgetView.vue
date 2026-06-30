<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Target, PiggyBank, TrendingDown } from 'lucide-vue-next'
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
    budgetStore.categories.map((c) => [c.category, c.limitAmount]),
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
  <div class="page-shell text-ink">
    <header class="flex items-center justify-between gap-3">
      <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
        {{ t('budget.title') }}
      </h1>
      <button
        type="button"
        class="nav-item min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold cursor-pointer"
        :class="editing ? 'btn-primary' : 'btn-secondary'"
        @click="editing ? save() : startEdit()"
      >
        {{ editing ? t('budget.save') : t('budget.edit') }}
      </button>
    </header>

    <div v-if="budgetStore.loading" class="py-10 text-center font-medium text-ink-muted">
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <div class="grid grid-cols-3 gap-3">
        <div class="tile-pastel tile-pastel--sky !min-h-0 !cursor-default">
          <Target class="h-5 w-5 text-tier-steady" aria-hidden="true" />
          <div>
            <p class="tile-label">{{ t('budget.limit') }}</p>
            <p class="stat-value text-sm">{{ formatTHB(aggregate.totalLimit) }}</p>
          </div>
        </div>
        <div class="tile-pastel tile-pastel--amber !min-h-0 !cursor-default">
          <TrendingDown class="h-5 w-5 text-tier-building" aria-hidden="true" />
          <div>
            <p class="tile-label">{{ t('budget.spent') }}</p>
            <p class="stat-value text-sm" :class="{ 'text-tier-risk': aggregate.totalSpent > aggregate.totalLimit }">
              {{ formatTHB(aggregate.totalSpent) }}
            </p>
          </div>
        </div>
        <div class="tile-pastel tile-pastel--mint !min-h-0 !cursor-default">
          <PiggyBank class="h-5 w-5 text-accent-emerald" aria-hidden="true" />
          <div>
            <p class="tile-label">{{ t('budget.remaining') }}</p>
            <p class="stat-value text-sm text-accent-emerald">{{ formatTHB(aggregate.remaining) }}</p>
          </div>
        </div>
      </div>

      <div class="surface-soft">
        <div class="mb-2 flex justify-between text-sm font-medium text-ink-muted">
          <span>ใช้ไป {{ aggregate.percent }}%</span>
          <span>เหลือ {{ 100 - aggregate.percent }}%</span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="aggregate.percent > 100 ? 'bg-tier-risk' : 'bg-accent-emerald'"
            :style="{ width: `${aggregate.percent}%` }"
          />
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="cat in budgetStore.categories"
          :key="cat.category"
          class="surface-soft"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex items-center gap-2 font-semibold text-ink">
              <span class="icon-tile h-9 w-9">
                <component :is="getCategoryIcon(cat.category)" class="h-4 w-4" aria-hidden="true" />
              </span>
              {{ cat.category }}
            </span>
            <span
              v-if="cat.spentAmount > cat.limitAmount && !editing"
              class="chip-negative inline-flex items-center gap-0.5 text-xs"
            >
              <AlertTriangle class="h-3 w-3" aria-hidden="true" />
              {{ t('budget.over') }}
            </span>
          </div>

          <div v-if="!editing" class="mt-3">
            <div class="flex items-baseline justify-between">
              <span class="stat-value text-sm">{{ formatTHB(cat.spentAmount) }}</span>
              <span class="text-sm text-ink-muted">/ {{ formatTHB(cat.limitAmount) }}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="cat.spentAmount > cat.limitAmount ? 'bg-tier-risk' : 'bg-accent-emerald'"
                :style="{ width: `${pct(cat.spentAmount, cat.limitAmount)}%` }"
              />
            </div>
            <p class="meta-label mt-1.5">ใช้ไป {{ pct(cat.spentAmount, cat.limitAmount) }}%</p>
          </div>

          <div v-else class="mt-3 flex items-center gap-2">
            <label class="tile-label shrink-0">{{ t('budget.limit') }}</label>
            <input
              v-model.number="editLimits[cat.category]"
              type="number"
              class="input-field flex-1 text-right"
              placeholder="฿ 0"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
