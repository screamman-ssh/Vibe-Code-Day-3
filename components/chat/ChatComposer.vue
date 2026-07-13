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
    <!-- Attachments Preview Area -->
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

    <!-- Unified Form Box (Gemini / ChatGPT Style) -->
    <form class="chat-composer__container" @submit.prevent="submit">
      
      <!-- Text Area (top) -->
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

      <!-- Controls Row (bottom) -->
      <div class="chat-composer__bottom">
        <!-- Tools on the left -->
        <div class="chat-composer__tools">
          <button
            type="button"
            class="chat-composer__tool"
            :disabled="disabled || !canAddMore()"
            title="เลือกรูปจากแกลเลอรี"
            aria-label="เลือกรูปจากแกลเลอรี"
            @click="openGallery"
          >
            <ImagePlus class="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            class="chat-composer__tool"
            :disabled="disabled || !canAddMore()"
            title="ถ่ายรูป"
            aria-label="ถ่ายรูป"
            @click="openCamera"
          >
            <Camera class="w-4.5 h-4.5" />
          </button>
        </div>

        <!-- Send Button on the right -->
        <button
          type="submit"
          class="chat-composer__send"
          :disabled="!canSend()"
          aria-label="ส่งข้อความ"
        >
          <Send class="w-4 h-4" />
        </button>
      </div>
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
  transition: all 150ms;
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
  border: 1px solid var(--color-border-subtle);
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

/* Unified Container Box */
.chat-composer__container {
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 200ms ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.dark .chat-composer__container {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(26, 44, 53, 0.6);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.1);
}

.chat-composer__container:focus-within {
  border-color: var(--color-primary);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 
    0 0 0 3px color-mix(in oklch, var(--color-primary) 12%, transparent),
    0 4px 16px rgba(0, 0, 0, 0.04);
}

.dark .chat-composer__container:focus-within {
  background: rgba(26, 44, 53, 0.85);
}

/* Inner Text Area */
.chat-composer__input {
  width: 100%;
  min-height: 2.75rem;
  max-height: 10rem;
  padding: 0.875rem 1rem 0.5rem;
  border: none;
  background: transparent;
  font-size: var(--text-base);
  color: var(--color-ink);
  outline: none;
  resize: none;
  line-height: 1.45;
}

.chat-composer__input:disabled {
  opacity: 0.6;
}

/* Bottom Actions Row inside the Container */
.chat-composer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem 0.5rem;
  border-top: 1px solid transparent;
}

.chat-composer__tools {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chat-composer__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.chat-composer__tool:hover:not(:disabled) {
  color: var(--color-primary);
  background: rgba(0, 0, 0, 0.04);
}

.dark .chat-composer__tool:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.chat-composer__tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Send Button inside Container */
.chat-composer__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-composer__send:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px color-mix(in oklch, var(--color-primary) 30%, transparent);
}

.chat-composer__send:active:not(:disabled) {
  transform: scale(0.95);
}

.chat-composer__send:disabled {
  opacity: 0.3;
  background: var(--color-border-subtle);
  color: var(--color-ink-muted);
  cursor: not-allowed;
  box-shadow: none;
}

.dark .chat-composer__send:disabled {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.25);
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
