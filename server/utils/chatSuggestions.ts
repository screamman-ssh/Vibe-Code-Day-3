import type { H3Event } from 'h3'
import { chatCompletionOnceServer } from './llm'
import { safeJsonParse } from './chatPlanner'

export const MAX_SUGGESTION_TURNS = 6

export type SuggestionChip = { label: string; prompt: string }

const SUGGESTIONS_SYSTEM_PROMPT = `คุณช่วยสร้าง "คำถามถัดไป" สำหรับแชทโค้ชการเงิน MoneyCircle

หน้าที่: จากบทสนทนาล่าสุด + สรุปข้อมูลการเงิน สร้างคำถามที่ผู้ใช้ควรถามต่อ

กฎสำคัญ:
- ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
- สร้าง 3–4 ข้อ
- ทุกข้อต้องเป็นคำถามหรือข้อความที่ผู้ใช้จะพิมพ์ถามต่อ — ห้ามเป็นคำสั่งให้ AI "ช่วยแก้/ลดรายจ่าย/วางแผน" แบบทั่วไป
- ยึดเนื้อหาจากคำตอบล่าสุดของ AI + สรุปข้อมูลเงิน ห้ามถามซ้ำสิ่งที่คุยแล้ว
- ผสมมุมเจาะลึก (zoom in) กับมุมกว้าง (zoom out) ให้ต่างกัน
- ภาษาไทยเท่านั้น
- label สั้นๆ สำหรับปุ่ม (ไม่เกิน ~24 ตัวอักษร)
- prompt คือข้อความเต็มที่ผู้ใช้จะส่ง

สคีมา:
{
  "suggestions": [
    { "label": string, "prompt": string }
  ]
}

ถ้าสร้างไม่ได้ ให้คืน {"suggestions":[]}
`

function normalizeSuggestionMessages(input: unknown) {
  if (!Array.isArray(input)) return []

  return input
    .filter((message: any) => {
      return (message?.role === 'user' || message?.role === 'assistant')
        && typeof message?.content === 'string'
        && message.content.trim()
    })
    .map((message: any) => ({
      role: message.role as 'user' | 'assistant',
      content: String(message.content).trim().slice(0, 1200)
    }))
    .slice(-MAX_SUGGESTION_TURNS)
}

function normalizeChipItem(item: unknown): SuggestionChip | null {
  if (typeof item === 'string' && item.trim()) {
    const prompt = item.trim()
    return { label: prompt.slice(0, 24), prompt: prompt.slice(0, 280) }
  }

  if (!item || typeof item !== 'object') return null

  const row = item as Record<string, unknown>
  const label = typeof row.label === 'string' ? row.label.trim()
    : typeof row.title === 'string' ? row.title.trim()
      : typeof row.text === 'string' ? row.text.trim()
        : ''
  const prompt = typeof row.prompt === 'string' ? row.prompt.trim()
    : typeof row.question === 'string' ? row.question.trim()
      : typeof row.text === 'string' ? row.text.trim()
        : label

  if (!label || !prompt) return null
  return {
    label: label.slice(0, 40),
    prompt: prompt.slice(0, 280)
  }
}

function parseSuggestions(raw: string): SuggestionChip[] {
  const parsed = safeJsonParse(raw)
  let list: unknown[] = []

  if (Array.isArray(parsed)) {
    list = parsed
  } else if (Array.isArray(parsed?.suggestions)) {
    list = parsed.suggestions
  } else if (Array.isArray(parsed?.questions)) {
    list = parsed.questions
  }

  const chips: SuggestionChip[] = []
  for (const item of list) {
    const chip = normalizeChipItem(item)
    if (!chip) continue
    chips.push(chip)
    if (chips.length >= 4) break
  }

  return chips
}

export async function generateChatSuggestions(
  event: H3Event,
  {
    messages,
    contextSummary,
    apiKeyOverride
  }: {
    messages: unknown
    contextSummary?: unknown
    apiKeyOverride?: string | null
  }
): Promise<SuggestionChip[]> {
  const turns = normalizeSuggestionMessages(messages)
  if (!turns.length) return []

  const summary = typeof contextSummary === 'string' && contextSummary.trim()
    ? contextSummary.trim().slice(0, 400)
    : 'ไม่มีสรุปข้อมูล'

  const transcript = turns
    .map(m => `${m.role === 'user' ? 'ผู้ใช้' : 'AI'}: ${m.content}`)
    .join('\n')

  try {
    const content = await chatCompletionOnceServer(event, {
      messages: [
        { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `สรุปข้อมูลการเงิน:\n${summary}\n\nบทสนทนาล่าสุด:\n${transcript}\n\nสร้างคำถามถัดไปเป็น JSON`
        }
      ],
      temperature: 0.4,
      maxTokens: 400,
      apiKeyOverride
    })

    return parseSuggestions(content)
  } catch (err) {
    console.error('generateChatSuggestions failed:', err)
    return []
  }
}
