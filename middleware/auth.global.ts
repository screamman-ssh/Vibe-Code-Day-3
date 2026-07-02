import { defineNuxtRouteMiddleware, navigateTo, useAuthStore } from '#imports'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  
  // Public pages that don't need authentication
  const publicPages = ['/login']
  
  if (!auth.isLoggedIn && !publicPages.includes(to.path)) {
    return navigateTo('/login')
  }
  
  // If logged in and on login page, redirect to dashboard
  if (auth.isLoggedIn && to.path === '/login') {
    return navigateTo('/')
  }
})
