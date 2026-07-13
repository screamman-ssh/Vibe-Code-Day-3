import {
  executeFinancialTool,
  summarizeToolResult,
  resolveToolsByIntent,
  hasFinancialIntent,
  assessFinancialDataState,
  buildGeneralFinancialAdvice,
  TOOL_LABELS
} from '~/utils/financialTools'
import { streamChatCompletion } from '~/composables/useOpenAIClient'
import { trimChatContext } from '~/composables/useChatHistory'
import {
  buildMultimodalUserContent,
  messageHasImages
} from '~/utils/chatMultimodal'
import { buildRecordTagPrompt } from '~/utils/chatRecordTag'

/** Shared RACE core: Role + Expectation (forbidden rules, format). Mode overlays add Action + Context. */
const RACE_FORBIDDEN_RULES = `ขอบเขตและข้อห้าม (สำคัญที่สุด):
- ตอบเฉพาะสิ่งที่ผู้ใช้ถามหรือสถานะในการสนทนานี้เท่านั้น
- ห้ามโปรโมทแอป ห้ามชวนใช้ซอฟต์แวร์อื่น ห้ามอ้างชื่อผลิตภัณฑ์ที่ไม่ได้กล่าวถึงในบทสนทนา (เช่น Company Expense, Planner หรือชื่ออื่นที่แต่งขึ้น)
- ห้ามปิดท้ายด้วยประโยคโฆษณา คำขวัญ หรือข้อความที่ไม่เกี่ยวกับคำถาม/ข้อมูลการเงินของผู้ใช้
- กล่าวถึง MoneyCircle เฉพาะเมื่อแนะขั้นตอนในแอปจริงๆ เท่านั้น
- ห้ามแต่งตัวเลขหรือสถิติที่ไม่มีใน "ข้อมูลการเงินของผู้ใช้" หรือในภาพที่แนบ`

const RACE_STYLE_RULES = `รูปแบบการตอบ:
- สั้น กระชับ อ่านง่าย ไม่เกิน 6-8 บรรทัด ยกเว้นผู้ใช้ขอรายละเอียด
- ภาษาไทยเป็นกันเอง ไม่ตัดสิน ไม่โทษ เน้นสนับสนุน
- ใช้ markdown เบาๆ (bullet **ตัวเลข**) ห้าม HTML ห้ามตาราง
- ห้ามทวนคำถาม ห้ามเกริ่นยาว ห้าม emoji มากเกินไป
- จบด้วยขั้นตอนถัดไปที่ทำได้ทันที 1 ข้อ แล้วหยุด ห้ามเขียนต่อหลังนั้น`

const RACE_CORE = `## Role (บทบาท)
คุณคือโค้ชสุขภาพการเงินส่วนบุคคลของแอป MoneyCircle พูดภาษาไทย
คุณฟังและเข้าใจสถานการณ์จริง ให้คำแนะนำที่ทำได้จริง ไม่ใช่ที่ปรึกษาการเงินอนุญาต
คุณไม่ขายของ ไม่โฆษณา และไม่พูดนอกเรื่องที่ผู้ใช้ถาม

## Expectation (คุณภาพคำตอบ)
${RACE_FORBIDDEN_RULES}

${RACE_STYLE_RULES}`

const MODE_GENERAL = `## Action (โหมดสนทนาทั่วไป)
- ตอบคำถามหรือทักทายของผู้ใช้ตรงประเด็นก่อน
- ทักทาย → ตอบสั้น 1-3 ประโยค ไม่ยัดเรื่องการเงิน
- คำถามทั่วไป → ตอบครบก่อน ชวนเรื่องการเงินได้ทีหลังเฉพาะเมื่อเกี่ยวข้องจริงๆ
- ไม่บังคับสรุปข้อมูลการเงินถ้าผู้ใช้ไม่ได้ถาม`

const MODE_FINANCE = `## Action (โหมดการเงิน)
- ยอมรับสิ่งที่ผู้ใช้ทำหรือถาม 1 ประโยค
- สรุปจากข้อมูลใน "ข้อมูลการเงินของผู้ใช้" เท่านั้น (bullet 2-4 ข้อ)
- ถ้าข้อมูลขาดหรือยังไม่มีในแอป → บอกตรงๆ 1 ข้อ (เช่น "ยังไม่มีรายรับบันทึก") ห้ามเดาหรือแต่งตัวเลข
- ปิดท้ายด้วยขั้นตอนถัดไป 1 ข้อ (ขึ้นต้นด้วย "ถัดไป:") ที่เกี่ยวกับสถานการณ์นี้

## Context (ข้อมูลจากแอป)
- ใช้เฉพาะตัวเลขและข้อเท็จจริงจากบล็อก "ข้อมูลการเงินของผู้ใช้"
- ถ้ายังไม่มีข้อมูลในแอปเลย → แนะนำหลักการสั้นๆ (เช่น 50/30/20, เงินสำรอง 3-6 เดือน) แล้วชวนบันทึกข้อมูลในแอป
- ห้ามปฏิเสธการตอบ`

