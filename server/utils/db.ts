import { H3Event } from 'h3'

export function useDB(event: H3Event) {
  const env = event.context.cloudflare?.env
  if (env && env.DB) {
    return env.DB
  }
  
  // Local fallback mock D1 executor interface to prevent crashes when running under standard dev preset
  // In Cloudflare deployment or pages dev, env.DB will always exist.
  return {
    prepare(query: string) {
      return {
        bind(...args: any[]) {
          return {
            async first() { return null },
            async all() { return { results: [] } },
            async run() { return { success: true } }
          }
        },
        async first() { return null },
        async all() { return { results: [] } },
        async run() { return { success: true } }
      }
    },
    async batch(statements: any[]) {
      return []
    },
    async exec(query: string) {
      return { count: 0, duration: 0 }
    }
  }
}

export function getJwtSecret(event: H3Event): string {
  const env = event.context.cloudflare?.env
  return env?.JWT_SECRET || 'change-me-in-production-use-wrangler-secret'
}

export function getLlmConfig(event: H3Event) {
  const env = event.context.cloudflare?.env
  return {
    baseUrl: env?.LLM_BASE_URL || 'https://ai-service1.yami.workers.dev/v1',
    model: env?.LLM_MODEL || 'unsloth/gemma-4-12b-it-qat',
    apiKey: env?.LLM_API_KEY || ''
  }
}
