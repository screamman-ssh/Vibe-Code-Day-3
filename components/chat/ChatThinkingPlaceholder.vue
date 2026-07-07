<script setup>
import { computed } from 'vue'
import { TOOL_LABELS } from '~/utils/financialTools'

const props = defineProps({
  status: {
    type: String,
    default: 'thinking' // thinking | tools | streaming
  },
  activeTools: {
    type: Array,
    default: () => []
  }
})

const statusText = computed(() => {
  if (props.status === 'tools') return 'กำลังดึงข้อมูลจากแอป...'
  if (props.status === 'streaming') return 'กำลังพิมพ์คำตอบ...'
  return 'กำลังคิดคำตอบ...'
})
</script>

<template>
  <div class="chat-thinking" role="status" aria-live="polite">
    <div class="chat-thinking__row">
      <div class="chat-thinking__dots" aria-hidden="true">
        <span class="chat-thinking__dot" />
        <span class="chat-thinking__dot" />
        <span class="chat-thinking__dot" />
      </div>
      <p class="chat-thinking__text">{{ statusText }}</p>
    </div>
    <div v-if="activeTools.length" class="chat-thinking__tools">
      <span v-for="tool in activeTools" :key="tool" class="tool-status-chip">
        {{ TOOL_LABELS[tool] || tool }}
      </span>
    </div>
  </div>
</template>