const MODE_VISION = `## Action (โหมดรูปภาพ/สลิป)
- อ่านและวิเคราะห์รูปที่แนบ (สลิป ใบเสร็จ สรุปรายจ่าย ภาพหน้าจอ ฯลฯ)
- สรุปรายการ ยอดเงิน วันที่ ร้านค้า หมวดหมู่ ถ้ามีในภาพ
- โอนเข้า/รับเงิน → บันทึกเป็นรายรับ (income) แม้ผู้ใช้พิมพ์ว่ารายจ่าย
- ห้ามแต่งตัวเลขที่มองไม่เห็นในภาพ
- ยืนยันสิ่งที่อ่านได้ด้วยน้ำเสียงโค้ช แล้วจบ ไม่ต้องสรุปการเงินทั้งหมดถ้าไม่ได้ถาม`

const MODE_OVERLAYS = {
  general: MODE_GENERAL,
  finance: MODE_FINANCE,
  vision: MODE_VISION
}

function buildSystemPrompt(mode, contextBlock = '') {
  const overlay = MODE_OVERLAYS[mode] || MODE_GENERAL
  return `${RACE_CORE}\n\n${overlay}${contextBlock}`
}

function withRecordRules(prompt, { forceRecord = false } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const recordBlock = buildRecordTagPrompt({ todayIso: today })
  const force = forceRecord
    ? '\n\nผู้ใช้กำลังขอบันทึกรายการ — คุณต้องแนบแท็ก <record> อย่างน้อย 1 อันท้ายคำตอบถ้ามียอดที่อ่านได้'
    : ''
  return `${prompt}\n\n${recordBlock}${force}`
}

/** Build a plain-text context block from executed tool results (no tool-call API used). */
function buildContextBlock(toolTrace) {
  if (!toolTrace.length) return ''
  const lines = ['\n\n=== ข้อมูลการเงินของผู้ใช้ (ดึงจากแอป) ===']
  for (const t of toolTrace) {
    const label = TOOL_LABELS[t.name] || t.name
    if (!t.result?.ok) {
      lines.push(`\n[${label}] ไม่สามารถดึงข้อมูลได้`)
      continue
    }
    if (t.result.empty) {
      lines.push(`\n[${label}] ยังไม่มีข้อมูลในแอป`)
      continue
    }
    lines.push(`\n[${label}] ${JSON.stringify(t.result.data)}`)
  }
  lines.push('\n=== จบข้อมูล ===')
  return lines.join('')
}

function traceHasPersonalData(toolTrace) {
  return toolTrace.some(t => t.result?.ok && t.result?.empty === false)
}

function buildFallbackResponse(userMessage, toolTrace) {
  const hasAppData = assessFinancialDataState().hasAnyData || traceHasPersonalData(toolTrace)

  if (!hasAppData) {
    return `${buildGeneralFinancialAdvice(userMessage)}\n\n*หมายเหตุ: ตอนนี้ AI ตอบแบบเต็มรูปแบบไม่ได้ จึงให้คำแนะนำทั่วไปแทน*`
  }

  const budget = toolTrace.find(t => t.name === 'get_budget_status')
  const cashflow = toolTrace.find(t => t.name === 'get_cashflow_summary')
  const debts = toolTrace.find(t => t.name === 'get_debt_overview')
  const score = toolTrace.find(t => t.name === 'get_financial_score')

  let response = '**สรุปจากข้อมูลในแอป**\n\n'
  let hasSection = false

  if (cashflow?.result?.ok && !cashflow.result.empty) {
    const d = cashflow.result.data
    response += `- **รายรับ**: ${d.income.toLocaleString()} บาท\n`
    response += `- **รายจ่าย**: ${d.expense.toLocaleString()} บาท\n`
    response += `- **คงเหลือ**: ${d.net.toLocaleString()} บาท\n\n`
    hasSection = true
  }

  if (budget?.result?.ok && !budget.result.empty) {
    const over = budget.result.data.categories.filter(c => c.overBudget)
    if (over.length) {
      response += '### หมวดเกินงบ\n'
      over.forEach(c => {
        response += `- **${c.category}**: ใช้ไป ${c.spentAmount.toLocaleString()} / ${c.limitAmount.toLocaleString()} บาท (${c.percentUsed}%)\n`
      })
      response += '\n'
      hasSection = true
    }
  }

  if (debts?.result?.ok && !debts.result.empty && debts.result.data.count > 0) {
    const d = debts.result.data
    response += `### หนี้สิน\n- ยอดคงค้างรวม **${d.totalBalance.toLocaleString()} บาท** (${d.count} บัญชี)\n`
    response += `- จ่ายขั้นต่ำรวม ${d.totalMinimumPayment.toLocaleString()} บาท/เดือน\n\n`
    hasSection = true
  }

  if (score?.result?.ok) {
    response += `### คะแนนสุขภาพการเงิน\n- **${score.result.data.totalScore}** (${score.result.data.tierTh})\n\n`
    hasSection = true
  }

  if (!hasSection) {
    return `${buildGeneralFinancialAdvice(userMessage)}\n\n*หมายเหตุ: ข้อมูลในแอปยังไม่พอสำหรับสรุปแบบละเอียด จึงให้คำแนะนำทั่วไปแทน*`
  }

  response += '*สรุปนี้อิงข้อมูลจริงจากแอปของคุณ*\n\nถัดไป: เลือกหัวข้อที่อยากเจาะลึก (งบ หนี้ หรือคะแนนสุขภาพการเงิน) แล้วถามมาได้เลย'
  return response
}

