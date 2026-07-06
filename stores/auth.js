import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)

  // Initialize from localStorage if present
  if (typeof window !== 'undefined') {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser)
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
  }

  const isLoggedIn = computed(() => !!user.value)
  const needsOnboarding = computed(() => user.value && !user.value.onboardingComplete)

  async function loginAsPersona(persona) {
    try {
      const res = await $fetch('/api/v1/auth/google', {
        method: 'POST',
        body: { id_token: `mock_token_${persona}` }
      })
      
      user.value = res.user
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(res.user))
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('refreshToken', res.refreshToken)
      }
      return user.value
    } catch (err) {
      console.error('Persona login failed:', err)
      throw err
    }
  }

  async function loginWithGoogle(idToken) {
    try {
      const res = await $fetch('/api/v1/auth/google', {
        method: 'POST',
        body: { id_token: idToken }
      })
      
      user.value = res.user
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(res.user))
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('refreshToken', res.refreshToken)
      }
      return user.value
    } catch (err) {
      console.error('Google SSO login failed:', err)
      throw err
    }
  }

  async function loginAsGuest(name) {
    try {
      const res = await $fetch('/api/v1/auth/guest', {
        method: 'POST',
        body: { displayName: name }
      })
      
      user.value = res.user
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(res.user))
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('refreshToken', res.refreshToken)
      }
      return user.value
    } catch (err) {
      console.error('Guest login failed:', err)
      throw err
    }
  }

  async function completeOnboarding(payload) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
      const res = await $fetch('/api/v1/auth/onboarding', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: payload
      })
      
      user.value = res
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(res))
      }
      return user.value
    } catch (err) {
      console.error('Onboarding completion failed:', err)
      throw err
    }
  }

  async function logout() {
    try {
      const rToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
      if (rToken) {
        await $fetch('/api/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken: rToken }
        })
      }
    } catch (err) {
      console.warn('Logout endpoint call failed:', err)
    } finally {
      user.value = null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
  }

  async function refresh() {
    try {
      const rToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
      if (!rToken) throw new Error('No refresh token')
      
      const res = await $fetch('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken: rToken }
      })
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('refreshToken', res.refreshToken)
      }
    } catch (err) {
      console.error('Token refresh failed:', err)
      logout()
      throw err
    }
  }

  return {
    user,
    isLoggedIn,
    needsOnboarding,
    loginAsPersona,
    loginWithGoogle,
    loginAsGuest,
    completeOnboarding,
    logout,
    refresh,
  }
})
