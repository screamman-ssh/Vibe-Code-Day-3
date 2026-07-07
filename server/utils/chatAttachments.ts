export const MAX_CHAT_ATTACHMENTS = 8
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export function extensionForMime(mime: string): string {
  return MIME_EXTENSIONS[mime] || 'bin'
}

export function chatAttachmentKey(userId: string, attachmentId: string, mime: string): string {
  return `chat/${userId}/${attachmentId}.${extensionForMime(mime)}`
}

export function createAttachmentId(): string {
  return `att_${crypto.randomUUID().replace(/-/g, '')}`
}

export function parseAttachmentIds(raw: unknown): string[] {
  if (typeof raw === 'string') {
    try {
      return parseAttachmentIds(JSON.parse(raw))
    } catch {
      return []
    }
  }

  if (!Array.isArray(raw)) return []

  return raw
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .slice(0, MAX_CHAT_ATTACHMENTS)
}

export function normalizeAttachmentIds(input: unknown): string[] {
  return parseAttachmentIds(input).slice(0, MAX_CHAT_ATTACHMENTS)
}

export interface ChatAttachmentRow {
  id: string
  user_id: string
  r2_key: string | null
  mime_type: string
  file_name: string | null
  file_size: number
  sort_order: number
  status: 'pending' | 'ready' | 'orphan'
}

export function validateAttachmentMeta(fileName: unknown, mimeType: unknown, fileSize: unknown) {
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, error: 'Unsupported image type' }
  }

  const size = Number(fileSize)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    return { ok: false as const, error: 'Image must be 5 MB or smaller' }
  }

  const name = typeof fileName === 'string' && fileName.trim()
    ? fileName.trim().slice(0, 200)
    : `image.${extensionForMime(mimeType)}`

  return { ok: true as const, fileName: name, mimeType, fileSize: size }
}