export function useFinancialAgent() {
  /**
   * Resolve which tools to run for this question and execute them client-side.
   * We do NOT use the OpenAI tool-calling API because the worker's model
   * (gemma via jinja template) cannot render `tools`/`tool_calls`.
   */
  function gatherContext(userMessage, callbacks) {
    const toolNames = resolveToolsByIntent(userMessage)
    const toolTrace = []
    for (const name of toolNames) {
      callbacks.onToolStart?.(name)
      const result = executeFinancialTool(name, {})
      callbacks.onToolDone?.(name, result)
      toolTrace.push({ name, args: {}, summary: summarizeToolResult(name, result), result })
    }
    return toolTrace
  }

  async function streamAnswer(apiMessages, callbacks, options = {}) {
    return streamChatCompletion({
      messages: apiMessages,
      onStreamStart: () => callbacks.onStreamStart?.(),
      onToken: async (_piece, full) => {
        callbacks.onToken?.(_piece, full)
      },
      temperature: options.temperature,
      maxTokens: options.maxTokens
    })
  }

  async function buildApiMessages(systemPrompt, chatMessages, userAttachments = []) {
    const trimmed = trimChatContext(chatMessages)
    const lastUserIndex = trimmed.map(m => m.role).lastIndexOf('user')
    const messages = []

    for (let i = 0; i < trimmed.length; i++) {
      const message = trimmed[i]

      if (message.role === 'user' && i === lastUserIndex && messageHasImages(userAttachments)) {
        messages.push({
          role: 'user',
          content: await buildMultimodalUserContent(message.content, userAttachments)
        })
        continue
      }

      messages.push({
        role: message.role,
        content: message.content
      })
    }

    return [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  }

  async function runAgent({
    chatMessages,
    userMessage,
    userAttachments = [],
    callbacks = {},
    forceRecord = false,
    skipRecordRules = false
  }) {
    const hasImages = messageHasImages(userAttachments)
    const isFinance = hasFinancialIntent(userMessage) || hasImages || forceRecord

    // Phase 1: only retrieve financial data when the question is finance-related
    const toolTrace = isFinance && !forceRecord ? gatherContext(userMessage, callbacks) : []
    const contextBlock = buildContextBlock(toolTrace)
    const summaryOnlyNote = skipRecordRules
      ? '\n\nหมายเหตุ: ผู้ใช้ยืนยันบันทึกรายการแล้ว — ห้ามแนบแท็ก <record> ให้สรุปและแนะนำต่อเท่านั้น'
      : ''

    let systemPrompt = buildSystemPrompt('general', contextBlock)
    if (hasImages || forceRecord) {
      systemPrompt = withRecordRules(buildSystemPrompt('vision', contextBlock), { forceRecord: true })
    } else if (isFinance) {
      const financePrompt = buildSystemPrompt('finance', contextBlock) + summaryOnlyNote
      systemPrompt = skipRecordRules
        ? financePrompt
        : withRecordRules(financePrompt, { forceRecord: false })
    }

    const apiMessages = await buildApiMessages(systemPrompt, chatMessages, userAttachments)

    let finalContent = ''

    try {
      finalContent = await streamAnswer(apiMessages, callbacks, {
        temperature: hasImages || forceRecord ? 0.3 : 0.5,
        maxTokens: hasImages || forceRecord ? 900 : 350
      })

      if (!finalContent?.trim() && isFinance) {
        finalContent = buildFallbackResponse(userMessage, toolTrace)
      }

      return {
        content: finalContent,
        toolTrace: toolTrace.map(({ name, args, summary }) => ({ name, args, summary }))
      }
    } catch (err) {
      finalContent = isFinance
        ? buildFallbackResponse(userMessage, toolTrace)
        : 'ขออภัยครับ ตอนนี้เชื่อมต่อ AI ไม่ได้ชั่วคราว ลองใหม่อีกครั้งนะครับ'
      return {
        content: finalContent,
        toolTrace: toolTrace.map(({ name, args, summary }) => ({ name, args, summary })),
        error: err.message
      }
    }
  }

  return { runAgent, TOOL_LABELS }
}
