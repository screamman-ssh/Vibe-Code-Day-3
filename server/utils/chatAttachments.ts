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

export async function getDraftAttachmentIds(db: any, userId: string): Promise<string[]> {
  const row = await db.prepare(`
    SELECT attachment_ids_json as attachmentIdsJson
    FROM chat_drafts
    WHERE user_id = ?
  `).bind(userId).first<{ attachmentIdsJson?: string }>()

  return parseAttachmentIds(row?.attachmentIdsJson)
}

/** Drop stale uploads so the 8-image cap applies to the current composer only. */
export async function pruneOrphanedChatAttachments(db: any, userId: string) {
  const draftIds = await getDraftAttachmentIds(db, userId)

  if (draftIds.length) {
    const placeholders = draftIds.map(() => '?').join(', ')
    await db.prepare(`
      UPDATE chat_attachments
      SET status = 'orphan', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status = 'ready' AND id NOT IN (${placeholders})
    `).bind(userId, ...draftIds).run()

    await db.prepare(`
      DELETE FROM chat_attachments
      WHERE user_id = ? AND status = 'pending'
        AND id NOT IN (${placeholders})
        AND datetime(created_at) < datetime('now', '-15 minutes')
    `).bind(userId, ...draftIds).run()
  } else {
    await db.prepare(`
      UPDATE chat_attachments
      SET status = 'orphan', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status = 'ready'
    `).bind(userId).run()

    await db.prepare(`
      DELETE FROM chat_attachments
      WHERE user_id = ? AND status = 'pending'
        AND datetime(created_at) < datetime('now', '-15 minutes')
    `).bind(userId).run()
  }
}

export async function countComposerAttachments(db: any, userId: string): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(*) as count
    FROM chat_attachments
    WHERE user_id = ? AND status IN ('pending', 'ready')
  `).bind(userId).first<{ count: number }>()

  return row?.count || 0
}
