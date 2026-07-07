<script setup>
import { ref } from 'vue'
import { Repeat2, Quote } from 'lucide-vue-next'

const emit = defineEmits(['simple', 'quote', 'close'])

const showQuoteInput = ref(false)
const quoteText = ref('')

function chooseSimple() {
  emit('simple')
  emit('close')
}

function openQuote() {
  showQuoteInput.value = true
}

function submitQuote() {
  if (!quoteText.value.trim()) return
  emit('quote', quoteText.value.trim())
  quoteText.value = ''
  showQuoteInput.value = false
  emit('close')
}
</script>

<template>
  <div class="absolute left-0 top-full mt-1 z-20 w-56 surface-card border-2 border-border-subtle rounded-xl shadow-lg p-2 space-y-1">
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-ink hover:bg-surface-bg cursor-pointer"
      @click="chooseSimple"
    >
      <Repeat2 class="w-4 h-4 text-emerald-600" />
      รีโพสต์
    </button>
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-ink hover:bg-surface-bg cursor-pointer"
      @click="openQuote"
    >
      <Quote class="w-4 h-4 text-primary" />
      อ้างอิง
    </button>

    <div v-if="showQuoteInput" class="border-t border-border-subtle pt-2 space-y-2">
      <textarea
        v-model="quoteText"
        rows="2"
        maxlength="500"
        placeholder="เพิ่มความคิดเห็นของคุณ..."
        class="input-field resize-none text-sm"
      />
      <div class="flex justify-between items-center">
        <span class="text-micro text-ink-muted">{{ quoteText.length }}/500</span>
        <button
          type="button"
          class="btn-primary text-xs px-3 py-1.5 cursor-pointer"
          :disabled="!quoteText.trim()"
          @click="submitQuote"
        >
          อ้างอิง
        </button>
      </div>
    </div>
  </div>
</template>
