<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmDialog } from '~/composables/useConfirmDialog'

const { state, handleConfirm, handleCancel } = useConfirmDialog()
const { t } = useI18n()

const confirmLabel = computed(() => state.confirmText || (state.mode === 'alert' ? t('dialog.ok') : t('dialog.confirm')))
const cancelLabel = computed(() => state.cancelText || t('dialog.cancel'))

const confirmBtnClass = computed(() =>
  state.variant === 'danger'
    ? 'bg-tier-risk text-white hover:opacity-90'
    : ''
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      @click.self="handleCancel"
    >
      <div
        class="w-full max-w-sm bg-surface-card rounded-xl p-6 border-2 border-border-subtle space-y-4 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div class="space-y-2">
          <h3 v-if="state.title" class="text-base font-bold text-ink">{{ state.title }}</h3>
          <p class="text-sm text-ink-muted leading-relaxed">{{ state.message }}</p>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            v-if="state.mode === 'confirm'"
            type="button"
            class="btn-secondary flex-1 justify-center text-sm cursor-pointer"
            @click="handleCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn-primary flex-1 justify-center text-sm cursor-pointer"
            :class="confirmBtnClass"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
