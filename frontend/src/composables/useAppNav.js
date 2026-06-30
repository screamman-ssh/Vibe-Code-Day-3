import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Home, List, PieChart, Camera, Users, MessageCircle, Settings } from 'lucide-vue-next'

const SIDEBAR_TAB_NAMES = ['dashboard', 'transactions', 'budget', 'scan', 'circle', 'chat', 'settings']
const MOBILE_TAB_NAMES = ['dashboard', 'transactions', 'chat', 'circle', 'settings']

export function useAppNav() {
  const { t } = useI18n()

  const tabDefs = computed(() => ({
    dashboard: { name: 'dashboard', path: '/', label: t('nav.home'), icon: Home },
    transactions: { name: 'transactions', path: '/transactions', label: t('nav.transactions'), icon: List },
    budget: { name: 'budget', path: '/budget', label: t('budget.title'), icon: PieChart },
    scan: { name: 'scan', path: '/scan', label: t('nav.scan'), icon: Camera },
    circle: { name: 'circle', path: '/circle', label: t('nav.circle'), icon: Users },
    chat: { name: 'chat', path: '/chat', label: t('nav.chat'), icon: MessageCircle },
    settings: {
      name: 'settings',
      path: '/settings',
      label: t('settings.title'),
      mobileLabel: t('nav.more'),
      icon: Settings,
    },
  }))

  const sidebarTabs = computed(() =>
    SIDEBAR_TAB_NAMES.map((name) => tabDefs.value[name]),
  )

  const mobileTabs = computed(() =>
    MOBILE_TAB_NAMES.map((name) => {
      const tab = tabDefs.value[name]
      return {
        ...tab,
        label: tab.mobileLabel ?? tab.label,
      }
    }),
  )

  return { sidebarTabs, mobileTabs }
}

export function isNavActive(routePath, path) {
  if (path === '/') return routePath === '/'
  return routePath.startsWith(path)
}
