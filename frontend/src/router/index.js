import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/onboarding', name: 'onboarding', component: () => import('../views/OnboardingView.vue') },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/transactions', name: 'transactions', component: () => import('../views/TransactionsView.vue') },
  { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
  { path: '/scan', name: 'scan', component: () => import('../views/ScanView.vue') },
  { path: '/circle', name: 'circle', component: () => import('../views/CircleView.vue') },
  { path: '/chat', name: 'chat', component: () => import('../views/ChatView.vue') },
  { path: '/coach', redirect: '/chat' },
  { path: '/analyze', redirect: { path: '/chat', query: { mode: 'report' } } },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (auth.isLoggedIn && to.name === 'login') {
    return auth.needsOnboarding ? '/onboarding' : '/'
  }
  if (auth.needsOnboarding && to.name !== 'onboarding' && !to.meta.public) {
    return '/onboarding'
  }
})

export default router
