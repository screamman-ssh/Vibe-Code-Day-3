<script setup>
import { ref, watch } from 'vue'
import {
  Bold,
  Italic,
  List,
  Link2,
  AtSign,
  Code2,
  Send
} from 'lucide-vue-next'
import { wrapSelection, prefixLines } from '~/composables/useMarkdownEditor'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'แชร์ความรู้หรือความคืบหน้าการเงินของคุณ...' },
  maxLength: { type: Number, default: 500 },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit'])

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

function applyMention() {
  apply(ta => wrapSelection(ta, '@', ''))
}

function applyCode() {
  apply(ta => wrapSelection(ta, '`', '`'))
}

function handleSubmit() {
  if (!props.modelValue.trim() || props.disabled || props.submitting) return
  emit('submit')
}
</script>

<template>
  <div class="rounded-2xl bg-primary-light/40 border-2 border-border-subtle p-4">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      rows="3"
      :maxlength="maxLength"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full bg-transparent text-sm text-ink resize-none outline-none placeholder:text-ink-muted min-h-[4.5rem] leading-relaxed"
      @input="onInput"
    />

    <div class="flex items-center justify-between gap-3 mt-3 pt-1">
      <div class="flex items-center gap-0.5 text-ink-muted">
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="ตัวหนา"
          :disabled="disabled"
          @click="applyBold"
        >
          <Bold class="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="โค้ด"
          :disabled="disabled"
          @click="applyCode"
        >
          <Code2 class="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="กล่าวถึง"
          :disabled="disabled"
          @click="applyMention"
        >
          <AtSign class="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="ตัวเอียง"
          :disabled="disabled"
          @click="applyItalic"
        >
          <Italic class="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="รายการ"
          :disabled="disabled"
          @click="applyList"
        >
          <List class="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:bg-white/80 hover:text-ink transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="ลิงก์"
          :disabled="disabled"
          @click="applyLink"
        >
          <Link2 class="w-[18px] h-[18px]" />
        </button>
      </div>

      <button
        type="button"
        class="w-10 h-10 shrink-0 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-accent-emerald-hover transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style="box-shadow: 0 2px 0 #861212"
        :disabled="disabled || submitting || !modelValue.trim()"
        @click="handleSubmit"
      >
        <Send class="w-[18px] h-[18px]" />
      </button>
    </div>
  </div>
</template>
