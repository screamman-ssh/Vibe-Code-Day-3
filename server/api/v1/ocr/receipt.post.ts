import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { useDB } from '../../../utils/db'
import { useR2 } from '../../../utils/r2'
import { normalizeAttachmentIds } from '../../../utils/chatAttachments'
import { chatCompletionOnceServer } from '../../../utils/llm'

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...slice)
  }
  // btoa exists in Cloudflare runtime
  return btoa(binary)
}

function safeJsonParse(text: string) {
  const trimmed = (text || '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
}

const OCR_SYSTEM_PROMPT = `คุณคือ OCR สำหรับใบเสร็จ/สลิป

เป้าหมาย: ดึงข้อความทั้งหมดที่อ่านได้จากภาพให้มากที่สุด

กฎ:
- ตอบเป็น JSON เท่านั้น
- ห้ามอธิบาย ห้ามสรุป ห้ามเดา
- เก็บบรรทัดและตัวเลขตามที่เห็น (เว้นวรรค/ขึ้นบรรทัดพอประมาณ)

รูปแบบ:
{"text":"..."}
`

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // Optional: allow local/dev to pass the same AI key used by the client
  // when LLM_API_KEY isn't configured in the Cloudflare env.
  const clientAiKey = getHeader(event, 'x-llm-key') || getHeader(event, 'x-ai-key') || ''

  const body = await readBody(event)
  const attachmentIds = normalizeAttachmentIds(body?.attachmentIds)
  const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 400) : ''

  if (!attachmentIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Missing attachmentIds' })
  }

  const db = useDB(event)
  const bucket = useR2(event)
  if (!bucket) {
    throw createError({ statusCode: 503, statusMessage: 'Image storage is not configured' })
  }

  const placeholders = attachmentIds.map(() => '?').join(', ')
  const { results } = await db.prepare(`
    SELECT id, r2_key as r2Key, mime_type as mimeType, status
    FROM chat_attachments
    WHERE user_id = ? AND id IN (${placeholders}) AND status = 'ready'
  `).bind(auth.userId, ...attachmentIds).all<{
    id: string
    r2Key: string
    mimeType: string
    status: string
  }>()

  if (!results?.length) {
    throw createError({ statusCode: 404, statusMessage: 'Attachments not found' })
  }

  const imageParts: any[] = []
  for (const row of results) {
    if (!row?.r2Key) continue
    const obj = await bucket.get(row.r2Key)
    if (!obj) continue
    const ab = await obj.arrayBuffer()
    const base64 = arrayBufferToBase64(ab)
    const dataUrl = `data:${row.mimeType};base64,${base64}`
    imageParts.push({ type: 'image_url', image_url: { url: dataUrl } })
  }

  if (!imageParts.length) {
    throw createError({ statusCode: 404, statusMessage: 'Images not found in storage' })
  }

  const userText = [
    hint ? `คำขอจากผู้ใช้: ${hint}` : '',
    'อ่านข้อความทั้งหมดจากภาพให้มากที่สุด แล้วตอบเป็น JSON {"text":"..."}'
  ].filter(Boolean).join('\n\n')

  const content = await chatCompletionOnceServer(event, {
    messages: [
      { role: 'system', content: OCR_SYSTEM_PROMPT },
      { role: 'user', content: [{ type: 'text', text: userText }, ...imageParts] }
    ],
    temperature: 0,
    maxTokens: 1200,
    apiKeyOverride: typeof clientAiKey === 'string' && clientAiKey.trim() ? clientAiKey.trim() : null
  })

  const parsed = safeJsonParse(content)
  const text = typeof parsed?.text === 'string' ? parsed.text : ''

  return {
    ok: true,
    text
  }
})

