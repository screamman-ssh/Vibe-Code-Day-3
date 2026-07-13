<script setup>
import { ref, watch } from 'vue'
import { Bold, Italic, List, Link2 } from 'lucide-vue-next'
import { wrapSelection, prefixLines } from '~/composables/useMarkdownEditor'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'แชร์ความคืบหน้าการเงินของคุณ...' },
  maxLength: { type: Number, default: 500 },
  rows: { type: Number, default: 3 },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)

watch(() => props.modelValue, (val) => {
  if (textareaRef.value && textareaRef.value.value !== val) {
    textareaRef.value.value = val
  }
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function apply(fn) {
  if (!textareaRef.value || props.disabled) return
  const next = fn(textareaRef.value)
  emit('update:modelValue', next)
}

function applyBold() {
  apply(ta => wrapSelection(ta, '**', '**'))
}

function applyItalic() {
  apply(ta => wrapSelection(ta, '*', '*'))
}

function applyList() {
  apply(ta => prefixLines(ta, '- '))
}

function applyLink() {
  apply(ta => wrapSelection(ta, '[', '](https://)'))
}
</script>

<template>
  <div class="rounded-xl border-2 border-border-subtle bg-surface-card overflow-hidden">
    <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-border-subtle bg-surface-bg">
      <button
        type="button"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="ตัวหนา"
        :disabled="disabled"
        @click="applyBold"
      >
        <Bold class="w-4 h-4" />
      </button>
      <button
        type="button"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="ตัวเอียง"
        :disabled="disabled"
        @click="applyItalic"
      >
        <Italic class="w-4 h-4" />
      </button>
      <button
        type="button"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="รายการ"
        :disabled="disabled"
        @click="applyList"
      >
        <List class="w-4 h-4" />
      </button>
      <button
        type="button"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="ลิงก์"
        :disabled="disabled"
        @click="applyLink"
      >
        <Link2 class="w-4 h-4" />
      </button>
      <span class="ml-auto text-micro text-ink-muted hidden sm:inline">รองรับ Markdown</span>
    </div>
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :rows="rows"
      :maxlength="maxLength"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full px-3 py-2.5 text-sm text-ink bg-transparent resize-none outline-none placeholder:text-ink-muted/70 min-h-[5.5rem]"
      @input="onInput"
    />
  </div>
</template>
