<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'teal', // gold, silver, bronze, blue, orange, teal
  },
  size: {
    type: String,
    default: 'md', // sm, md, lg
  },
  label: {
    type: String,
    default: '',
  },
  rank: {
    type: [Number, String],
    default: '',
  }
})

const badgeSizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-8 h-8'
    case 'lg': return 'w-16 h-16 text-lg'
    case 'md':
    default:
      return 'w-11 h-11 text-sm'
  }
})

const colors = computed(() => {
  switch (props.variant) {
    case 'gold':
      return {
        start: '#fbbf24',
        end: '#d97706',
        stroke: '#f59e0b',
        text: '#ffffff'
      }
    case 'silver':
      return {
        start: '#e2e8f0',
        end: '#94a3b8',
        stroke: '#cbd5e1',
        text: '#1e293b'
      }
    case 'bronze':
      return {
        start: '#fca5a5',
        end: '#b91c1c',
        stroke: '#ef4444',
        text: '#ffffff'
      }
    case 'blue':
      return {
        start: '#60a5fa',
        end: '#1d4ed8',
        stroke: '#3b82f6',
        text: '#ffffff'
      }
    case 'orange':
      return {
        start: '#ffedd5',
        end: '#fdba74',
        stroke: '#f97316',
        text: '#ea580c'
      }
    case 'teal':
    default:
      return {
        start: '#2dd4bf',
        end: '#0f766e',
        stroke: '#14b8a6',
        text: '#ffffff'
      }
  }
})
</script>

<template>
  <div class="relative flex items-center justify-center font-brand font-bold select-none shrink-0" :class="badgeSizeClass">
    <!-- SVG Hexagon -->
    <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full drop-shadow-sm filter transition-transform duration-200 hover:scale-105">
      <defs>
        <linearGradient :id="`grad-${variant}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="colors.start" />
          <stop offset="100%" :stop-color="colors.end" />
        </linearGradient>
      </defs>
      <polygon
        points="50,4 93,25 93,75 50,96 7,75 7,25"
        :fill="`url(#grad-${variant})`"
        :stroke="colors.stroke"
        stroke-width="5"
        stroke-linejoin="round"
      />
    </svg>
    
    <!-- Content overlay -->
    <div class="relative z-10 flex flex-col items-center justify-center" :style="{ color: colors.text }">
      <span v-if="rank" class="leading-none select-none tracking-tight">{{ rank }}</span>
      <span v-else-if="label" class="leading-none text-[9px] uppercase tracking-wide select-none">{{ label }}</span>
      <slot v-else />
    </div>
  </div>
</template>

<style scoped>
svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}
</style>
