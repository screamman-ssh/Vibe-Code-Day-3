import { realApi } from './realApi.js'
import { mockApi } from './mock/client.js'

function shouldUseRealApi() {
  if (typeof window === 'undefined') return false
  if (localStorage.getItem('useRealApi') === 'true') return true
  if (localStorage.getItem('useRealApi') === 'false') return false
  const host = window.location.hostname
  // Production (Cloudflare Pages) uses D1-backed Pages Functions at /api/v1
  return host !== 'localhost' && host !== '127.0.0.1'
}

export const api = shouldUseRealApi() ? realApi : mockApi

