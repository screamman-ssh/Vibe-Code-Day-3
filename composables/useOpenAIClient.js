import OpenAI from 'openai'
import { withLlmNoThinking } from '~/utils/llmRequestOptions'

const FALLBACK_BASE_URL = 'https://ai-service1.yami.workers.dev/lizu/v1'
const FALLBACK_MODEL = 'unsloth/gemma-4-12b-it-qat'

function getLlmClientConfig() {
  const config = useRuntimeConfig()
  return {
    baseUrl: config.public.llmBaseUrl || FALLBACK_BASE_URL,
    model: config.public.llmModel || FALLBACK_MODEL,
    apiKey: config.public.aiApiKey
  }
}

function yieldToUI() {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

/** Use final answer tokens only — ignore reasoning/thinking channel. */
export function extractDeltaText(delta) {
  if (!delta) return ''
  if (typeof delta.content === 'string' && delta.content) return delta.content
  return ''
}

export async function streamChatCompletion({
  messages,
  onStreamStart,
  onToken,
  temperature = 0.5,
  maxTokens = 350
}) {
  const { baseUrl, model, apiKey } = getLlmClientConfig()

  const body = withLlmNoThinking({
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens
  })

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(errText || `LLM request failed (${response.status})`)
  }

  if (!response.body) throw new Error('LLM stream unavailable')

  onStreamStart?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    sseBuffer += decoder.decode(value, { stream: true })
    const lines = sseBuffer.split('\n')
    sseBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue

      let payload
      try {
        payload = JSON.parse(data)
      } catch {
        continue
      }

      if (payload.error) {
        throw new Error(payload.error.message || 'LLM stream error')
      }

      const piece = extractDeltaText(payload.choices?.[0]?.delta)
      if (!piece) continue

      full += piece
      await yieldToUI()
      await onToken?.(piece, full)
    }
  }

  return full.trim()
}

export async function chatCompletionOnce({
  messages,
  temperature = 0,
  maxTokens = 500
}) {
  const { baseUrl, model, apiKey } = getLlmClientConfig()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(errText || `LLM request failed (${response.status})`)
  }

  const json = await response.json()
  const msg = json?.choices?.[0]?.message || {}
  return typeof msg.content === 'string' ? msg.content : ''
}

export function createOpenAIClient() {
  const { baseUrl, apiKey } = getLlmClientConfig()

  return new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
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

export { FALLBACK_MODEL as DEFAULT_MODEL, FALLBACK_BASE_URL as DEFAULT_BASE_URL, withLlmNoThinking }
