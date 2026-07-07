<script setup>
import { ref } from 'vue'
import { ImagePlus, Camera, Send, X, RotateCcw } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  attachments: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  maxAttachments: {
    type: Number,
    default: 8
  },
  isSyncing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:modelValue',
  'send',
  'add-files',
  'remove-attachment',
  'retry-upload'
])

const galleryInput = ref(null)
const cameraInput = ref(null)
const isDragOver = ref(false)

const canAddMore = () => props.attachments.length < props.maxAttachments

const canSend = () => {
  const hasText = props.modelValue?.trim()
  const hasReadyImage = props.attachments.some(item => item.status === 'ready')
  const isUploading = props.attachments.some(item => item.status === 'uploading')
  return !props.disabled && !isUploading && (hasText || hasReadyImage)
}

function openGallery() {
  if (!canAddMore() || props.disabled) return
  galleryInput.value?.click()
}

function openCamera() {
  if (!canAddMore() || props.disabled) return
  cameraInput.value?.click()
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
}

function onFilesSelected(event) {
  const files = event.target.files
  if (files?.length) emit('add-files', files)
  event.target.value = ''
}

function onPaste(event) {
  if (!canAddMore() || props.disabled) return

  const items = Array.from(event.clipboardData?.items || [])
  const imageFiles = items
    .filter(item => item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)

  if (!imageFiles.length) return
  event.preventDefault()
  emit('add-files', imageFiles)
}

function onDragOver(event) {
  if (!canAddMore() || props.disabled) return
  event.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(event) {
  isDragOver.value = false
  if (!canAddMore() || props.disabled) return

  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
    .filter(file => file.type.startsWith('image/'))

  if (files.length) emit('add-files', files)
}

function submit() {
  if (!canSend()) return
  emit('send')
}
</script>

<template>
  <div
    class="chat-composer"
    :class="{ 'chat-composer--drag': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div v-if="attachments.length" class="chat-composer__attachments">
      <div
        v-for="item in attachments"
        :key="item.id"
        class="chat-composer__thumb"
        :class="{
          'chat-composer__thumb--uploading': item.status === 'uploading',
          'chat-composer__thumb--failed': item.status === 'failed'
        }"
      >
        <img
          v-if="item.localPreviewUrl"
          :src="item.localPreviewUrl"
          :alt="item.fileName"
          class="chat-composer__thumb-img"
        />

        <div v-if="item.status === 'uploading'" class="chat-composer__thumb-overlay">
          <span class="chat-composer__thumb-spinner" />
        </div>

        <div v-else-if="item.status === 'failed'" class="chat-composer__thumb-overlay chat-composer__thumb-overlay--error">
          <button
            type="button"
            class="chat-composer__retry"
            title="ลองอัปโหลดอีกครั้ง"
            @click="emit('retry-upload', item.id)"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          class="chat-composer__remove"
          :disabled="disabled || item.status === 'uploading'"
          aria-label="ลบรูป"
          @click="emit('remove-attachment', item.id)"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <p v-if="isSyncing" class="chat-composer__sync">กำลังบันทึกแบบร่าง...</p>

    <form class="chat-composer__row" @submit.prevent="submit">
      <div class="chat-composer__tools">
        <button
          type="button"
          class="chat-composer__tool"
          :disabled="disabled || !canAddMore()"
          title="เลือกรูปจากแกลเลอรี"
          aria-label="เลือกรูปจากแกลเลอรี"
          @click="openGallery"
        >
          <ImagePlus class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="chat-composer__tool"
          :disabled="disabled || !canAddMore()"
          title="ถ่ายรูป"
          aria-label="ถ่ายรูป"
          @click="openCamera"
        >
          <Camera class="w-4 h-4" />
        </button>
      </div>

      <textarea
        id="chat-message-input"
        :value="modelValue"
        rows="1"
        autocomplete="off"
        aria-label="พิมพ์คำถาม"
        placeholder="พิมพ์คำถามหรือแนบรูป..."
        class="chat-composer__input"
        :disabled="disabled"
        @input="onInput"
        @paste="onPaste"
        @keydown.enter.exact.prevent="submit"
      />

      <button
        type="submit"
        class="chat-composer__send"
        :disabled="!canSend()"
        aria-label="ส่งข้อความ"
      >
        <Send class="w-4 h-4" />
      </button>
    </form>

    <input
      ref="galleryInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple
      class="sr-only"
      @change="onFilesSelected"
    />
    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="sr-only"
      @change="onFilesSelected"
    />
  </div>
</template>

<style scoped>
.chat-composer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: 12px;
  transition: background 150ms, box-shadow 150ms;
}

.chat-composer--drag {
  background: color-mix(in oklch, var(--color-primary) 6%, white);
  box-shadow: inset 0 0 0 2px color-mix(in oklch, var(--color-primary) 25%, transparent);
}

.chat-composer__attachments {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.125rem 0.125rem 0;
  -webkit-overflow-scrolling: touch;
}

.chat-composer__thumb {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid var(--color-border-subtle);
  background: var(--color-surface-card);
}

.chat-composer__thumb--uploading {
  opacity: 0.85;
}

.chat-composer__thumb--failed {
  border-color: color-mix(in oklch, var(--color-danger, #dc2626) 50%, var(--color-border-subtle));
}

.chat-composer__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-composer__thumb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, black 35%, transparent);
}

.chat-composer__thumb-overlay--error {
  background: color-mix(in oklch, var(--color-danger, #dc2626) 25%, transparent);
}

.chat-composer__thumb-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  animation: chat-composer-spin 0.8s linear infinite;
}

@keyframes chat-composer-spin {
  to { transform: rotate(360deg); }
}

.chat-composer__remove {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border: none;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.chat-composer__remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-composer__retry {
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 9999px;
  background: white;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.chat-composer__sync {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
  padding-left: 0.25rem;
}

.chat-composer__row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.chat-composer__tools {
  display: flex;
  flex-direction: row;
  gap: 0.375rem;
  flex-shrink: 0;
  align-items: flex-end;
}

.chat-composer__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  border: 2px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
}

.chat-composer__tool:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: color-mix(in oklch, var(--color-primary) 30%, var(--color-border-subtle));
}

.chat-composer__tool:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-composer__input {
  flex: 1;
  min-height: 2.75rem;
  max-height: 8rem;
  padding: 0.625rem 0.875rem;
  border-radius: 12px;
  border: 2px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  font-size: var(--text-label);
  color: var(--color-ink);
  outline: none;
  resize: none;
  line-height: 1.4;
  transition: border-color 150ms;
}

.chat-composer__input:focus {
  border-color: var(--color-primary);
}

.chat-composer__input:disabled {
  opacity: 0.6;
}

.chat-composer__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 150ms;
}

.chat-composer__send:hover:not(:disabled) {
  opacity: 0.9;
}

.chat-composer__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
