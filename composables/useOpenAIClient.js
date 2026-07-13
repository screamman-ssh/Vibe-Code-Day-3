import OpenAI from 'openai'

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

/** Gemma on this endpoint often streams into reasoning_content, not content. */
export function extractDeltaText(delta) {
  if (!delta) return ''
  if (typeof delta.content === 'string' && delta.content) return delta.content
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
    return delta.reasoning_content
  }
  return ''
}

export function extractThaiFromReasoning(text) {
  if (!text) return ''
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].replace(/^\*\s*/, '')
    if (/[\u0E00-\u0E7F]/.test(line)) return line
  }
  return ''
}

export function createReasoningStreamFilter() {
  let buffer = ''
  let visible = ''
  let visibleStarted = false

  return {
    push(deltaText) {
      if (!deltaText) return { full: visible, delta: '' }

      buffer += deltaText
      if (!visibleStarted) {
        const thaiIndex = buffer.search(/[\u0E00-\u0E7F]/)
        if (thaiIndex === -1) return { full: visible, delta: '' }
        visibleStarted = true
        visible = buffer.slice(thaiIndex)
        return { full: visible, delta: visible }
      }

      visible += deltaText
      return { full: visible, delta: deltaText }
    },
    getFull() {
      if (visible.trim()) return visible.trim()
      return extractThaiFromReasoning(buffer) || buffer.trim()
    }
  }
}

export async function streamChatCompletion({
  messages,
  onStreamStart,
  onToken,
  temperature = 0.5,
  maxTokens = 350
}) {
  const { baseUrl, model, apiKey } = getLlmClientConfig()
  const filter = createReasoningStreamFilter()

  const body = {
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens
  }

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

      const { full, delta } = filter.push(piece)
      if (!delta) continue

      await yieldToUI()
      await onToken?.(delta, full)
    }
  }

  return filter.getFull()
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
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(errText || `LLM request failed (${response.status})`)
  }

  const json = await response.json()
  const msg = json?.choices?.[0]?.message || {}
  return msg.content || msg.reasoning_content || ''
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

export { FALLBACK_MODEL as DEFAULT_MODEL, FALLBACK_BASE_URL as DEFAULT_BASE_URL }
