import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { generateChatSuggestions } from '../../../utils/chatSuggestions'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const apiKeyOverride = getHeader(event, 'x-llm-key') || getHeader(event, 'x-ai-key') || null

  const suggestions = await generateChatSuggestions(event, {
    messages: body?.messages,
    contextSummary: body?.contextSummary,
    apiKeyOverride: typeof apiKeyOverride === 'string' && apiKeyOverride.trim()
      ? apiKeyOverride.trim()
      : null
  })

  return { suggestions }
})
