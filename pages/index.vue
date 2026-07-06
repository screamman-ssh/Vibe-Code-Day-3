<script setup>
import { computed } from 'vue'
import { useRouter, useAuthStore, useScoreStore, useTransactionsStore, useBudgetStore, useGroupStore, useDebtsStore } from '#imports'
import ScoreCard from '~/components/score/ScoreCard.vue'
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  PieChart,
  UserPlus,
  Flame,
  Award,
  Wallet,
  Settings,
  LayoutGrid,
  CheckCircle2,
  Circle,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Calendar
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const scoreStore = useScoreStore()
const txStore = useTransactionsStore()
const budgetStore = useBudgetStore()
const groupStore = useGroupStore()
const debtsStore = useDebtsStore()

const user = computed(() => authStore.user || { displayName: 'ผู้ใช้', avatarUrl: '', subscriptionTier: 'free' })
const scoreData = computed(() => scoreStore.currentScore)

// Computed financial metrics
const monthlyIncome = computed(() => {
  return txStore.items
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
})

const monthlyExpense = computed(() => {
  return txStore.items
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
})

const totalBudgetLimit = computed(() => {
  return budgetStore.categories.reduce((sum, c) => sum + c.limitAmount, 0)
})

const totalBudgetSpent = computed(() => {
  return budgetStore.categories.reduce((sum, c) => sum + c.spentAmount, 0)
})

// Daily Quests computation
const dailyQuests = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  const loggedToday = txStore.items.some(t => t.date === todayStr)
  
  const spentPercent = totalBudgetLimit.value > 0 ? (totalBudgetSpent.value / totalBudgetLimit.value) * 100 : 0
  const budgetUnderLimit = spentPercent <= 100
  
  const hasStreak = scoreData.value.streakDays > 0

  return [
    { label: 'บันทึกธุรกรรมวันนี้ (Daily Transaction Log)', completed: loggedToday },
    { label: 'รักษารายจ่ายไม่ให้เกินงบรวม (Budget Shield)', completed: budgetUnderLimit },
    { label: 'รักษาวินัยบันทึกต่อเนื่อง (Keep Active Streak)', completed: hasStreak }
  ]
})

const completedQuestsCount = computed(() => {
  return dailyQuests.value.filter(q => q.completed).length
})

const questsProgressPercent = computed(() => {
  return Math.round((completedQuestsCount.value / dailyQuests.value.length) * 100)
})

// Debts progress computation
const hasDebts = computed(() => debtsStore.items.length > 0)
const totalOriginalDebt = computed(() => debtsStore.totalOriginalAmount)
const totalDebtBalance = computed(() => debtsStore.totalBalance)
const debtPayoffPercent = computed(() => {
  if (totalOriginalDebt.value === 0) return 0
  const paid = totalOriginalDebt.value - totalDebtBalance.value
  return Math.min(Math.max(Math.round((paid / totalOriginalDebt.value) * 100), 0), 100)
})

// Recent 3 Transactions
const recentTransactions = computed(() => {
  return [...txStore.items]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)
})

const formatCategoryThai = (cat) => {
  const mapping = {
    'Food': 'อาหาร',
    'Transport': 'การเดินทาง',
    'Housing': 'ที่อยู่อาศัย',
    'Utilities': 'สาธารณูปโภค',
    'Entertainment': 'ความบันเทิง',
    'Health': 'สุขภาพ',
    'Education': 'การศึกษา',
    'Debt Payment': 'ชำระหนี้',
    'Savings': 'เงินออม',
    'Income': 'รายได้',
    'Other': 'อื่นๆ'
  }
  return mapping[cat] || cat
}

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
}

function navigateToScore() {
  // Score details overlay
}
</script>

