import OpenAI from 'openai'

export default defineEventHandler(async (event) => {
  // 1. Resolve environment settings from Cloudflare Pages or server process
  const env = (event.context.cloudflare?.env || process.env || {}) as Record<string, string | undefined>
  const config = useRuntimeConfig(event)

  // 2. Determine API Key, base URL, and default model
  const apiKey = config.aiApiKey || env.AI_API_KEY || env.OPENAI_API_KEY || env.NUXT_AI_API_KEY || 'TestOnly1111@'
  const baseURL = env.LLM_BASE_URL || 'https://ai-service1.yami.workers.dev/v1'
  const defaultModel = env.LLM_MODEL || 'unsloth/gemma-4-12b-it-qat'

  // 3. Parse request payload
  const body = await readBody(event)

  // 4. Initialize server-side OpenAI client
  const openai = new OpenAI({
    apiKey,
    baseURL,
  })

  try {
    // 5. Send completion request upstream
    const response = await openai.chat.completions.create({
      model: body.model || defaultModel,
      messages: body.messages,
      temperature: body.temperature ?? 0.5,
      max_tokens: body.max_tokens ?? 350,
      stream: body.stream ?? false,
    })

    // 6. Handle streaming (Server-Sent Events)
    if (body.stream) {
      setHeader(event, 'Content-Type', 'text/event-stream')
      setHeader(event, 'Cache-Control', 'no-cache')
      setHeader(event, 'Connection', 'keep-alive')

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of (response as any)) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`))
            }
            // Send the DONE signal to complete the SSE protocol cleanly
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          } catch (error) {
            console.error('Error during streaming in backend proxy:', error)
          } finally {
            controller.close()
          }
        }
      })

      return sendStream(event, readableStream)
    }

    // 7. Non-streaming JSON response
    return response

  } catch (error: any) {
    console.error('AI Proxy Error:', error)
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to communicate with AI endpoint',
    })
  }
})
