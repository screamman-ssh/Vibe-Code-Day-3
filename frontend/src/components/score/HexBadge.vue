<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  type: { type: String, default: 'gold' }, // 'gold', 'silver', 'bronze', 'blue', 'orange', 'teal'
  size: { type: String, default: 'md' }, // 'sm', 'md', 'lg'
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-8 w-8 text-sm'
    case 'lg': return 'h-16 w-16 text-2xl'
    default: return 'h-11 w-11 text-lg'
  }
})

const gradientColors = computed(() => {
  switch (props.type) {
    case 'silver':
      return {
        bgStart: '#f1f5f9', bgEnd: '#cbd5e1',
        strokeStart: '#94a3b8', strokeEnd: '#475569',
        text: '#334155'
      }
    case 'bronze':
      return {
        bgStart: '#ffedd5', bgEnd: '#fed7aa',
        strokeStart: '#ea580c', strokeEnd: '#9a3412',
        text: '#7c2d12'
      }
    case 'blue':
      return {
        bgStart: '#eff6ff', bgEnd: '#bfdbfe',
        strokeStart: '#3b82f6', strokeEnd: '#1d4ed8',
        text: '#1e3a8a'
      }
    case 'orange':
      return {
        bgStart: '#fff7ed', bgEnd: '#ffedd5',
        strokeStart: '#f97316', strokeEnd: '#c2410c',
        text: '#7c2d12'
      }
    case 'teal':
      return {
        bgStart: '#f0fdf4', bgEnd: '#bbf7d0',
        strokeStart: '#10b981', strokeEnd: '#047857',
        text: '#064e3b'
      }
    case 'gold':
    default:
      return {
        bgStart: '#fef3c7', bgEnd: '#fde68a',
        strokeStart: '#f59e0b', strokeEnd: '#b45309',
        text: '#78350f'
      }
  }
})
</script>

<template>
  <div class="relative flex items-center justify-center shrink-0" :class="sizeClasses">
    <!-- SVG Hexagon Badge -->
    <svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-sm select-none">
      <defs>
        <!-- Background Gradient -->
        <linearGradient :id="`bg-grad-${type}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="gradientColors.bgStart" />
          <stop offset="100%" :stop-color="gradientColors.bgEnd" />
        </linearGradient>
        <!-- Stroke Gradient -->
        <linearGradient :id="`stroke-grad-${type}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="gradientColors.strokeStart" />
          <stop offset="100%" :stop-color="gradientColors.strokeEnd" />
        </linearGradient>
      </defs>

      <!-- Outer Hexagon Path (with rounded corners via stroke-linejoin) -->
      <polygon
        points="50,5 90,28 90,72 50,95 10,72 10,28"
        :fill="`url(#bg-grad-${type})`"
        :stroke="`url(#stroke-grad-${type})`"
        stroke-width="7"
        stroke-linejoin="round"
      />

      <!-- Inner Hexagon Accent Line -->
      <polygon
        points="50,14 82,32 82,68 50,86 18,68 18,32"
        fill="none"
        :stroke="gradientColors.strokeStart"
        stroke-width="2.5"
        stroke-dasharray="4,3"
        stroke-linejoin="round"
        opacity="0.65"
      />
    </svg>

    <!-- Center text/content -->
    <span
      class="absolute font-extrabold tracking-tight select-none"
      :style="{ color: gradientColors.text }"
    >
      <slot>{{ value }}</slot>
    </span>
  </div>
</template>
