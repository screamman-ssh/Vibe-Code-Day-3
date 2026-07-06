<script setup>
import { computed, ref, onMounted } from 'vue'
import { Flame } from 'lucide-vue-next'

import { useI18n } from 'vue-i18n'

const props = defineProps({
  score: {
    type: Number,
    default: 50,
  },
  tier: {
    type: String,
    default: 'Building',
  },
  tierTh: {
    type: String,
    default: 'กำลังสร้าง',
  },
  streakDays: {
    type: Number,
    default: 0,
  },
  daysActive: {
    type: Array,
    default: () => [false, false, false, false, false, false, false], // Past 7 days status
  }
})

// i18n
const { locale } = useI18n()

// Tier styles mapping
const tierColorClass = computed(() => {
  switch (props.tier.toLowerCase()) {
    case 'risk':
    case 'at risk':
    case 'at_risk':
      return {
        bg: 'bg-red-50 dark:bg-red-950/20',
        text: 'text-tier-risk',
        border: 'border-red-100 dark:border-red-900/30',
        gauge: '#ef4444'
      }
    case 'building':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-tier-building',
        border: 'border-amber-100 dark:border-amber-900/30',
        gauge: '#f59e0b'
      }
    case 'steady':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/20',
        text: 'text-tier-steady',
        border: 'border-blue-100 dark:border-blue-900/30',
        gauge: '#3b82f6'
      }
    case 'thriving':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        text: 'text-accent-emerald',
        border: 'border-emerald-100 dark:border-emerald-900/30',
        gauge: '#10b981'
      }
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-ink-muted',
        border: 'border-slate-100 dark:border-slate-700/30',
        gauge: '#94a3b8'
      }
  }
})

// Radial Gauge calculations (240 degree gauge)
const radius = 50
const strokeWidth = 8
const circumference = 2 * Math.PI * radius
const dashoffset = computed(() => {
  const percent = Math.min(Math.max(props.score, 0), 100)
  // Re-scale 0-100% to fit within the 240 degree active range of the 360 degree circle
  const activeCircumference = circumference * (240 / 360)
  const offset = circumference - (percent / 100) * activeCircumference
  return offset
})

// Day indicators labels
const daysLabels = computed(() => {
  return locale.value === 'en'
    ? ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']
    : ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
})

// Gauge track color adapts to theme
const isDark = ref(false)
onMounted(() => {
  if (typeof window !== 'undefined') {
    isDark.value = document.documentElement.classList.contains('dark')
    const observer = new MutationObserver(() => {
      isDark.value = document.documentElement.classList.contains('dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
})
const trackColor = computed(() => isDark.value ? '#1e3340' : '#f1f5f9')
</script>

<template>
  <div class="surface-card flex flex-col items-center justify-center relative select-none bg-surface-card border-2 border-border-subtle rounded-xl p-5">
    
    <!-- Score Card Header Title -->
    <span class="text-xs font-extrabold text-ink-muted uppercase tracking-wider text-center">
      {{ $t('score.healthTitle') }}
    </span>

    <!-- Score Gauge -->
    <div class="relative w-48 h-36 flex items-center justify-center mt-1">
      <svg viewBox="0 0 120 120" class="w-full h-full transform -rotate-[210deg] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <!-- Background Track -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          fill="none"
          :stroke="trackColor"
          stroke-linecap="round"
          :stroke-width="strokeWidth"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference * (120 / 360)" 
        />
        <!-- Active Path -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          fill="none"
          :stroke="tierColorClass.gauge"
          stroke-linecap="round"
          :stroke-width="strokeWidth"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashoffset"
          class="transition-all duration-700 ease-out-quart"
        />
      </svg>

      <!-- Center text -->
      <div class="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <span class="text-5xl font-brand font-black text-ink tracking-tight leading-none">
          {{ score }}
        </span>
        <span class="text-caption font-bold text-ink-muted mt-1.5 leading-none uppercase">/ 100</span>
      </div>
    </div>

    <!-- Tier Chip -->
    <div 
      class="chip flex items-center justify-center px-4 py-1.5 rounded-full border text-xs font-extrabold -mt-2 mb-4 leading-none"
      :class="[tierColorClass.bg, tierColorClass.text, tierColorClass.border]"
    >
      {{ locale === 'en' ? tier : tierTh }}
    </div>

    <!-- Streak indicator bar -->
    <div class="w-full border-t border-border-subtle pt-4 px-2">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Flame class="w-4 h-4 text-streak-flame fill-streak-flame animate-pulse" />
          <span>{{ $t('score.streakDays', { days: streakDays }) }}</span>
        </div>
        <span class="text-caption font-bold text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded-full">{{ $t('score.weeklyDiscipline') }}</span>
      </div>
      
      <!-- Past 7 Days Log Status -->
      <div class="flex items-center justify-between gap-1 mt-1">
        <div 
          v-for="(active, index) in daysActive" 
          :key="index"
          class="flex flex-col items-center gap-1 flex-1"
        >
          <div 
            class="w-7 h-7 rounded-full flex items-center justify-center text-caption font-black transition-all duration-300"
            :class="[
              active 
                ? 'bg-streak-flame text-white scale-105 shadow-sm' 
                : 'bg-surface-bg text-ink-muted border border-border-subtle'
            ]"
          >
            <Flame v-if="active" class="w-3.5 h-3.5 fill-white" />
            <span v-else>{{ daysLabels[index] }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ease-out-quart {
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}
</style>
