import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(api.getMe())

  const isLoggedIn = computed(() => !!user.value)
  const needsOnboarding = computed(() => user.value && !user.value.onboardingComplete)

  async function loginAsPersona(persona) {
    user.value = await api.loginAsPersona(persona)
    return user.value
  }

  async function loginAsGuest(name) {
    user.value = await api.loginAsGuest(name)
    return user.value
  }

  async function completeOnboarding(payload) {
    user.value = await api.completeOnboarding(payload)
    return user.value
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  async function refresh() {
    user.value = api.getMe()
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
