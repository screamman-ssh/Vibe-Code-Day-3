<script setup>
const { $pwa } = useNuxtApp()

const showInstall = computed(() => Boolean($pwa?.showInstallPrompt))
const showOfflineReady = computed(() => Boolean($pwa?.offlineReady))
const showUpdate = computed(() => Boolean($pwa?.needRefresh))

const visible = computed(() => showInstall.value || showOfflineReady.value || showUpdate.value)

const message = computed(() => {
  if (showUpdate.value) return 'มีเวอร์ชันใหม่ — กดรีโหลดเพื่ออัปเดต'
  if (showInstall.value) return 'ติดตั้ง MoneyCircle บนหน้าจอหลักเพื่อใช้งานได้เร็วขึ้น'
  return 'พร้อมใช้งานแบบออฟไลน์แล้ว'
})

async function onInstall() {
  await $pwa?.install()
}

async function onReload() {
  await $pwa?.updateServiceWorker(true)
}

function onDismiss() {
  if (!$pwa) return
  if (showInstall.value) {
    $pwa.cancelPrompt()
    return
  }
  if (showUpdate.value) {
    $pwa.cancelPrompt()
    return
  }
  if (showOfflineReady.value) {
    $pwa.offlineReady = false
  }
}
</script>

<template>
  <Transition name="pwa-toast">
    <div
      v-if="visible"
      class="pwa-toast"
      role="alertdialog"
      aria-live="polite"
      aria-labelledby="pwa-toast-message"
    >
      <p id="pwa-toast-message" class="pwa-toast__message">{{ message }}</p>
      <div class="pwa-toast__actions">
        <button
          v-if="showInstall"
          type="button"
          class="pwa-toast__btn pwa-toast__btn--primary"
          @click="onInstall"
        >
          ติดตั้ง
        </button>
        <button
          v-if="showUpdate"
          type="button"
          class="pwa-toast__btn pwa-toast__btn--primary"
          @click="onReload"
        >
          รีโหลด
        </button>
        <button
          type="button"
          class="pwa-toast__btn"
          @click="onDismiss"
        >
          ปิด
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-toast {
  position: fixed;
  right: 1rem;
  bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  left: 1rem;
  z-index: 100;
  max-width: 24rem;
  margin-left: auto;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 1rem;
  background: var(--color-surface-card);
  color: var(--color-ink);
  box-shadow: 0 10px 30px rgb(0 0 0 / 12%);
}

.pwa-toast__message {
  margin: 0 0 0.75rem;
  font-size: var(--text-sm);
  line-height: 1.45;
}

.pwa-toast__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pwa-toast__btn {
  border: 1px solid var(--color-border-subtle);
  border-radius: 9999px;
  padding: 0.375rem 0.875rem;
  font-size: var(--text-label);
  font-weight: 700;
  background: transparent;
  color: var(--color-ink);
}

.pwa-toast__btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.pwa-toast-enter-active,
.pwa-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pwa-toast-enter-from,
.pwa-toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (min-width: 768px) {
  .pwa-toast {
    bottom: 1.5rem;
  }
}
</style>
