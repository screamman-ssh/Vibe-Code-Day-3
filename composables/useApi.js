import { useAuthStore } from '~/stores/auth'

export function useApi() {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()

  const request = async (url, options = {}) => {
    const headers = { ...options.headers }
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const aiKey = config?.public?.aiApiKey || null

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (aiKey && !headers['x-llm-key'] && !headers['x-ai-key']) {
      headers['x-llm-key'] = aiKey
    }

    try {
      return await $fetch(url, {
        ...options,
        headers,
      })
    } catch (error) {
      if (error.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/google') && !url.includes('/auth/guest')) {
        try {
          await authStore.refresh()
          const newToken = localStorage.getItem('accessToken')
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`
            return await $fetch(url, { ...options, headers })
          }
        } catch (refreshErr) {
          authStore.logout()
          throw refreshErr
        }
      }
      throw error
    }
  }

  return {
    request,
    get: (url, options) => request(url, { ...options, method: 'GET' }),
    post: (url, body, options) => request(url, { ...options, method: 'POST', body }),
    put: (url, body, options) => request(url, { ...options, method: 'PUT', body }),
    delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
  }
}
