<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Camera,
  Users,
  BarChart3,
  Banknote,
  TrendingDown,
  PiggyBank,
  Target,
  Hand,
  MessageCircle,
  LineChart,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useScoreStore } from '../stores/score'
import { useTransactionStore } from '../stores/transactions'
import { useBudgetStore } from '../stores/budget'
import ScoreCard from '../components/score/ScoreCard.vue'
import HexBadge from '../components/score/HexBadge.vue'
import { formatTHB } from '../composables/useFormat.js'
import { getCategoryIcon } from '../composables/useCategoryIcon.js'
import { CATEGORIES } from '../api/types.js'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const scoreStore = useScoreStore()
const txStore = useTransactionStore()
const budgetStore = useBudgetStore()

const showBreakdown = ref(false)
const quickAmount = ref('')
const quickCategory = ref('Food')

const showSnapshotCard = ref(true)
const showTipsCard = ref(true)
const showSocialImpactCard = ref(true)

onMounted(async () => {
  await Promise.all([
    scoreStore.fetch(),
    txStore.fetchAll(),
    budgetStore.fetch()
  ])
})

const month = computed(() => new Date().toISOString().slice(0, 7))

const summary = computed(() => {
  const txs = txStore.items.filter((t) => t.date.startsWith(month.value))
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return { income, expense, savings: income - expense }
})

