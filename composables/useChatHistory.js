import { useApi } from '~/composables/useApi'

const STORAGE_PREFIX = 'moneycircle_chat_v1'
const MAX_STORED_MESSAGES = 80
const MAX_CONTEXT_MESSAGES = 24

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`
}

function isPersistableMessage(message) {
  if (!message?.content?.trim()) return false
  if (message.role !== 'user' && message.role !== 'assistant') return false
  if (message.role === 'assistant' && message.status && message.status !== 'done') return false
  return true
}

export function serializeChatMessages(messages = []) {
  return messages
    .filter(isPersistableMessage)
    .slice(-MAX_STORED_MESSAGES)
    .map(message => ({
      role: message.role,
      content: message.content.trim(),
      toolTrace: Array.isArray(message.toolTrace) ? message.toolTrace : []
    }))
}

export function hydrateChatMessages(messages = []) {
  return messages
    .filter(message => message?.content?.trim() && (message.role === 'user' || message.role === 'assistant'))
    .map(message => ({
      role: message.role,
      content: message.content.trim(),
      toolTrace: Array.isArray(message.toolTrace) ? message.toolTrace : [],
      status: 'done'
    }))
}

export function trimChatContext(messages = [], limit = MAX_CONTEXT_MESSAGES) {
  return messages
    .filter(message => message?.content?.trim() && (message.role === 'user' || message.role === 'assistant'))
    .slice(-limit)
}

function loadLocalHistory(userId) {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const messages = hydrateChatMessages(parsed?.messages)
    return messages.length ? messages : null
  } catch {
    localStorage.removeItem(storageKey(userId))
    return null
  }
}

function saveLocalHistory(userId, messages) {
  if (typeof window === 'undefined') return

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    messages: serializeChatMessages(messages)
  }

  if (!payload.messages.length) {
    localStorage.removeItem(storageKey(userId))
    return
  }

  localStorage.setItem(storageKey(userId), JSON.stringify(payload))
}

function clearLocalHistory(userId) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(storageKey(userId))
}

export function useChatHistory() {
  const api = useApi()

  async function loadHistory(userId) {
    if (!userId || userId === 'guest') {
      return loadLocalHistory(userId)
    }

    try {
      const data = await api.get('/api/v1/chat/messages')
      const remoteMessages = hydrateChatMessages(data?.messages)
      if (remoteMessages.length) {
        clearLocalHistory(userId)
        return remoteMessages
      }

      const localMessages = loadLocalHistory(userId)
      if (localMessages?.length) {
        await saveHistory(userId, localMessages)
        return localMessages
      }

      return null
    } catch (err) {
      console.error('Failed to load chat history from server:', err)
      return loadLocalHistory(userId)
    }
  }

  async function saveHistory(userId, messages) {
    const serialized = serializeChatMessages(messages)

    if (!userId || userId === 'guest') {
      saveLocalHistory(userId, messages)
      return
    }

    try {
      if (!serialized.length) {
        await api.delete('/api/v1/chat/messages')
        clearLocalHistory(userId)
        return
      }

      await api.put('/api/v1/chat/messages', { messages: serialized })
      clearLocalHistory(userId)
    } catch (err) {
      console.error('Failed to save chat history to server:', err)
      saveLocalHistory(userId, messages)
    }
  }

  async function clearHistory(userId) {
    clearLocalHistory(userId)

    if (!userId || userId === 'guest') return

    try {
      await api.delete('/api/v1/chat/messages')
    } catch (err) {
      console.error('Failed to clear chat history on server:', err)
    }
  }

  return {
    loadHistory,
    saveHistory,
    clearHistory,
    trimChatContext
  }
}

export { MAX_CONTEXT_MESSAGES, MAX_STORED_MESSAGES }