<template>
  <div class="page-shell max-w-lg md:max-w-none">
    
    <!-- Header Block -->
    <div class="flex items-center justify-between py-3 border-b-2 border-border-subtle mb-4">
      <div class="flex items-center gap-3">
        <img 
          :src="user.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
          class="w-12 h-12 rounded-full border-2 border-border-subtle bg-surface-card" 
        />
        <div class="flex flex-col">
          <span class="text-xs font-bold text-ink-muted leading-none">{{ $t('dashboard.welcome') }},</span>
          <span class="text-xl font-brand font-black text-ink leading-none mt-1 flex items-center gap-1.5">
            {{ user.displayName }} 👋
            <Sparkles v-if="user.subscriptionTier === 'premium'" class="w-4 h-4 text-amber-500 fill-amber-500" />
          </span>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          @click="router.push('/hub')"
          class="btn-secondary p-2 min-h-0 rounded-xl"
          title="ศูนย์แอป"
        >
          <LayoutGrid class="w-4 h-4" />
        </button>
        <button 
          @click="router.push('/settings')"
          class="btn-secondary p-2 min-h-0 rounded-xl"
        >
          <Settings class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Responsive Layout Columns -->
    <div class="flex flex-col md:flex-row-reverse md:gap-6 items-start gap-5">
      
      <!-- Right Side Column (ScoreCard) -->
      <div class="w-full md:w-80 shrink-0 md:sticky md:top-6">
        <ScoreCard 
          :score="scoreData.totalScore"
          :tier="scoreData.tier"
          :tier-th="scoreData.tierTh"
          :streak-days="scoreData.streakDays"
          :days-active="scoreData.daysActive"
        />
      </div>

      <!-- Left Side Column (Details & Teasers) -->
      <div class="w-full flex-1 space-y-5">
        
        <!-- Quick Group Teaser -->
        <div 
          v-if="groupStore.currentGroup"
          @click="router.push('/circle')"
          class="circle-teaser animate-fade-in"
        >
          <div class="flex items-center gap-2.5 font-bold">
            <div class="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span class="text-xs font-black">{{ $t('dashboard.circleActivity', { name: groupStore.currentGroup?.name }) }}</span>
          </div>
          <div class="flex items-center gap-1 text-label text-primary uppercase font-extrabold tracking-wider">
            <span>{{ $t('dashboard.viewRank') }}</span>
            <ArrowRight class="w-3 h-3" />
          </div>
        </div>
        
        <div 
          v-else
          @click="router.push('/circle')"
          class="circle-teaser border-2 border-dashed border-border-subtle bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <div class="flex items-center gap-2.5 font-bold">
            <span class="text-xs font-black text-ink-muted">คุณยังไม่มีกลุ่มเพื่อน — เข้าร่วมกลุ่มเพื่อแข่งขันคะแนนกับเพื่อน</span>
          </div>
          <div class="flex items-center gap-1 text-label text-primary uppercase font-extrabold tracking-wider">
            <span>ไปที่กลุ่ม</span>
            <ArrowRight class="w-3 h-3" />
          </div>
        </div>

        <!-- Daily Quests Panel -->
        <div class="surface-card p-5 space-y-4 border-2 border-border-subtle rounded-xl bg-surface-card">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-brand font-black text-ink flex items-center gap-1.5">
              <Award class="w-5 h-5 text-primary" />
              <span>ภารกิจรายวัน (Daily Quests)</span>
            </h3>
            <span class="text-xs font-bold text-ink-muted">{{ completedQuestsCount }} / {{ dailyQuests.length }} สำเร็จ</span>
          </div>

          <!-- Quest Progress Bar -->
          <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div 
              class="h-full rounded-full bg-primary transition-all duration-500"
              :style="{ width: `${questsProgressPercent}%` }"
            />
          </div>

          <!-- Quests Checklist -->
          <div class="space-y-2.5 pt-1">
            <div 
              v-for="quest in dailyQuests" 
              :key="quest.label"
              class="flex items-center justify-between text-xs font-bold p-2.5 rounded-xl border-2 border-border-subtle transition-colors"
              :class="quest.completed ? 'bg-duo-green-light/20 border-primary/20 text-primary' : 'bg-slate-50/50 text-ink'"
            >
              <div class="flex items-center gap-2.5">
                <CheckCircle2 v-if="quest.completed" class="w-4.5 h-4.5 text-primary fill-duo-green-light" />
                <Circle v-else class="w-4.5 h-4.5 text-ink-muted" />
                <span>{{ quest.label }}</span>
              </div>
              <span 
                v-if="quest.completed" 
                class="text-micro font-black uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full"
              >
                เสร็จสิ้น
              </span>
            </div>
          </div>
        </div>

        <!-- Pocket Tiles Grid -->
        <div class="grid grid-cols-2 gap-4">
          
          <!-- Wallet Tile -->
          <div 
            @click="router.push('/tracker')"
            class="tile-pastel tile-pastel--sky p-4 border-2 border-border-subtle rounded-xl cursor-pointer hover:scale-[1.01] transition-transform"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-xs font-black text-tier-steady uppercase tracking-wider">{{ $t('dashboard.wallet') }}</span>
              <TrendingUp class="w-5 h-5 text-tier-steady animate-pulse" />
            </div>
            <div class="space-y-2.5 mt-5">
              <div class="flex justify-between items-center border-b border-sky-100 pb-1.5">
                <span class="text-caption font-bold text-ink-muted leading-none">{{ $t('dashboard.income') }}</span>
                <span class="text-sm font-brand font-black text-primary leading-none">{{ formatCurrency(monthlyIncome) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-caption font-bold text-ink-muted leading-none">{{ $t('dashboard.expense') }}</span>
                <span class="text-sm font-brand font-black text-tier-risk leading-none">{{ formatCurrency(monthlyExpense) }}</span>
              </div>
            </div>
          </div>

          <!-- Budget Tile -->
          <div 
            @click="router.push('/budget')"
            class="tile-pastel tile-pastel--teal p-4 border-2 border-border-subtle rounded-xl cursor-pointer hover:scale-[1.01] transition-transform"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-xs font-black text-primary uppercase tracking-wider">{{ $t('dashboard.budgetControl') }}</span>
              <PieChart class="w-5 h-5 text-primary" />
            </div>
            <div class="space-y-2 mt-5">
              <div class="flex flex-col">
                <span class="text-caption font-bold text-ink-muted leading-none">{{ $t('dashboard.spent') }}</span>
                <span class="text-sm font-brand font-black text-ink mt-1.5">{{ formatCurrency(totalBudgetSpent) }}</span>
              </div>
              <div class="w-full bg-slate-200/50 rounded-full h-2 mt-1.5 overflow-hidden">
                <div 
                  class="bg-primary h-full rounded-full transition-all duration-500" 
                  :style="{ width: `${Math.min((totalBudgetSpent / (totalBudgetLimit || 1)) * 100, 100)}%` }"
                />
              </div>
              <span class="text-micro font-bold text-ink-muted block mt-1">{{ $t('dashboard.outOf', { total: formatCurrency(totalBudgetLimit) }) }}</span>
            </div>
          </div>

          <!-- Debts Progress or Celebration Tile -->
          <div 
            v-if="hasDebts"
            @click="router.push('/debts')"
            class="tile-pastel tile-pastel--amber col-span-2 p-4 border-2 border-border-subtle rounded-xl cursor-pointer hover:scale-[1.005] transition-transform flex flex-col justify-between gap-4"
          >
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-tier-building">
                  <Coins class="w-5 h-5" />
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-black text-tier-building uppercase tracking-wider">{{ $t('dashboard.debts') }}</span>
                  <span class="text-caption font-bold text-ink-muted mt-0.5">{{ $t('dashboard.debtsDesc') }}</span>
                </div>
              </div>
              <div class="flex flex-col text-right justify-center">
                <span class="text-micro font-bold text-ink-muted leading-none">{{ $t('dashboard.totalDebt') }}</span>
                <span class="text-sm font-brand font-black text-ink mt-1.5 leading-none">
                  {{ formatCurrency(debtsStore.totalBalance) }}
                </span>
              </div>
            </div>

            <!-- Payoff Progress -->
            <div class="space-y-1.5 bg-surface-card/60 p-2.5 rounded-xl border-2 border-amber-200/50">
              <div class="flex justify-between items-center text-caption font-bold">
                <span class="text-tier-building">เป้าหมายชำระคืนคืบหน้า</span>
                <span class="text-ink">เคลียร์หนี้แล้ว {{ debtPayoffPercent }}%</span>
              </div>
              <div class="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden">
                <div 
                  class="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  :style="{ width: `${debtPayoffPercent}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Debt-Free Celebration state if no debts! -->
          <div 
            v-else
            @click="router.push('/debts')"
            class="tile-pastel tile-pastel--teal col-span-2 p-4 border-2 border-primary/20 bg-duo-green-light/10 rounded-xl cursor-pointer hover:scale-[1.005] transition-transform flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary animate-bounce">
                <ShieldCheck class="w-5.5 h-5.5" />
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-black text-primary uppercase tracking-wider">ปลอดหนี้สิน! (Debt-Free)</span>
                <p class="text-caption font-bold text-ink-muted mt-0.5">ยินดีด้วยครับ! คุณไม่มีภาระหนี้สินในระบบในขณะนี้</p>
              </div>
            </div>
            <div class="text-caption font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase shrink-0">
              รักษาไว้ 🎉
            </div>
          </div>

        </div>

        <!-- Recent Activity Feed -->
        <div class="surface-card p-4 border-2 border-border-subtle rounded-xl bg-surface-card space-y-3.5">
          <div class="flex justify-between items-center border-b-2 border-border-subtle pb-2">
            <h4 class="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Calendar class="w-4.5 h-4.5 text-primary" />
              <span>ธุรกรรมล่าสุด (Recent Activity)</span>
            </h4>
            <button 
              @click="router.push('/tracker')"
              class="text-caption font-extrabold text-primary hover:underline cursor-pointer"
            >
              ดูทั้งหมด
            </button>
          </div>

          <div class="space-y-2">
            <div v-if="recentTransactions.length === 0" class="text-center py-6 text-xs font-bold text-ink-muted">
              ยังไม่มีการบันทึกรายการใดๆ
            </div>

            <div 
              v-for="tx in recentTransactions" 
              :key="tx.id"
              class="flex items-center justify-between p-2 rounded-xl border-2 border-border-subtle bg-slate-50/20 text-xs hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div 
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 font-bold"
                  :class="tx.type === 'income' ? 'bg-duo-green-light/40 text-primary' : 'bg-bubblegum-pink/10 text-tier-risk'"
                >
                  <ArrowUpRight v-if="tx.type === 'income'" class="w-3.5 h-3.5" />
                  <ArrowDownRight v-else class="w-3.5 h-3.5" />
                </div>
                <div class="flex flex-col min-w-0 font-bold">
                  <span class="text-xs font-bold text-ink leading-tight">{{ formatCategoryThai(tx.category) }}</span>
                  <span v-if="tx.note" class="text-micro text-ink-muted mt-0.5 max-w-[150px] truncate">{{ tx.note }}</span>
                </div>
              </div>

              <span 
                class="font-brand font-black text-sm"
                :class="tx.type === 'income' ? 'text-primary' : 'text-ink'"
              >
                {{ tx.type === 'income' ? '+' : '-' }}{{ formatCurrency(tx.amount) }}
              </span>
            </div>
          </div>
        </div>

        <!-- AI Coaching Teaser (Premium Feature) -->
        <div class="surface-card p-5 border-2 border-sunshine-yellow bg-sunshine-yellow/5 rounded-xl flex items-center justify-between gap-4 relative overflow-hidden">
          <div class="space-y-2.5 max-w-[70%]">
            <span class="chip flex-inline px-2 py-0.5 rounded-full text-micro font-black bg-sunshine-yellow/15 text-tier-building border-tier-building/20">
              {{ $t('dashboard.premiumBadge') }}
            </span>
            <h3 class="text-sm font-brand font-black text-ink leading-tight">{{ $t('dashboard.premiumTitle') }}</h3>
            <p class="text-caption font-bold text-ink-muted leading-relaxed">
              {{ $t('dashboard.premiumDesc') }}
            </p>

            <button 
              @click="router.push('/chat')"
              class="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs cursor-pointer mt-1"
            >
              <Sparkles class="w-3.5 h-3.5 fill-white text-white" />
              <span>คุยกับ AI โค้ช</span>
            </button>
          </div>
          <div class="w-16 h-16 rounded-full bg-sunshine-yellow/10 flex items-center justify-center text-tier-building shrink-0">
            <Sparkles class="w-8 h-8 fill-current" />
          </div>
        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
/* Remove list styling overrides */
</style>
