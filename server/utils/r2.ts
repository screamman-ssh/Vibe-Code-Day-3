import type { H3Event } from 'h3'

export function useR2(event: H3Event) {
  const env = event.context.cloudflare?.env as { CHAT_IMAGES?: R2Bucket } | undefined
  return env?.CHAT_IMAGES ?? null
}
