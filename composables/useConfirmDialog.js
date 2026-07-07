import { reactive } from 'vue'

const state = reactive({
  open: false,
  mode: 'confirm',
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  variant: 'default'
})

let resolveFn = null

function close(result) {
  state.open = false
  if (resolveFn) {
    resolveFn(result)
    resolveFn = null
  }
}

function openDialog(options) {
  return new Promise((resolve) => {
    resolveFn = resolve
    state.mode = options.mode || 'confirm'
    state.title = options.title || ''
    state.message = options.message || ''
    state.confirmText = options.confirmText || ''
    state.cancelText = options.cancelText || ''
    state.variant = options.variant || 'default'
    state.open = true
  })
}

export function confirmDialog(message, options = {}) {
  return openDialog({ ...options, mode: 'confirm', message })
}

export function alertDialog(message, options = {}) {
  return openDialog({ ...options, mode: 'alert', message }).then(() => {})
}

export function useConfirmDialog() {
  function handleConfirm() {
    close(state.mode === 'alert' ? undefined : true)
  }

  function handleCancel() {
    close(state.mode === 'alert' ? undefined : false)
  }

  return {
    state,
    handleConfirm,
    handleCancel
  }
}
