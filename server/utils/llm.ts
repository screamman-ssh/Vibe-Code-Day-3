import type { H3Event } from 'h3'
import { getLlmConfig } from './db'

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'system' | 'user' | 'assistant'; content: any }

function withLlmNoThinking(body: Record<string, unknown>) {
  return {
    ...body,
    reasoning_effort: 'none',
    chat_template_kwargs: {
      enable_thinking: false,
      ...(body.chat_template_kwargs as Record<string, unknown> | undefined)
    }
  }
}

export async function chatCompletionOnceServer(
  event: H3Event,
  {
    messages,
    temperature = 0,
    maxTokens = 800,
    apiKeyOverride
  }: {
    messages: ChatMessage[]
    temperature?: number
    maxTokens?: number
    apiKeyOverride?: string | null
  }
) {
  const { baseUrl, model, apiKey } = getLlmConfig(event)
  const finalKey = apiKeyOverride || apiKey
  if (!finalKey) throw new Error('LLM_API_KEY is not configured in Cloudflare env')

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer TestOnly1111@`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(withLlmNoThinking({
      model,
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens
    }))
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || `LLM request failed (${res.status})`)
  }

  const json: any = await res.json()
  const msg = json?.choices?.[0]?.message || {}
  return (typeof msg.content === 'string' ? msg.content : '') as string
}
