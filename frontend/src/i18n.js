import { createI18n } from 'vue-i18n'
import th from './locales/th.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'th',
  fallbackLocale: 'th',
  messages: { th },
})
