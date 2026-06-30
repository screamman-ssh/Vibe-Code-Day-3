<script setup>
import { computed } from 'vue'
import { Flame, Play } from 'lucide-vue-next'
import { tierColor } from '../../composables/useFormat.js'

const props = defineProps({
  score: { type: Number, required: true },
  tier: { type: String, required: true },
  tierTh: { type: String, required: true },
  streak: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})

const radius = 50
const strokeWidth = 8
const normalizedRadius = radius - strokeWidth / 2
const circumference = 2 * Math.PI * normalizedRadius
const visibleArc = (240 / 360) * circumference
const gapArc = circumference - visibleArc

const strokeDashoffset = computed(() => {
  const scorePercent = Math.max(0, Math.min(100, props.score)) / 100
  return visibleArc * (1 - scorePercent)
})

const activeColorClass = computed(() => {
  switch (props.tier) {
    case 'At Risk': return '#ef4444'
    case 'Building': return '#f59e0b'
    case 'Steady': return '#3b82f6'
    case 'Thriving': return '#10b981'
    default: return '#10b981'
  }
})

const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

const streakDaysState = computed(() => {
  return daysOfWeek.map((day, idx) => {
    let isActive = false
    const diff = currentDayIndex - idx
    if (diff >= 0 && diff < props.streak) {
      isActive = true
    } else if (diff < 0 && props.streak >= 7) {
      isActive = true
    }
    return { label: day, active: isActive, isToday: idx === currentDayIndex }
  })
})
</script>

<template>
  <div
    class="surface-card flex flex-col items-center justify-center text-ink"
    :class="compact ? '!p-4' : ''"
  >
    <div class="w-full flex justify-between items-center mb-4">
      <span class="meta-label">สุขภาพการเงินของฉัน</span>
      <span class="chip text-[11px] font-semibold" :class="tierColor(tier)">
        {{ tierTh }}
      </span>
    </div>

    <div class="relative flex items-center justify-center select-none" :style="{ width: '160px', height: '140px' }">
      <svg viewBox="0 0 120 120" class="w-full h-full transform -rotate-[210deg]">
        <circle
          cx="60"
          cy="60"
          :r="normalizedRadius"
          fill="none"
          stroke="#f1f5f9"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          :stroke-dasharray="`${visibleArc} ${gapArc}`"
        />
        <circle
          cx="60"
          cy="60"
          :r="normalizedRadius"
          fill="none"
          :stroke="activeColorClass"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          :stroke-dasharray="`${visibleArc} ${gapArc}`"
          :stroke-dashoffset="strokeDashoffset"
          class="transition-all duration-500 ease-out"
        />
      </svg>

      <div class="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span class="meta-label leading-none">คะแนนปัจจุบัน</span>
        <span class="font-brand text-4xl font-bold tracking-tight mt-1 leading-none text-ink">{{ score }}</span>
        <span class="meta-label mt-1 leading-none">เต็ม 100</span>
      </div>
    </div>

    <div class="w-full bg-surface-bg border border-border-subtle rounded-lg p-2 flex items-center gap-3 mb-5">
      <div class="h-8 w-8 rounded-full bg-accent-emerald flex items-center justify-center text-white shrink-0">
        <Play class="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      </div>
      <span class="text-xs font-medium text-ink-muted">รักษาสตรีคประจำวันของคุณ</span>
    </div>

    <div class="w-full flex items-center justify-between border-t border-border-subtle pt-4">
      <div class="flex items-center gap-1.5">
        <div
          v-for="(day, idx) in streakDaysState"
          :key="idx"
          class="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
          :class="[
            day.active
              ? 'bg-streak-flame text-white'
              : 'bg-border-subtle text-ink-muted',
            day.isToday && !day.active ? 'border border-dashed border-streak-flame/50' : '',
          ]"
        >
          <Flame v-if="day.active" class="h-3 w-3" aria-hidden="true" />
          <span v-else>{{ day.label }}</span>
        </div>
      </div>

      <div class="flex items-center gap-1 pl-2 text-streak-flame">
        <Flame class="h-4 w-4" aria-hidden="true" />
        <span class="text-sm font-semibold">×{{ streak }}</span>
      </div>
    </div>
  </div>
</template>
