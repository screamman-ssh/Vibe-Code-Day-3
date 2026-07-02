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
  LayoutGrid
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

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
}

function navigateToScore() {
  // Score details overlay modal state can be placed here, or route to details page
}
</script>

<template>
  <div class="page-shell max-w-lg md:max-w-none">
    
    <!-- Header Block -->
    <div class="flex items-center justify-between py-2">
      <div class="flex items-center gap-3">
        <img 
          :src="user.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg'" 
          class="w-10 h-10 rounded-full border border-border-subtle bg-white" 
        />
        <div class="flex flex-col">
          <span class="text-xs text-ink-muted leading-none">ยินดีต้อนรับ</span>
          <span class="text-base font-bold text-ink leading-none mt-1.5 flex items-center gap-1.5">
            {{ user.displayName }}
            <Sparkles v-if="user.subscriptionTier === 'premium'" class="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </span>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <div
          @click="router.push('/hub')"
          class="p-2 border border-border-subtle rounded-full bg-white text-ink hover:bg-slate-50 cursor-pointer"
          title="ศูนย์แอป"
        >
          <LayoutGrid class="w-4 h-4" />
        </div>
        <div 
          @click="router.push('/settings')"
          class="p-2 border border-border-subtle rounded-full bg-white text-ink hover:bg-slate-50 cursor-pointer"
        >
          <Settings class="w-4 h-4" />
        </div>
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
          @click="router.push('/circle')"
          class="circle-teaser"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-2.5 h-2.5 rounded-full bg-accent-emerald animate-ping" />
            <span class="text-xs font-black">ความเคลื่อนไหวกลุ่ม: {{ groupStore.currentGroup.name }}</span>
          </div>
          <div class="flex items-center gap-1 text-[11px] text-primary uppercase font-extrabold tracking-wider">
            <span>ดูอันดับ</span>
            <ArrowRight class="w-3 h-3" />
          </div>
        </div>

        <!-- Pocket Tiles Grid -->
        <div class="grid grid-cols-2 gap-3">
          
          <!-- Wallet Tile -->
          <div 
            @click="router.push('/tracker')"
            class="tile-pastel tile-pastel--sky"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-[10px] font-bold text-tier-steady uppercase tracking-wider">กระเป๋าเงิน</span>
              <TrendingUp class="w-4 h-4 text-tier-steady" />
            </div>
            <div class="space-y-1.5 mt-4">
              <div class="flex flex-col">
                <span class="text-[10px] text-ink-muted leading-none">รายรับ</span>
                <span class="text-sm font-bold text-ink mt-1">{{ formatCurrency(monthlyIncome) }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] text-ink-muted leading-none">รายจ่าย</span>
                <span class="text-sm font-bold text-ink mt-1">{{ formatCurrency(monthlyExpense) }}</span>
              </div>
            </div>
          </div>

          <!-- Budget Tile -->
          <div 
            @click="router.push('/budget')"
            class="tile-pastel tile-pastel--teal"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-[10px] font-bold text-primary uppercase tracking-wider">คุมงบประมาณ</span>
              <PieChart class="w-4 h-4 text-primary" />
            </div>
            <div class="space-y-1 mt-4">
              <div class="flex flex-col">
                <span class="text-[10px] text-ink-muted leading-none">จ่ายไปแล้ว</span>
                <span class="text-sm font-bold text-ink mt-1">{{ formatCurrency(totalBudgetSpent) }}</span>
              </div>
              <div class="w-full bg-slate-200/50 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  class="bg-primary h-full rounded-full transition-all duration-500" 
                  :style="{ width: `${Math.min((totalBudgetSpent / (totalBudgetLimit || 1)) * 100, 100)}%` }"
                />
              </div>
              <span class="text-[9px] text-ink-muted block mt-1">จากทั้งหมด {{ formatCurrency(totalBudgetLimit) }}</span>
            </div>
          </div>

          <!-- Debts Tile -->
          <div 
            @click="router.push('/debts')"
            class="tile-pastel tile-pastel--amber col-span-2 min-h-[5.5rem] flex flex-row items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-tier-building">
                <Wallet class="w-5 h-5" />
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-tier-building uppercase tracking-wider">ภาระหนี้สิน</span>
                <span class="text-xs text-ink-muted mt-0.5">จัดการภาระหนี้สินรายบัญชี</span>
              </div>
            </div>
            <div class="flex flex-col text-right justify-center">
              <span class="text-[10px] text-ink-muted leading-none">หนี้สะสมทั้งหมด</span>
              <span class="text-base font-brand font-black text-ink mt-1.5 leading-none">
                {{ formatCurrency(debtsStore.totalBalance) }}
              </span>
            </div>
          </div>

        </div>

        <!-- AI Coaching Teaser (Premium Feature) -->
        <div 
          @click="router.push('/chat')"
          class="mission-card cursor-pointer"
        >
          <div class="max-w-[70%] space-y-2">
            <span class="chip flex-inline px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">
              ฟีเจอร์พรีเมียม
            </span>
            <h3 class="text-sm font-bold text-ink leading-tight">ขอคำปรึกษาจาก AI โค้ชสำหรับแผนหนี้สินและการออม</h3>
            <p class="text-[10px] text-ink-muted leading-relaxed">
              รับคำแนะนำกลยุทธ์ชำระหนี้และการลดหมวดใช้จ่ายฟุ่มเฟือยประเมินรายวัน
            </p>
          </div>
          <div class="mission-card__pocket">
            <div class="mission-card__disc shadow-md">
              <Sparkles class="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
          </div>
        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
/* Remove list styling overrides */
</style>
