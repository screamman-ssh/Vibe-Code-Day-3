<script setup>
import { ref } from 'vue'
import { Send } from 'lucide-vue-next'

const props = defineProps({
  placeholder: { type: String, default: 'เขียนความคิดเห็น...' },
  maxLength: { type: Number, default: 280 },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const content = ref('')

function handleSubmit() {
  const text = content.value.trim()
  if (!text || props.submitting) return
  emit('submit', text)
  content.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <textarea
      v-model="content"
      rows="2"
      :maxlength="maxLength"
      :placeholder="placeholder"
      class="input-field resize-none text-sm"
    />
    <div class="flex items-center justify-between gap-2">
      <span class="text-micro text-ink-muted">{{ content.length }}/{{ maxLength }}</span>
      <button
        type="button"
        class="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
        :disabled="submitting || !content.trim()"
        @click="handleSubmit"
      >
        <Send class="w-3.5 h-3.5" />
        {{ submitting ? 'กำลังส่ง...' : 'ตอบกลับ' }}
      </button>
    </div>
  </div>
</template>
