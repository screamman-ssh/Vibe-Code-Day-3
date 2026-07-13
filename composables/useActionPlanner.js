import { chatCompletionOnce } from '~/composables/useOpenAIClient'
import { buildMultimodalUserContent } from '~/utils/chatMultimodal'
import { normalizeActions, heuristicParseToActions } from '~/utils/chatActionTypes'
import { useApi } from '~/composables/useApi'

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

หน้าที่: อ่านรูปสลิป/ใบเสร็จ/หน้าจอธนาคาร แล้วแปลงเป็น JSON actions สำหรับให้ผู้ใช้ตรวจก่อนบันทึก

กฎสำคัญ:
- ตอบเป็น JSON เท่านั้น
- ดึงทุกรายการที่เห็นในภาพ (หลายรายการได้)
- ใช้ตัวเลขจากภาพเท่านั้น ห้ามแต่ง
- โอนเข้า/รับเงิน → txType "income", category "Income"
- วันที่ไม่ชัด → "today"
- หมวด: Food, Transport, Housing, Utilities, Entertainment, Health, Education, Debt Payment, Savings, Income, Other

สคีมาเดียวกับ intent router (actions array)
`

function safeJsonParse(text) {
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

export function looksLikeWriteIntent(userMessage) {
  const q = (userMessage || '').toLowerCase()
  return [
    'บันทึก', 'เพิ่ม', 'ใส่', 'ลง', 'จด',
    'ตั้งงบ', 'กำหนดงบ', 'งบหมวด',
    'สร้างหนี้', 'เพิ่มหนี้', 'บัตร', 'สินเชื่อ',
    'จ่ายหนี้', 'ชำระ', 'โปะ',
    'โพสต์', 'แชร์', 'ลงโพสต์', 'post'
  ].some(k => q.includes(k))
}

export function looksLikeRecordFromImage(userMessage) {
  const q = (userMessage || '').toLowerCase()
  return [
    'บันทึก', 'จด', 'ใส่', 'เพิ่ม', 'ลง', 'save', 'record',
    'สลิป', 'ใบเสร็จ', 'receipt'
  ].some(k => q.includes(k))
}

export function shouldPlanWriteAction(userMessage, hasAttachments = false) {
  if (looksLikeWriteIntent(userMessage)) return true
  if (hasAttachments) return true
  return looksLikeRecordFromImage(userMessage)
}

export async function routeIntentToActions(userMessage) {
  const content = await chatCompletionOnce({
    messages: [
      { role: 'system', content: ROUTER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage || '' }
    ],
    temperature: 0,
    maxTokens: 600
  })

  const parsed = safeJsonParse(content)
  if (!parsed || !Array.isArray(parsed.actions)) return { actions: [] }

  return { actions: normalizeActions(parsed.actions) }
}

export async function routeVisionToActions(userMessage, attachments = []) {
  const api = useApi()
  const attachmentIds = (attachments || [])
    .map(a => a?.id)
    .filter(id => typeof id === 'string' && id && !id.startsWith('local_'))

  let ocrText = ''
  if (attachmentIds.length) {
    try {
      const res = await api.post('/api/v1/ocr/receipt', {
        attachmentIds,
        hint: userMessage || ''
      })
      ocrText = typeof res?.text === 'string' ? res.text : ''
    } catch (err) {
      ocrText = ''
    }
  }

  const userContent = ocrText
    ? `${userMessage || ''}\n\n=== OCR TEXT (from receipt image) ===\n${ocrText}\n=== END OCR TEXT ===\n\nแปลงเป็น JSON actions ตามสคีมา`
    : await buildMultimodalUserContent(
      `${userMessage || ''}\n\nดึงรายการธุรกรรมจากรูปเป็น JSON actions ตามสคีมา`,
      attachments
    )

  const content = await chatCompletionOnce({
    messages: [
      { role: 'system', content: VISION_PLANNER_PROMPT },
      { role: 'user', content: userContent }
    ],
    temperature: 0,
    maxTokens: 900
  })

  const parsed = safeJsonParse(content)
  const actions = parsed && Array.isArray(parsed.actions)
    ? normalizeActions(parsed.actions)
    : []

  if (actions.length) return { actions }

  if (ocrText) {
    return routeIntentToActions(
      `${userMessage || ''}\n\n=== OCR TEXT (from receipt image) ===\n${ocrText}\n=== END OCR TEXT ===\n\nแปลงเป็น JSON actions ตามสคีมา`
    )
  }

  return { actions: [] }
}

async function planWriteActionsClient(userMessage, attachments = []) {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (hasAttachments) {
    const visionPlan = await routeVisionToActions(userMessage, attachments)
    if (visionPlan.actions.length) return visionPlan
  }

  if (shouldPlanWriteAction(userMessage, hasAttachments)) {
    const intentPlan = await routeIntentToActions(userMessage)
    if (intentPlan.actions.length) return intentPlan
    return { actions: heuristicParseToActions(userMessage) }
  }

  return { actions: [] }
}

export async function planWriteActions(userMessage, attachments = []) {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  const attachmentIds = (attachments || [])
    .map(a => a?.id)
    .filter(id => typeof id === 'string' && id && !id.startsWith('local_'))

  if (attachmentIds.length || shouldPlanWriteAction(userMessage, hasAttachments)) {
    try {
      const api = useApi()
      const res = await api.post('/api/v1/chat/plan', {
        message: userMessage || '',
        attachmentIds
      })
      const actions = normalizeActions(res?.actions)
      if (actions.length) return { actions }
      // Server returned empty — keep going to client + heuristic
    } catch (err) {
      console.error('Server action planner failed, falling back to client:', err)
    }
  }

  const clientPlan = await planWriteActionsClient(userMessage, attachments)
  if (clientPlan.actions.length) return clientPlan

  if (shouldPlanWriteAction(userMessage, hasAttachments)) {
    return { actions: heuristicParseToActions(userMessage) }
  }

  return { actions: [] }
}
