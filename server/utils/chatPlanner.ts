import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { useDB } from './db'
import { useR2 } from './r2'
import { normalizeAttachmentIds } from './chatAttachments'
import { chatCompletionOnceServer } from './llm'
import {
  ACTION_TYPES,
  normalizeActions,
  parseAmount,
  normalizeCategory
} from '../../utils/chatActionTypes'

const ROUTER_SYSTEM_PROMPT = `คุณคือ intent router ของแอปการเงิน MoneyCircle

หน้าที่: แปลงข้อความผู้ใช้เป็น "แผนการกระทำ" แบบ JSON เพื่อให้แอปโชว์พรีวิวและให้ผู้ใช้กดยืนยันก่อนเขียนข้อมูลลงระบบ

กฎสำคัญ:
- ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
- ถ้าไม่มั่นใจหรือข้อมูลไม่พอ ให้คืน {"actions":[]}
- วันที่: ถ้าไม่ระบุ ให้ใช้ "today"
- หมวดหมู่ธุรกรรมใช้ค่าเหล่านี้: Food, Transport, Housing, Utilities, Entertainment, Health, Education, Debt Payment, Savings, Income, Other

สคีมา:
{
  "actions": [
    {
      "type": "create_transaction" | "update_transaction" | "delete_transaction" | "set_budget" | "add_debt" | "record_debt_payment" | "create_social_post",
      "data": { ... }
    }
  ]
}

รายละเอียด data:
- create_transaction: { "txType":"income"|"expense", "amount":number, "category":string, "merchant"?:string, "note"?:string, "date":"today"|"YYYY-MM-DD" }
`

const VISION_PLANNER_PROMPT = `คุณคือ receipt/slip parser ของแอปการเงิน MoneyCircle

หน้าที่: อ่านข้อความ OCR จากสลิป/ใบเสร็จ แล้วแปลงเป็น JSON actions สำหรับให้ผู้ใช้ตรวจก่อนบันทึก

กฎสำคัญ:
- ตอบเป็น JSON เท่านั้น
- ดึงทุกรายการที่เห็น (หลายรายการได้)
- ใช้ตัวเลขจากข้อความเท่านั้น ห้ามแต่ง
- โอนเข้า/รับเงิน → txType "income", category "Income" (แม้ผู้ใช้พิมพ์ว่ารายจ่าย)
- โอนออก/จ่าย/ซื้อ → txType "expense"
- วันที่ตอบเป็น "YYYY-MM-DD" เท่านั้น ห้ามใส่เวลา
- หมวด: Food, Transport, Housing, Utilities, Entertainment, Health, Education, Debt Payment, Savings, Income, Other

สคีมาเดียวกับ intent router (actions array)
`

const OCR_SYSTEM_PROMPT = `คุณคือ OCR สำหรับใบเสร็จ/สลิป

เป้าหมาย: ดึงข้อความทั้งหมดที่อ่านได้จากภาพให้มากที่สุด

กฎ:
- ตอบเป็น JSON เท่านั้น
- ห้ามอธิบาย ห้ามสรุป ห้ามเดา
- เก็บบรรทัดและตัวเลขตามที่เห็น

รูปแบบ:
{"text":"..."}
`

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

export function safeJsonParse(text: string) {
  if (!text || typeof text !== 'string') return null
  let trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) trimmed = fence[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
}

function extractLlmText(content: string) {
  if (!content) return ''
  const parsed = safeJsonParse(content)
  if (parsed && typeof parsed.text === 'string') return parsed.text
  return content
}

function looksLikeWriteIntent(userMessage: string) {
  const q = (userMessage || '').toLowerCase()
  return [
    'บันทึก', 'เพิ่ม', 'ใส่', 'ลง', 'จด',
    'ตั้งงบ', 'กำหนดงบ', 'งบหมวด',
    'สร้างหนี้', 'เพิ่มหนี้', 'บัตร', 'สินเชื่อ',
    'จ่ายหนี้', 'ชำระ', 'โปะ',
    'โพสต์', 'แชร์', 'ลงโพสต์', 'post'
  ].some(k => q.includes(k))
}

function shouldPlanWriteAction(userMessage: string, hasAttachments: boolean) {
  if (looksLikeWriteIntent(userMessage)) return true
  if (hasAttachments) return true
  return false
}

