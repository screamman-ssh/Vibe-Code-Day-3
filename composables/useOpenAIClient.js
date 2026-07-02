import OpenAI from 'openai'

const DEFAULT_BASE_URL = 'https://ai-service1.yami.workers.dev/v1'
const DEFAULT_MODEL = 'unsloth/gemma-4-12b-it-qat'

export function getActiveApiKey() {
  if (typeof window === 'undefined') return 'TestOnly1111@'
  const key = localStorage.getItem('openai_api_key') || ''
  return key.trim() || 'TestOnly1111@'
}

export function createOpenAIClient(apiKey) {
  return new OpenAI({
    apiKey: apiKey || getActiveApiKey(),
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

export { DEFAULT_MODEL }
