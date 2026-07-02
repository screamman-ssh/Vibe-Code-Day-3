<script setup>
import { computed } from 'vue'
import { useRouter } from '#imports'
import { useBudgetStore } from '~/stores/budget'
import { useDebtsStore } from '~/stores/debts'
import {
  LayoutGrid,
  PiggyBank,
  Wallet,
  Settings,
  ArrowRight,
  PieChart
} from 'lucide-vue-next'

const router = useRouter()
const budgetStore = useBudgetStore()
const debtsStore = useDebtsStore()
const totalBudgetLimit = computed(() =>
  budgetStore.categories.reduce((s, c) => s + c.limitAmount, 0)
)
const totalBudgetSpent = computed(() =>
  budgetStore.categories.reduce((s, c) => s + c.spentAmount, 0)
)
const budgetPercent = computed(() =>
  totalBudgetLimit.value ? Math.round((totalBudgetSpent.value / totalBudgetLimit.value) * 100) : 0
)
const overBudgetCount = computed(() =>
  budgetStore.categories.filter(c => c.spentAmount > c.limitAmount).length
)

const formatCurrency = (val) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)

const sections = computed(() => [
  {
    id: 'tools',
    title: 'เครื่องมือการเงิน',
    subtitle: 'งบประมาณ หนี้สิน และการตั้งค่า',
    modules: [
      {
        path: '/budget',
        title: 'งบประมาณ',
        titleEn: 'Budget',
        description: 'ตั้งเพดานรายหมวด ติดตามการใช้จ่าย และควบคุมไม่ให้เกินงบ',
        icon: PiggyBank,
        tone: 'teal',
        stat: `${budgetPercent.value}% ใช้ไป`,
        badge: overBudgetCount.value ? `${overBudgetCount.value} หมวดเกินงบ` : null,
        badgeTone: 'warn'
      },
      {
        path: '/debts',
        title: 'จัดการหนี้สิน',
        titleEn: 'Debt Manager',
        description: 'บันทึกหนี้ จำลองแผนปลดหนี้ และวิเคราะห์ด้วย AI',
        icon: Wallet,
        tone: 'amber',
        stat: formatCurrency(debtsStore.totalBalance),
        badge: debtsStore.items.length ? `${debtsStore.items.length} บัญชี` : 'ยังไม่มีหนี้',
        badgeTone: 'neutral'
      },
      {
        path: '/settings',
        title: 'ตั้งค่าระบบ',
        titleEn: 'Settings',
        description: 'โปรไฟล์ API Key และการตั้งค่าแอป',
        icon: Settings,
        tone: 'neutral',
        stat: null,
        badge: null,
        badgeTone: 'neutral'
      }
    ]
  }
])

function go(path) {
  router.push(path)
}
</script>