const recentTransactions = computed(() => {
  return [...txStore.items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
})

const budgetSummary = computed(() => {
  const totalLimit = budgetStore.categories.reduce((sum, c) => sum + c.limitAmount, 0)
  const totalSpent = budgetStore.categories.reduce((sum, c) => sum + c.spentAmount, 0)
  const percent = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0
  return { totalLimit, totalSpent, percent }
})

async function quickAdd() {
  const amt = Number(quickAmount.value)
  if (!amt || amt <= 0) return
  await txStore.create({
    type: 'expense',
    amount: amt,
    category: quickCategory.value,
    date: new Date().toISOString().slice(0, 10),
  })
  quickAmount.value = ''
  await Promise.all([
    scoreStore.fetch(),
    budgetStore.fetch()
  ])
}
</script>

<template>
  <div v-if="scoreStore.score" class="space-y-6 text-ink select-none">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="page-title">
          {{ t('dashboard.greeting') }}, {{ auth.user?.displayName }}
        </h1>
        <p class="page-lead">ยินดีต้อนรับกลับมา! มาดูเป้าหมายและความท้าทายในวันนี้กัน</p>
      </div>
      <div class="hidden sm:flex items-center gap-2">
        <button
          type="button"
          class="btn-secondary"
          @click="router.push('/scan')"
        >
          <Camera class="h-4 w-4" aria-hidden="true" />
          สแกนใบเสร็จ
        </button>
        <button
          type="button"
          class="btn-primary"
          @click="router.push('/circle')"
        >
          <Users class="h-4 w-4" aria-hidden="true" />
          กลุ่มเซอร์เคิล
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

      <div class="lg:col-span-2 space-y-6">

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScoreCard
            :score="scoreStore.score.totalScore"
            :tier="scoreStore.score.tier"
            :tier-th="scoreStore.score.tierTh"
            :streak="auth.user?.loggingStreakDays ?? 0"
          />

          <div v-if="showSnapshotCard" class="surface-card relative flex flex-col justify-between">
            <button
              type="button"
              class="dismiss-btn"
              @click="showSnapshotCard = false"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>

            <div>
              <div class="flex items-center gap-2 mb-4">
                <BarChart3 class="h-4 w-4 text-ink-muted" aria-hidden="true" />
                <span class="meta-label">สรุปผลงาน 7 วันล่าสุด</span>
              </div>

              <div class="space-y-3.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <HexBadge value="16" type="gold" size="sm" />
                    <div>
                      <p class="text-sm font-semibold text-ink">รายการรับจ่าย</p>
                      <p class="meta-label">บันทึกสะสม</p>
                    </div>
                  </div>
                  <span class="chip-positive text-[11px]">↗ 8%</span>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <HexBadge value="95" type="blue" size="sm" />
                    <div>
                      <p class="text-sm font-semibold text-ink">ทำตามงบประมาณ</p>
                      <p class="meta-label">จากเป้าหมายที่ตั้ง</p>
                    </div>
                  </div>
                  <span class="chip-negative text-[11px]">↘ -5%</span>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <HexBadge :value="auth.user?.loggingStreakDays ?? 1" type="orange" size="sm" />
                    <div>
                      <p class="text-sm font-semibold text-ink">สตรีคบันทึกผล</p>
                      <p class="meta-label">ความสม่ำเสมอ</p>
                    </div>
                  </div>
                  <span class="chip-positive text-[11px]">↗ 10%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="surface-card-sm flex items-center gap-4">
            <div class="icon-tile icon-tile--income">
              <Banknote class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <p class="meta-label">{{ t('dashboard.income') }}</p>
              <p class="stat-value text-accent-emerald truncate">{{ formatTHB(summary.income) }}</p>
            </div>
          </div>

          <div class="surface-card-sm flex items-center gap-4">
            <div class="icon-tile icon-tile--expense">
              <TrendingDown class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <p class="meta-label">{{ t('dashboard.expense') }}</p>
              <p class="stat-value text-tier-risk truncate">{{ formatTHB(summary.expense) }}</p>
            </div>
          </div>

          <div class="surface-card-sm flex items-center gap-4">
            <div class="icon-tile icon-tile--savings">
              <PiggyBank class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <p class="meta-label">{{ t('dashboard.savings') }}</p>
              <p class="stat-value truncate" :class="summary.savings < 0 ? 'text-tier-risk' : 'text-tier-steady'">
                {{ formatTHB(summary.savings) }}
              </p>
            </div>
          </div>
        </div>

        <div class="surface-card space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="section-title flex items-center gap-2">
              <Target class="h-4 w-4 text-accent-emerald" aria-hidden="true" />
              รายละเอียดคะแนนสุขภาพการเงิน
            </h3>
            <button
              type="button"
              class="link-quiet"
              @click="showBreakdown = !showBreakdown"
            >
              {{ showBreakdown ? 'ซ่อนรายละเอียด' : t('dashboard.breakdown') }}
            </button>
          </div>

          <div v-if="showBreakdown" class="pt-4 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="dim in scoreStore.score.dimensions"
              :key="dim.key"
              class="bg-surface-bg rounded-lg border border-border-subtle p-4"
            >
              <div class="flex justify-between text-xs text-ink-muted font-medium">
                <span>{{ dim.label }}</span>
                <span class="text-accent-emerald font-semibold">{{ dim.subscore }}/100</span>
              </div>
              <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-accent-emerald transition-all duration-500"
                  :style="{ width: `${dim.subscore}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="surface-card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="section-title">รายการธุรกรรมล่าสุด</h3>
            <button
              type="button"
              class="link-quiet flex items-center gap-1"
              @click="router.push('/transactions')"
            >
              ดูทั้งหมด →
            </button>
          </div>

          <div v-if="!recentTransactions.length" class="text-center py-6 text-ink-muted text-sm">
            ยังไม่มีรายการธุรกรรมบันทึกไว้ในเดือนนี้
          </div>
          <ul v-else class="divide-y divide-border-subtle">
            <li
              v-for="tx in recentTransactions"
              :key="tx.id"
              class="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
            >
              <div class="flex items-center gap-3">
                <span class="icon-tile">
                  <component :is="getCategoryIcon(tx.category)" class="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p class="text-sm font-semibold text-ink">{{ tx.merchant || tx.category }}</p>
                  <p class="meta-label mt-0.5">{{ tx.date }} · {{ tx.category }}</p>
                </div>
              </div>
              <p
                class="text-sm font-semibold tabular-nums"
                :class="tx.type === 'income' ? 'text-accent-emerald' : 'text-tier-risk'"
              >
                {{ tx.type === 'income' ? '+' : '-' }}{{ formatTHB(tx.amount) }}
              </p>
            </li>
          </ul>
        </div>

      </div>

      <div class="space-y-6">

        <div v-if="showSocialImpactCard" class="surface-card relative flex flex-col justify-between">
          <button
            type="button"
            class="dismiss-btn"
            @click="showSocialImpactCard = false"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>

          <div>
            <div class="flex items-center gap-2 mb-4">
              <Users class="h-4 w-4 text-ink-muted" aria-hidden="true" />
              <span class="meta-label">สถิติในกลุ่มเซอร์เคิล (60 วัน)</span>
            </div>

            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border-subtle text-xs text-ink-muted font-medium">
                  <th class="text-left pb-2">กลุ่มเปรียบเทียบ</th>
                  <th class="text-right pb-2">แอ็กชันที่ฉลอง</th>
                  <th class="text-right pb-2">คำวิจารณ์</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-medium">
                <tr>
                  <td class="py-2.5 text-ink-muted">ค่าเฉลี่ยเพื่อน</td>
                  <td class="py-2.5 text-right text-ink">185</td>
                  <td class="py-2.5 text-right text-ink">113</td>
                </tr>
                <tr>
                  <td class="py-2.5 text-ink-muted">ท็อป 5% ในกลุ่ม</td>
                  <td class="py-2.5 text-right text-ink">239</td>
                  <td class="py-2.5 text-right text-ink">268</td>
                </tr>
                <tr class="text-accent-emerald">
                  <td class="py-2.5 font-semibold">ตัวคุณเอง</td>
                  <td class="py-2.5 text-right font-semibold">200</td>
                  <td class="py-2.5 text-right font-semibold">197</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="showTipsCard" class="surface-card relative flex flex-col justify-between">
          <button
            type="button"
            class="dismiss-btn"
            @click="showTipsCard = false"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>

          <div>
            <div class="flex items-center gap-2 mb-3">
              <Hand class="h-4 w-4 text-ink-muted" aria-hidden="true" />
              <span class="meta-label">แนะแนวทางการเงิน</span>
            </div>

            <div class="flex items-center gap-2 mb-4">
              <div class="flex -space-x-2 select-none">
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-tier-steady text-xs font-semibold border-2 border-white">N</span>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 text-tier-building text-xs font-semibold border-2 border-white">B</span>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-accent-emerald text-xs font-semibold border-2 border-white">K</span>
              </div>
              <p class="text-sm font-semibold text-ink leading-snug">มีเคล็ดลับและคำแนะนำทางการเงินรอคุณอยู่!</p>
            </div>

            <div class="space-y-2">
              <button
                type="button"
                class="btn-primary w-full"
                @click="router.push('/coach')"
              >
                <MessageCircle class="h-4 w-4" aria-hidden="true" />
                ดูคำแนะนำ AI
              </button>
              <button
                type="button"
                class="btn-secondary w-full border-blue-100 bg-blue-50 text-tier-steady hover:bg-blue-100"
                @click="router.push('/analyze')"
              >
                <LineChart class="h-4 w-4" aria-hidden="true" />
                ดูรายงานวิเคราะห์การเงิน
              </button>
            </div>
          </div>
        </div>

        <div class="surface-card">
          <h3 class="section-title mb-3">{{ t('dashboard.quickAdd') }}</h3>
          <div class="space-y-3">
            <div>
              <label class="field-label">จำนวนเงิน (บาท)</label>
              <input
                v-model="quickAmount"
                type="number"
                placeholder="฿ 0.00"
                class="input-field"
              />
            </div>
            <div>
              <label class="field-label">หมวดหมู่</label>
              <select
                v-model="quickCategory"
                class="input-field bg-white"
              >
                <option v-for="c in CATEGORIES.filter((c) => c !== 'Income')" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <button
              type="button"
              class="btn-primary w-full"
              @click="quickAdd"
            >
              {{ t('transactions.save') }}
            </button>
          </div>
        </div>

        <div class="surface-card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="section-title">งบประมาณเดือนนี้</h3>
            <button
              type="button"
              class="link-quiet"
              @click="router.push('/budget')"
            >
              จัดงบ →
            </button>
          </div>

          <div v-if="budgetSummary.totalLimit === 0" class="text-center py-5 bg-surface-bg border border-dashed border-border-subtle rounded-lg">
            <p class="text-sm text-ink-muted font-medium">ยังไม่ได้ตั้งวงเงินงบประมาณ</p>
            <button
              type="button"
              class="link-quiet mt-2.5"
              @click="router.push('/budget')"
            >
              ตั้งงบประมาณเลย
            </button>
          </div>
          <div v-else class="space-y-4">
            <div>
              <div class="flex justify-between text-xs text-ink-muted font-medium mb-1.5">
                <span>ใช้ไปแล้ว {{ budgetSummary.percent }}%</span>
                <span>{{ formatTHB(budgetSummary.totalSpent) }} / {{ formatTHB(budgetSummary.totalLimit) }}</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-surface-bg">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="budgetSummary.percent > 100 ? 'bg-tier-risk' : 'bg-accent-emerald'"
                  :style="{ width: `${budgetSummary.percent}%` }"
                />
              </div>
            </div>

            <div class="space-y-2.5 border-t border-border-subtle pt-3">
              <div
                v-for="cat in budgetStore.categories.slice(0, 3)"
                :key="cat.category"
                class="flex items-center justify-between text-sm font-medium"
              >
                <span class="text-ink-muted">{{ cat.category }}</span>
                <span class="font-semibold tabular-nums" :class="cat.spentAmount > cat.limitAmount ? 'text-tier-risk' : 'text-ink'">
                  {{ formatTHB(cat.spentAmount) }} / {{ formatTHB(cat.limitAmount) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:hidden">
          <button
            type="button"
            class="nav-item surface-card-sm flex flex-col items-center justify-center text-center cursor-pointer"
            @click="router.push('/scan')"
          >
            <Camera class="h-6 w-6 mb-1.5 text-ink-muted" aria-hidden="true" />
            <span class="text-sm font-semibold text-ink">สแกนใบเสร็จ</span>
          </button>
          <button
            type="button"
            class="nav-item surface-card-sm flex flex-col items-center justify-center text-center cursor-pointer"
            @click="router.push('/circle')"
          >
            <Users class="h-6 w-6 mb-1.5 text-ink-muted" aria-hidden="true" />
            <span class="text-sm font-semibold text-ink">กลุ่มเซอร์เคิล</span>
          </button>
        </div>

      </div>

    </div>
  </div>
  <div v-else class="flex flex-col items-center justify-center py-20">
    <p class="text-ink-muted font-medium">{{ t('common.loading') }}</p>
  </div>
</template>
