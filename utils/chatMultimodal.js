const MAX_IMAGES_PER_MESSAGE = 4

function getAuthToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
}

export async function previewUrlToDataUrl(previewUrl, mimeType = 'image/jpeg') {
  if (!previewUrl || typeof previewUrl !== 'string') return null
  if (previewUrl.startsWith('data:')) return previewUrl

  const token = getAuthToken()
  const headers = {}
  if (token && previewUrl.includes('/api/')) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(previewUrl, { headers })
  if (!response.ok) {
    throw new Error(`Failed to load image (${response.status})`)
  }

  const blob = await response.blob()
  const dataUrl = await blobToDataUrl(blob)

  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    return dataUrl
  }

  return `data:${mimeType};base64,${dataUrl}`
}

export async function buildMultimodalUserContent(text, attachments = []) {
  const parts = []
  const items = Array.isArray(attachments) ? attachments.slice(0, MAX_IMAGES_PER_MESSAGE) : []

  for (const item of items) {
    try {
      const dataUrl = await previewUrlToDataUrl(item.previewUrl, item.mimeType || 'image/jpeg')
      if (!dataUrl) continue
      parts.push({
        type: 'image_url',
        image_url: { url: dataUrl }
      })
    } catch (err) {
      console.error('Failed to encode attachment for LLM:', err)
    }
  }

  const trimmedText = typeof text === 'string' ? text.trim() : ''
  const displayText = trimmedText && trimmedText !== '(แนบรูป)'
    ? trimmedText
    : 'ช่วยวิเคราะห์รูปที่แนบมาให้หน่อย'

  parts.push({
    type: 'text',
    text: displayText
  })

  return parts
}

export function messageHasImages(attachments = []) {
  return Array.isArray(attachments) && attachments.length > 0
}