<template>
  <div class="page-shell hub-page">
    <header class="hub-page__header">
      <div class="hub-page__header-icon">
        <LayoutGrid class="w-5 h-5" />
      </div>
      <div>
        <h1 class="page-title font-brand">ศูนย์แอป</h1>
        <p class="page-lead">เข้าถึงฟังก์ชันสำคัญของ MoneyCircle ได้จากที่เดียว</p>
      </div>
    </header>

    <!-- Quick stats strip -->
    <div class="hub-page__stats">
      <div class="hub-page__stat">
        <PieChart class="w-3.5 h-3.5 text-primary" />
        <span class="hub-page__stat-label">งบใช้ไป</span>
        <span class="hub-page__stat-value">{{ budgetPercent }}%</span>
      </div>
      <div class="hub-page__stat">
        <Wallet class="w-3.5 h-3.5 text-tier-building" />
        <span class="hub-page__stat-label">หนี้คงค้าง</span>
        <span class="hub-page__stat-value">{{ formatCurrency(debtsStore.totalBalance) }}</span>
      </div>
    </div>

    <!-- Module sections -->
    <section
      v-for="section in sections"
      :key="section.id"
      class="hub-page__section"
    >
      <div class="hub-page__section-head">
        <h2 class="section-title">{{ section.title }}</h2>
        <p class="text-[10px] text-ink-muted">{{ section.subtitle }}</p>
      </div>

      <div class="hub-page__grid">
        <button
          v-for="mod in section.modules"
          :key="mod.path + mod.title"
          type="button"
          class="hub-card"
          :class="`hub-card--${mod.tone}`"
          @click="go(mod.path)"
        >
          <div class="hub-card__top">
            <div class="hub-card__icon">
              <component :is="mod.icon" class="w-5 h-5" />
            </div>
            <ArrowRight class="w-4 h-4 text-ink-muted hub-card__arrow" />
          </div>

          <div class="hub-card__body">
            <p class="hub-card__title">{{ mod.title }}</p>
            <p class="hub-card__title-en">{{ mod.titleEn }}</p>
            <p class="hub-card__desc">{{ mod.description }}</p>
          </div>

          <div v-if="mod.stat || mod.badge" class="hub-card__footer">
            <span v-if="mod.stat" class="hub-card__stat">{{ mod.stat }}</span>
            <span
              v-if="mod.badge"
              class="hub-card__badge"
              :class="{
                'hub-card__badge--warn': mod.badgeTone === 'warn',
                'hub-card__badge--premium': mod.badgeTone === 'premium'
              }"
            >
              {{ mod.badge }}
            </span>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hub-page__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.25rem 0 0.5rem;
}

.hub-page__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: color-mix(in oklch, var(--color-primary) 12%, white);
  color: var(--color-primary);
  flex-shrink: 0;
}

.hub-page__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.hub-page__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.625rem 0.375rem;
  border-radius: 0.75rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
}

.hub-page__stat-label {
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.hub-page__stat-value {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-ink);
  text-align: center;
  line-height: 1.2;
}

.hub-page__section {
  margin-bottom: 1.5rem;
}

.hub-page__section-head {
  margin-bottom: 0.625rem;
}

.hub-page__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;
}

@media (min-width: 640px) {
  .hub-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .hub-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.hub-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
  min-height: 9rem;
}

.hub-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.hub-card:active {
  transform: scale(0.99);
}

.hub-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.625rem;
}

.hub-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.625rem;
}

.hub-card--teal .hub-card__icon {
  background: color-mix(in oklch, var(--color-primary) 14%, white);
  color: var(--color-primary);
}

.hub-card--amber .hub-card__icon {
  background: color-mix(in oklch, var(--color-tier-building) 18%, white);
  color: var(--color-tier-building);
}

.hub-card--sky .hub-card__icon {
  background: color-mix(in oklch, var(--color-tier-steady) 14%, white);
  color: var(--color-tier-steady);
}

.hub-card--mint .hub-card__icon {
  background: color-mix(in oklch, var(--color-accent-emerald) 14%, white);
  color: var(--color-accent-emerald);
}

.hub-card--neutral .hub-card__icon {
  background: var(--color-surface-bg);
  color: var(--color-ink-muted);
}

.hub-card__arrow {
  opacity: 0;
  transition: opacity 150ms, transform 150ms;
}

.hub-card:hover .hub-card__arrow {
  opacity: 1;
  transform: translateX(2px);
}

.hub-card__title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-ink);
  line-height: 1.2;
}

.hub-card__title-en {
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
}

.hub-card__desc {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  line-height: 1.45;
  margin-top: 0.375rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hub-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.625rem;
}

.hub-card__stat {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-ink);
}

.hub-card__badge {
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--color-surface-bg);
  color: var(--color-ink-muted);
  border: 1px solid var(--color-border-subtle);
  white-space: nowrap;
}

.hub-card__badge--warn {
  background: color-mix(in oklch, var(--color-tier-risk) 10%, white);
  color: var(--color-tier-risk);
  border-color: color-mix(in oklch, var(--color-tier-risk) 20%, transparent);
}

.hub-card__badge--premium {
  background: color-mix(in oklch, var(--color-tier-building) 12%, white);
  color: var(--color-tier-building);
  border-color: color-mix(in oklch, var(--color-tier-building) 25%, transparent);
}
</style>
