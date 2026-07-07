import OpenAI from 'openai'

const DEFAULT_BASE_URL = 'https://ai-service1.yami.workers.dev/v1'
const DEFAULT_MODEL = 'unsloth/gemma-4-12b-it-qat'

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
  const config = useRuntimeConfig()
  const filter = createReasoningStreamFilter()

  const response = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.public.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens
    })
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

export function createOpenAIClient() {
  const config = useRuntimeConfig()
  const apiKey = config.public.aiApiKey

  return new OpenAI({
    apiKey: apiKey,
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

export { DEFAULT_MODEL, DEFAULT_BASE_URL }
