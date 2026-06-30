<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Camera,
  Users,
  Check,
  Flame,
  Wallet,
  PiggyBank,
  TrendingDown,
  Target,
  ChevronRight,
  Sparkles,
  MessageCircle,
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useScoreStore } from '../stores/score'
import { useTransactionStore } from '../stores/transactions'
import { useBudgetStore } from '../stores/budget'
import { formatTHB } from '../composables/useFormat.js'
import { tierColor } from '../composables/useFormat.js'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const scoreStore = useScoreStore()
const txStore = useTransactionStore()
const budgetStore = useBudgetStore()

const quickAmount = ref('')
const quickSaving = ref(false)
const quickSaved = ref(false)

const thaiDays = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

onMounted(async () => {
  await Promise.all([
    scoreStore.fetch(),
    txStore.fetchAll(),
    budgetStore.fetch(),
  ])
})

const month = computed(() => new Date().toISOString().slice(0, 7))
const today = computed(() => new Date().toISOString().slice(0, 10))

const streak = computed(() => auth.user?.loggingStreakDays ?? 0)

const streakDays = computed(() => {
  return thaiDays.map((label, idx) => {
    const diff = currentDayIndex - idx
    let done = false
    if (diff >= 0 && diff < streak.value) {
      done = true
    } else if (diff < 0 && streak.value >= 7) {
      done = true
    }
    return {
      label,
      done,
      isToday: idx === currentDayIndex,
    }
  })
})

const loggedToday = computed(() =>
  txStore.items.some((item) => item.date === today.value),
)

const summary = computed(() => {
  const txs = txStore.items.filter((item) => item.date.startsWith(month.value))
  const income = txs.filter((item) => item.type === 'income').reduce((s, item) => s + item.amount, 0)
  const expense = txs.filter((item) => item.type === 'expense').reduce((s, item) => s + item.amount, 0)
  return { income, expense, savings: income - expense }
})

const budgetSummary = computed(() => {
  const totalLimit = budgetStore.categories.reduce((sum, c) => sum + c.limitAmount, 0)
  const totalSpent = budgetStore.categories.reduce((sum, c) => sum + c.spentAmount, 0)
  const remaining = Math.max(0, totalLimit - totalSpent)
  const percent = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0
  return { totalLimit, totalSpent, remaining, percent }
})

const missionTitle = computed(() => {
  if (loggedToday.value) return t('dashboard.missionDone')
  return t('dashboard.missionLog')
})

async function quickAdd() {
  const amt = Number(quickAmount.value)
  if (!amt || amt <= 0) return
  quickSaving.value = true
  quickSaved.value = false
  try {
    await txStore.create({
      type: 'expense',
      amount: amt,
      category: 'Food',
      date: today.value,
    })
    quickAmount.value = ''
    quickSaved.value = true
    await Promise.all([scoreStore.fetch(), budgetStore.fetch()])
    setTimeout(() => {
      quickSaved.value = false
    }, 2500)
  } finally {
    quickSaving.value = false
  }
}
</script>

