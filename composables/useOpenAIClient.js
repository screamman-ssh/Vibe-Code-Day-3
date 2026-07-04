import OpenAI from 'openai'

const DEFAULT_BASE_URL = 'https://ai-service1.yami.workers.dev/v1'
const DEFAULT_MODEL = 'unsloth/gemma-4-12b-it-qat'

export function getActiveApiKey() {
  if (typeof window === 'undefined') return ''
  const key = localStorage.getItem('openai_api_key') || ''
  return key.trim()
}

export function createOpenAIClient(apiKey) {
  const userKey = apiKey || getActiveApiKey()

  if (userKey) {
    // If a custom key is provided in settings, call the external API directly
    return new OpenAI({
      apiKey: userKey,
      baseURL: DEFAULT_BASE_URL,
      dangerouslyAllowBrowser: true,
      fetch: async (url, init) => {
        const headers = { ...init.headers }
        Object.keys(headers).forEach(k => {
          if (k.toLowerCase().startsWith('x-stainless') || k.toLowerCase() === 'user-agent') {
            delete headers[k]
          }
        })
        init.headers = headers
        return fetch(url, init)
      }
    })
  }

  // Otherwise, route through the local Nuxt server proxy
  return new OpenAI({
    apiKey: 'use-server-key', // dummy key required by the SDK client
    baseURL: '/api/v1/ai',
    dangerouslyAllowBrowser: true
  })
}

export { DEFAULT_MODEL }
