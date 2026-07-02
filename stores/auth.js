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

  function loginAsPersona(persona) {
    const personas = {
      nune: {
        id: 'google-user-nune',
        googleId: 'google-user-nune',
        displayName: 'Nune',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nune',
        subscriptionTier: 'free',
        emergencyFundAmount: 5000,
        onboardingComplete: true
      },
      boss: {
        id: 'google-user-boss',
        googleId: 'google-user-boss',
        displayName: 'Boss',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boss',
        subscriptionTier: 'premium',
        emergencyFundAmount: 15000,
        onboardingComplete: true
      }
    }
    
    user.value = personas[persona] || {
      id: `google-user-${persona}`,
      googleId: `google-user-${persona}`,
      displayName: persona,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${persona}`,
      subscriptionTier: 'free',
      emergencyFundAmount: 0,
      onboardingComplete: false
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user.value))
      localStorage.setItem('accessToken', `mock_token_${persona}`)
    }
    
    return user.value
  }

  function loginAsGuest(name) {
    user.value = {
      id: `guest-${Date.now()}`,
      googleId: `guest-${Date.now()}`,
      displayName: name || 'ผู้ใช้ทั่วไป',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      subscriptionTier: 'free',
      emergencyFundAmount: 0,
      onboardingComplete: false
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user.value))
      localStorage.setItem('accessToken', `mock_token_guest_${Date.now()}`)
    }
    
    return user.value
  }

  function completeOnboarding(payload) {
    if (user.value) {
      user.value.onboardingComplete = true
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    }
    return user.value
  }

  function logout() {
    user.value = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  }

  function refresh() {
    // No-op for mocks
  }

  return {
    user,
    isLoggedIn,
    needsOnboarding,
    loginAsPersona,
    loginAsGuest,
    completeOnboarding,
    logout,
    refresh,
  }
})