function parseDateFromText(text: string) {
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  }

  const eng = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{2,4})\b/i)
  if (eng) {
    const [, d, mon, yRaw] = eng
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${monthMap[mon.slice(0, 3).toLowerCase()]}-${d.padStart(2, '0')}`
  }

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return iso[0]

  const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return 'today'
}

function heuristicParseReceiptToActions(ocrText: string, userMessage: string) {
  if (!ocrText?.trim()) return []

  const combined = `${ocrText}\n${userMessage || ''}`
  const amountPatterns = [
    /(?:ยอด|amount|จำนวน|โอน|transfer)[:\s]*([\d,]+\.?\d*)/i,
    /([\d,]+\.\d{2})\s*(?:บาท|baht|thb)/i,
    /\b([\d,]{4,}\.?\d*)\b/
  ]

  let amount = NaN
  for (const pattern of amountPatterns) {
    const match = combined.match(pattern)
    if (match?.[1]) {
      amount = parseAmount(match[1])
      if (Number.isFinite(amount) && amount > 0) break
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) return []

  // Prefer slip signals over casual "รายจ่าย" in user prompt
  const incomeSignal = /โอนเข้า|รับโอน|รับเงิน|transfer in|deposit|รายรับ|เข้าบัญชี|income|เงินเดือน/i.test(combined)
  const expenseSignal = /โอนออก|ซื้อ|สแกนซื้อ|ชำระบิล|expense/i.test(combined)
  const isIncome = incomeSignal && !expenseSignal

  let merchant = ''
  const fromMatch = combined.match(/(?:จาก|from)[:\s]*([A-Za-z0-9\u0E00-\u0E7F ._-]{2,40})/i)
  const toMatch = combined.match(/(?:ไปที่|to|ผู้รับ)[:\s]*([A-Za-z0-9\u0E00-\u0E7F ._-]{2,40})/i)
  if (fromMatch?.[1]) merchant = fromMatch[1].trim()
  else if (toMatch?.[1]) merchant = toMatch[1].trim()

  return normalizeActions([{
    type: ACTION_TYPES.CREATE_TX,
    data: {
      txType: isIncome ? 'income' : 'expense',
      amount,
      category: isIncome ? 'Income' : normalizeCategory(userMessage),
      merchant,
      note: '',
      date: parseDateFromText(combined)
    }
  }])
}

async function loadAttachmentImages(event: H3Event, userId: string, attachmentIds: string[]) {
  const db = useDB(event)
  const bucket = useR2(event)
  if (!bucket || !attachmentIds.length) return []

  const placeholders = attachmentIds.map(() => '?').join(', ')
  const { results } = await db.prepare(`
    SELECT id, r2_key as r2Key, mime_type as mimeType
    FROM chat_attachments
    WHERE user_id = ? AND id IN (${placeholders}) AND status = 'ready'
  `).bind(userId, ...attachmentIds).all<{
    r2Key: string
    mimeType: string
  }>()

  const imageParts: any[] = []
  for (const row of results || []) {
    if (!row?.r2Key) continue
    const obj = await bucket.get(row.r2Key)
    if (!obj) continue
    const base64 = arrayBufferToBase64(await obj.arrayBuffer())
    imageParts.push({
      type: 'image_url',
      image_url: { url: `data:${row.mimeType};base64,${base64}` }
    })
  }

  return imageParts
}

async function runOcr(
  event: H3Event,
  userId: string,
  attachmentIds: string[],
  hint: string,
  apiKeyOverride?: string | null
) {
  const imageParts = await loadAttachmentImages(event, userId, attachmentIds)
  if (!imageParts.length) return ''

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
    apiKeyOverride
  })

  return extractLlmText(content)
}

async function routeIntentToActions(
  event: H3Event,
  userMessage: string,
  apiKeyOverride?: string | null
) {
  const content = await chatCompletionOnceServer(event, {
    messages: [
      { role: 'system', content: ROUTER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage || '' }
    ],
    temperature: 0,
    maxTokens: 700,
    apiKeyOverride
  })

  const parsed = safeJsonParse(content)
  if (!parsed || !Array.isArray(parsed.actions)) return []
  return normalizeActions(parsed.actions)
}

async function routeVisionToActions(
  event: H3Event,
  userMessage: string,
  ocrText: string,
  apiKeyOverride?: string | null
) {
  const content = await chatCompletionOnceServer(event, {
    messages: [
      { role: 'system', content: VISION_PLANNER_PROMPT },
      {
        role: 'user',
        content: `${userMessage || ''}\n\n=== OCR TEXT ===\n${ocrText}\n=== END OCR ===\n\nแปลงเป็น JSON actions ตามสคีมา`
      }
    ],
    temperature: 0,
    maxTokens: 900,
    apiKeyOverride
  })

  const parsed = safeJsonParse(content)
  if (!parsed || !Array.isArray(parsed.actions)) return []
  return normalizeActions(parsed.actions)
}

export async function planChatActions(
  event: H3Event,
  {
    userId,
    message,
    attachmentIds = []
  }: {
    userId: string
    message: string
    attachmentIds?: string[]
  }
) {
  const apiKeyOverride = getHeader(event, 'x-llm-key') || getHeader(event, 'x-ai-key') || null
  const ids = normalizeAttachmentIds(attachmentIds)
  const hasAttachments = ids.length > 0

  if (!shouldPlanWriteAction(message, hasAttachments)) {
    return []
  }

  let ocrText = ''
  if (hasAttachments) {
    ocrText = await runOcr(event, userId, ids, message, apiKeyOverride)
  }

  if (ocrText) {
    const visionActions = await routeVisionToActions(event, message, ocrText, apiKeyOverride)
    if (visionActions.length) return visionActions

    const intentWithOcr = await routeIntentToActions(
      event,
      `${message}\n\n=== OCR TEXT ===\n${ocrText}\n=== END OCR ===\n\nแปลงเป็น JSON actions`,
      apiKeyOverride
    )
    if (intentWithOcr.length) return intentWithOcr

    const heuristic = heuristicParseReceiptToActions(ocrText, message)
    if (heuristic.length) return heuristic
  }

  const intentActions = await routeIntentToActions(event, message, apiKeyOverride)
  if (intentActions.length) return intentActions

  // Last resort: regex parse so UI always gets a confirm card for write intents
  const heuristicFromMessage = heuristicParseReceiptToActions(
    ocrText || message,
    message
  )
  return heuristicFromMessage
}
