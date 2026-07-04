import { ref, onMounted } from 'vue'

const theme = ref('light') // 'light' | 'dark' | 'system'

export function useTheme() {
  const applyTheme = () => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    
    let isDark = false
    if (theme.value === 'dark') {
      isDark = true
    } else if (theme.value === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const setTheme = (newTheme) => {
    theme.value = newTheme
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
    }
    applyTheme()
  }

  const initTheme = () => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'light'
      theme.value = savedTheme
      applyTheme()
    }
  }

  return {
    theme,
    setTheme,
    initTheme,
    applyTheme
  }
}
export default useTheme