<template>
  <div v-if="scoreStore.score" class="page-shell">
    <header>
      <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
        {{ t('dashboard.greeting') }}, {{ auth.user?.displayName }}
      </h1>
    </header>

    <!-- Streak row -->
    <section class="streak-module" aria-label="สตรีคบันทึกรายวัน">
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Flame class="h-4 w-4 text-streak-flame" aria-hidden="true" />
          <span class="text-sm font-semibold text-ink">{{ t('dashboard.streak') }}</span>
        </div>
        <span class="text-sm font-semibold text-ink-muted tabular-nums">
          {{ streak }} {{ t('dashboard.days') }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-1">
        <div
          v-for="(day, idx) in streakDays"
          :key="idx"
          class="streak-day"
          :class="{
            'streak-day--done': day.done,
            'streak-day--today': day.isToday && !day.done,
            'streak-day--pending': !day.done && !day.isToday,
          }"
          :aria-label="day.label"
        >
          <Check v-if="day.done" class="h-3.5 w-3.5" aria-hidden="true" />
          <span v-else>{{ day.label }}</span>
        </div>
      </div>
    </section>

    <!-- Today's mission -->
    <section class="mission-card" aria-labelledby="mission-heading">
      <div class="relative z-10 max-w-[70%]">
        <p id="mission-heading" class="meta-label mb-1">{{ t('dashboard.missionLabel') }}</p>
        <h2 class="font-brand text-xl font-bold leading-snug text-ink text-balance">
          {{ missionTitle }}
        </h2>

        <div v-if="!loggedToday" class="mt-4 space-y-2">
          <label class="sr-only" for="quick-amount">{{ t('transactions.amount') }}</label>
          <input
            id="quick-amount"
            v-model="quickAmount"
            type="number"
            inputmode="decimal"
            placeholder="฿ 0"
            class="input-field bg-white/80 dark:bg-slate-800/80"
            @keydown.enter="quickAdd"
          />
          <button
            type="button"
            class="btn-primary w-full"
            :disabled="quickSaving || !quickAmount"
            @click="quickAdd"
          >
            {{ quickSaving ? t('common.loading') : t('transactions.save') }}
          </button>
        </div>

        <div v-else class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn-primary" @click="router.push('/scan')">
            <Camera class="h-4 w-4" aria-hidden="true" />
            {{ t('dashboard.missionScan') }}
          </button>
          <button type="button" class="btn-secondary bg-white/70 dark:bg-slate-800/70" @click="router.push('/transactions')">
            {{ t('dashboard.viewAll') }}
          </button>
        </div>

        <p
          v-if="quickSaved"
          class="mt-2 text-xs font-semibold text-accent-emerald"
          role="status"
        >
          {{ t('dashboard.saved') }}
        </p>
      </div>

      <div class="mission-card__pocket" aria-hidden="true">
        <div class="mission-card__disc">
          <Wallet class="h-10 w-10 text-primary/70" />
        </div>
      </div>
    </section>

    <!-- 2×2 habit tiles -->
    <section class="grid grid-cols-2 gap-3" aria-label="ภาพรวมการเงิน">
      <button
        type="button"
        class="tile-pastel tile-pastel--sky"
        @click="router.push('/budget')"
      >
        <Target class="h-5 w-5 text-tier-steady" aria-hidden="true" />
        <div class="tile-pastel__body">
          <p class="tile-label" :title="t('dashboard.budgetLeft')">{{ t('dashboard.budgetLeft') }}</p>
          <p class="stat-value text-ink">
            {{ budgetSummary.totalLimit > 0 ? formatTHB(budgetSummary.remaining) : '—' }}
          </p>
        </div>
      </button>

      <button
        type="button"
        class="tile-pastel tile-pastel--teal"
        @click="router.push('/transactions')"
      >
        <Sparkles class="h-5 w-5 text-primary" aria-hidden="true" />
        <div class="tile-pastel__body">
          <p class="tile-label" :title="t('dashboard.score')">{{ t('dashboard.score') }}</p>
          <div class="flex items-baseline gap-2">
            <p class="stat-value text-ink">{{ scoreStore.score.totalScore }}</p>
            <span class="chip text-[10px]" :class="tierColor(scoreStore.score.tier)">
              {{ scoreStore.score.tierTh }}
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        class="tile-pastel tile-pastel--amber"
        @click="router.push('/transactions')"
      >
        <TrendingDown class="h-5 w-5 text-tier-building" aria-hidden="true" />
        <div class="tile-pastel__body">
          <p class="tile-label" :title="t('dashboard.expense')">{{ t('dashboard.expense') }}</p>
          <p class="stat-value text-ink">{{ formatTHB(summary.expense) }}</p>
        </div>
      </button>

      <button
        type="button"
        class="tile-pastel tile-pastel--mint"
        @click="router.push('/transactions')"
      >
        <PiggyBank class="h-5 w-5 text-accent-emerald" aria-hidden="true" />
        <div class="tile-pastel__body">
          <p class="tile-label" :title="t('dashboard.savings')">{{ t('dashboard.savings') }}</p>
          <p
            class="stat-value"
            :class="summary.savings < 0 ? 'text-tier-risk' : 'text-ink'"
          >
            {{ formatTHB(summary.savings) }}
          </p>
        </div>
      </button>
    </section>

    <!-- Circle teaser -->
    <button
      type="button"
      class="circle-teaser"
      @click="router.push('/circle')"
    >
      <span class="flex items-center gap-2">
        <Users class="h-4 w-4 text-primary" aria-hidden="true" />
        {{ t('dashboard.circleTeaser') }}
      </span>
      <ChevronRight class="h-4 w-4 text-ink-muted" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="circle-teaser"
      @click="router.push('/chat')"
    >
      <span class="flex items-center gap-2">
        <MessageCircle class="h-4 w-4 text-primary" aria-hidden="true" />
        {{ t('nav.chat') }}
      </span>
      <ChevronRight class="h-4 w-4 text-ink-muted" aria-hidden="true" />
    </button>
  </div>

  <div v-else class="flex flex-col items-center justify-center py-20">
    <p class="font-medium text-ink-muted">{{ t('common.loading') }}</p>
  </div>
</template>
