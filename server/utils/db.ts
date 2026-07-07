import { H3Event } from 'h3'

export function useDB(event: H3Event) {
  const env = event.context.cloudflare?.env
  if (env && env.DB) {
    return env.DB
  }

  throw new Error('D1 binding "DB" is missing. Run via `npm run pages:dev` / `wrangler pages dev` so Cloudflare env bindings are available.')
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
