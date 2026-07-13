import {
  ACTION_TYPES,
  normalizeActions,
  normalizeCategory,
  parseAmount,
  resolveActionDate,
  createEmptyTransaction,
  heuristicParseToActions
} from '~/utils/chatActionTypes'

const RECORD_TAG_RE = /<record>\s*([\s\S]*?)\s*<\/record>/gi
const OPEN_RECORD_RE = /<record>\s*[\s\S]*$/i

/**
 * Copay-style prompt block: LLM answers normally, then appends <record>JSON</record>.
 * Adapted for MoneyCircle transactions (income/expense + category).
 */
export function buildRecordTagPrompt({ todayIso } = {}) {
  const today = todayIso || new Date().toISOString().slice(0, 10)
  return `
กติกาการบันทึกรายการอัตโนมัติ (สำคัญมาก!):
หากผู้ใช้พิมพ์ข้อความที่มีลักษณะเป็นการบันทึกรายรับ/รายจ่าย หรือคุณวิเคราะห์สลิป/รูปภาพที่ผู้ใช้ส่งมาและพบธุรกรรม
ให้คุณสรุปรายละเอียดรายการและยอดเงินด้วยน้ำเสียงเป็นมิตรตามปกติ และต้องปิดท้ายข้อความคำตอบด้วยการแนบข้อมูลธุรกรรมเป็น JSON ในแท็ก XML <record>...</record> ต่อท้ายเสมอ เช่น:

ตรวจพบข้อมูลแล้ว กรุณาตรวจและกดยืนยันเพื่อบันทึกนะครับ
<record>{"totalAmount":120.00,"txType":"expense","category":"Food","merchant":"ร้านอาหาร","date":"${today}","time":"12:00","note":"อาหารกลางวัน","isPlanned":false}</record>

รายละเอียด JSON ใน <record>:
- totalAmount (number): ยอดเต็มก่อนหักอะไรก็ตาม ห้ามแต่งตัวเลข
- txType (string): "income" | "expense" — สลิปโอนเข้า/รับเงิน = income, จ่าย/ซื้อ/โอนออก = expense
- category (string): Food, Transport, Housing, Utilities, Entertainment, Health, Education, Debt Payment, Savings, Income, Other
- merchant (string): ชื่อร้าน / ผู้โอน / ผู้รับ ถ้ามี
- date (string): "YYYY-MM-DD" เท่านั้น ห้ามใส่เวลาใน date (วันนี้คือ ${today})
- time (string): "HH:mm" ถ้ามีในสลิป ไม่มีใช้ "12:00"
- note (string): รายละเอียดสั้นๆ
- isPlanned (boolean): true เฉพาะเมื่อเป็นแผนในอนาคต

กฎพิเศษ:
- โอนเข้า/รับเงิน → txType "income", category "Income" แม้ผู้ใช้พิมพ์ว่ารายจ่าย
- ห้ามใส่แท็ก <record> ถ้าไม่มียอดเงินที่ชัดเจน
- ห้ามอธิบายแท็ก <record> ให้ผู้ใช้เห็นในข้อความหลัก — แค่แปะท้ายคำตอบ
- หลายรายการ → ใส่หลายแท็ก <record> ติดกันได้
`.trim()
}

export function stripRecordTags(text = '') {
  if (!text) return ''
  let out = String(text).replace(RECORD_TAG_RE, '')
  // Hide incomplete trailing tag while streaming
  out = out.replace(OPEN_RECORD_RE, '')
  return out.trim()
}

export function extractRecordPayloads(text = '') {
  if (!text) return []
  const payloads = []
  const re = new RegExp(RECORD_TAG_RE.source, 'gi')
  let match
  while ((match = re.exec(String(text))) !== null) {
    const raw = (match[1] || '').trim()
    if (!raw) continue
    try {
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end <= start) continue
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (parsed && typeof parsed === 'object') payloads.push(parsed)
    } catch {
      // ignore malformed record
    }
  }
  return payloads
}

export function recordPayloadToAction(payload) {
  if (!payload || typeof payload !== 'object') return null

  const amount = parseAmount(
    payload.totalAmount ?? payload.amount ?? payload.price ?? payload.fullPrice
  )
  if (!Number.isFinite(amount) || amount <= 0) return null

  const note = typeof payload.note === 'string' ? payload.note.trim() : ''
  const merchant = typeof payload.merchant === 'string'
    ? payload.merchant.trim()
    : (note || '')

  let txType = payload.txType === 'income' || payload.type === 'income'
    ? 'income'
    : 'expense'

  const hint = `${merchant} ${note} ${payload.category || ''}`
  if (/โอนเข้า|รับโอน|รับเงิน|รายรับ|deposit|income/i.test(hint)) {
    txType = 'income'
  }

  const category = txType === 'income'
    ? 'Income'
    : normalizeCategory(payload.category || note || merchant)

  const date = resolveActionDate(payload.date || 'today')
  const time = typeof payload.time === 'string' && /^\d{1,2}:\d{2}/.test(payload.time)
    ? payload.time.slice(0, 5)
    : ''

  return {
    type: ACTION_TYPES.CREATE_TX,
    data: {
      txType,
      amount,
      category,
      merchant,
      note: time ? `${note}${note ? ' · ' : ''}${time}`.trim() : note,
      date
    }
  }
}

export function recordsToActions(payloads = []) {
  const actions = payloads.map(recordPayloadToAction).filter(Boolean)
  const normalized = normalizeActions(actions)
  return normalized.length ? normalized : actions
}

/**
 * Split assistant reply into visible markdown + transaction actions from <record> tags.
 */
export function parseAssistantRecordContent(fullText = '', { fallbackText = '' } = {}) {
  const payloads = extractRecordPayloads(fullText)
  let actions = recordsToActions(payloads)

  if (!actions.length && fallbackText) {
    actions = heuristicParseToActions(fallbackText)
    const normalized = normalizeActions(actions)
    if (normalized.length) actions = normalized
  }

  if (!actions.length && /บันทึก|สลิป|ใบเสร็จ|receipt/i.test(fallbackText || fullText)) {
    actions = [createEmptyTransaction()]
  }

  return {
    displayText: stripRecordTags(fullText),
    actions,
    records: payloads
  }
}
