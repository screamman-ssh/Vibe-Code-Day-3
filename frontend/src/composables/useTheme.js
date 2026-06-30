import { ref, watch } from 'vue'

const STORAGE_KEY = 'moneycircle-theme'
const isDark = ref(false)

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#0f766e')
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark') {
    isDark.value = true
  } else if (saved === 'light') {
    isDark.value = false
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDark.value)
}

export function useTheme() {
  watch(isDark, (dark) => {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
    applyTheme(dark)
  })

  function toggleDark() {
    isDark.value = !isDark.value
  }

  return { isDark, toggleDark, initTheme }
}

export { initTheme }
