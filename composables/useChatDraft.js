import { ref, watch, onUnmounted } from 'vue'
import { useApi } from '~/composables/useApi'

const STORAGE_PREFIX = 'moneycircle_chat_draft_v1'
const MAX_ATTACHMENTS = 8
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const SYNC_DEBOUNCE_MS = 500

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`
}

function revokePreviewUrl(attachment) {
  if (attachment?.localPreviewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.localPreviewUrl)
  }
}

function normalizeAttachment(item) {
  return {
    id: item.id,
    fileName: item.fileName || 'image',
    mimeType: item.mimeType || 'image/jpeg',
    fileSize: item.fileSize || 0,
    status: item.status || 'ready',
    localPreviewUrl: item.localPreviewUrl || null,
    error: item.error || null
  }
}

export function useChatDraft(userIdRef) {
  const api = useApi()

  const draftText = ref('')
  const attachments = ref([])
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const lastSyncedAt = ref(null)

  let syncTimer = null
  let syncVersion = 0
  const previewCache = new Map()

  function getAuthToken() {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  function saveLocalDraft(userId, text, items) {
    if (typeof window === 'undefined') return

    const payload = {
      text: text || '',
      attachments: items.map(item => ({
        id: item.id,
        fileName: item.fileName,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        status: item.status
      })),
      updatedAt: new Date().toISOString()
    }

    if (!payload.text.trim() && !payload.attachments.length) {
      localStorage.removeItem(storageKey(userId))
      return
    }

    localStorage.setItem(storageKey(userId), JSON.stringify(payload))
  }

  function loadLocalDraft(userId) {
    if (typeof window === 'undefined') return null

    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return {
        text: parsed?.text || '',
        attachments: Array.isArray(parsed?.attachments) ? parsed.attachments : [],
        updatedAt: parsed?.updatedAt || null
      }
    } catch {
      localStorage.removeItem(storageKey(userId))
      return null
    }
  }

  function clearLocalDraft(userId) {
    if (typeof window === 'undefined') return
    localStorage.removeItem(storageKey(userId))
  }

  async function fetchAuthenticatedPreview(url) {
    const token = getAuthToken()
    if (!token) return null

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  async function hydrateAttachmentPreview(item) {
    if (item.localPreviewUrl) return item

    if (previewCache.has(item.id)) {
      return { ...item, localPreviewUrl: previewCache.get(item.id) }
    }

    if (item.status !== 'ready' || !item.url) return item

    try {
      const objectUrl = await fetchAuthenticatedPreview(item.url)
      if (objectUrl) {
        previewCache.set(item.id, objectUrl)
        return { ...item, localPreviewUrl: objectUrl }
      }
    } catch (err) {
      console.error('Failed to load attachment preview:', err)
    }

    return item
  }

  async function loadDraft(userId) {
    isLoading.value = true
    syncVersion += 1

    try {
      attachments.value.forEach(revokePreviewUrl)
      attachments.value = []
      draftText.value = ''

      if (!userId || userId === 'guest') {
        const local = loadLocalDraft(userId)
        if (local) {
          draftText.value = local.text
          attachments.value = await Promise.all(
            local.attachments.map(item => hydrateAttachmentPreview(normalizeAttachment(item)))
          )
          lastSyncedAt.value = local.updatedAt
        }
        return
      }

      const data = await api.get('/api/v1/chat/draft')
      draftText.value = data?.text || ''

      const remoteAttachments = Array.isArray(data?.attachments) ? data.attachments : []
      attachments.value = await Promise.all(
        remoteAttachments.map(item => hydrateAttachmentPreview(normalizeAttachment({
          ...item,
          url: item.url || `/api/v1/chat/attachments/${item.id}/file`
        })))
      )
      lastSyncedAt.value = data?.updatedAt || null
      clearLocalDraft(userId)
    } catch (err) {
      console.error('Failed to load chat draft:', err)
      const local = loadLocalDraft(userId)
      if (local) {
        draftText.value = local.text
        attachments.value = local.attachments.map(item => normalizeAttachment(item))
      }
    } finally {
      isLoading.value = false
    }
  }

  async function syncDraftNow(userId) {
    const text = draftText.value
    const readyIds = attachments.value
      .filter(item => item.status === 'ready')
      .map(item => item.id)

    if (!userId || userId === 'guest') {
      saveLocalDraft(userId, text, attachments.value)
      lastSyncedAt.value = new Date().toISOString()
      return
    }

    isSyncing.value = true
    const version = ++syncVersion

    try {
      const data = await api.put('/api/v1/chat/draft', {
        text,
        attachmentIds: readyIds
      })

      if (version !== syncVersion) return

      lastSyncedAt.value = data?.updatedAt || new Date().toISOString()
      clearLocalDraft(userId)
    } catch (err) {
      console.error('Failed to sync chat draft:', err)
      saveLocalDraft(userId, text, attachments.value)
    } finally {
      if (version === syncVersion) {
        isSyncing.value = false
      }
    }
  }

  function scheduleDraftSync(userId) {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncDraftNow(userId)
    }, SYNC_DEBOUNCE_MS)
  }

  function validateFile(file) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return 'รองรับเฉพาะ JPG, PNG, WebP, GIF'
    }
    if (file.size > MAX_BYTES) {
      return 'รูปต้องไม่เกิน 5 MB'
    }
    if (attachments.value.length >= MAX_ATTACHMENTS) {
      return 'แนบได้สูงสุด 8 รูป'
    }
    return null
  }

  async function uploadFile(file) {
    const validationError = validateFile(file)
    if (validationError) {
      throw new Error(validationError)
    }

    const localPreviewUrl = URL.createObjectURL(file)
    const userId = userIdRef.value

    if (!userId || userId === 'guest') {
      const localAttachment = normalizeAttachment({
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: 'ready',
        localPreviewUrl
      })
      attachments.value = [...attachments.value, localAttachment]
      saveLocalDraft(userId, draftText.value, attachments.value)
      return localAttachment
    }

    const placeholder = normalizeAttachment({
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      status: 'uploading',
      localPreviewUrl
    })

    attachments.value = [...attachments.value, placeholder]

    try {
      const sign = await api.post('/api/v1/chat/attachments/sign', {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size
      })

      const token = getAuthToken()
      const uploadResponse = await fetch(sign.uploadUrl, {
        method: sign.method || 'PUT',
        headers: {
          ...(sign.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: file
      })

      if (!uploadResponse.ok) {
        throw new Error('อัปโหลดรูปไม่สำเร็จ')
      }

      const readyAttachment = normalizeAttachment({
        id: sign.attachmentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: 'ready',
        localPreviewUrl,
        url: sign.previewUrl
      })

      previewCache.set(sign.attachmentId, localPreviewUrl)

      attachments.value = attachments.value.map(item =>
        item.id === placeholder.id ? readyAttachment : item
      )

      scheduleDraftSync(userId)
      return readyAttachment
    } catch (err) {
      attachments.value = attachments.value.map(item =>
        item.id === placeholder.id
          ? { ...item, status: 'failed', error: err.message || 'อัปโหลดไม่สำเร็จ' }
          : item
      )
      throw err
    }
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || [])
    const errors = []

    for (const file of files) {
      if (attachments.value.length >= MAX_ATTACHMENTS) {
        errors.push('แนบได้สูงสุด 8 รูป')
        break
      }

      try {
        await uploadFile(file)
      } catch (err) {
        errors.push(err.message)
      }
    }

    return errors
  }

  async function removeAttachment(attachmentId) {
    const userId = userIdRef.value
    const target = attachments.value.find(item => item.id === attachmentId)
    if (!target) return

    revokePreviewUrl(target)
    previewCache.delete(attachmentId)
    attachments.value = attachments.value.filter(item => item.id !== attachmentId)

    if (userId && userId !== 'guest' && !attachmentId.startsWith('local_')) {
      try {
        await api.delete(`/api/v1/chat/attachments/${attachmentId}`)
      } catch (err) {
        console.error('Failed to delete attachment:', err)
      }
    }

    scheduleDraftSync(userId)
  }

  async function retryUpload(attachmentId) {
    const target = attachments.value.find(item => item.id === attachmentId)
    if (!target?.localPreviewUrl || target.status !== 'failed') return

    attachments.value = attachments.value.filter(item => item.id !== attachmentId)
    const response = await fetch(target.localPreviewUrl)
    const blob = await response.blob()
    const file = new File([blob], target.fileName, { type: target.mimeType })
    await uploadFile(file)
  }

  async function clearDraft(userId) {
    if (syncTimer) {
      clearTimeout(syncTimer)
      syncTimer = null
    }

    attachments.value.forEach(revokePreviewUrl)
    attachments.value = []
    draftText.value = ''
    previewCache.clear()
    clearLocalDraft(userId)

    if (!userId || userId === 'guest') return

    try {
      await api.delete('/api/v1/chat/draft')
    } catch (err) {
      console.error('Failed to clear chat draft:', err)
    }
  }

  function watchDraft(userId) {
    watch(draftText, () => {
      scheduleDraftSync(userId.value)
    })

    watch(attachments, () => {
      scheduleDraftSync(userId.value)
    }, { deep: true })
  }

  onUnmounted(() => {
    if (syncTimer) clearTimeout(syncTimer)
    attachments.value.forEach(revokePreviewUrl)
    previewCache.forEach(url => URL.revokeObjectURL(url))
    previewCache.clear()
  })

  return {
    draftText,
    attachments,
    isLoading,
    isSyncing,
    lastSyncedAt,
    maxAttachments: MAX_ATTACHMENTS,
    loadDraft,
    addFiles,
    removeAttachment,
    retryUpload,
    clearDraft,
    scheduleDraftSync,
    syncDraftNow,
    watchDraft
  }
}
