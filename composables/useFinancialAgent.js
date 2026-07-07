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

const STYLE_RULES = `รูปแบบการตอบ (สำคัญมาก):
- สั้น กระชับ อ่านง่าย ไม่เกิน 5-8 บรรทัด ยกเว้นผู้ใช้ขอรายละเอียด
- ใช้ภาษาง่าย ไม่ใช้ศัพท์เทคนิคโดยไม่จำเป็น
- โครงสร้าง: สรุป 1-2 ประโยค → bullet 2-4 ข้อ → แนะนำถัดไป 1 ประโยค
- ใช้ markdown เบาๆ (หัวข้อเล็ก bullet **ตัวเลข**) ไม่ใช้ HTML ไม่ใช้ตาราง
- ห้ามทวนคำถาม ห้ามข้อความเกริ่นยาว ห้าม emoji มากเกินไป`

const SYSTEM_PROMPT_FINANCE = `คุณคือ MoneyCircle AI โค้ชการเงินภาษาไทย

กฎ:
- ใช้ตัวเลขจาก "ข้อมูลการเงินของผู้ใช้" เท่านั้น ห้ามแต่งตัวเลข
- ไม่มีข้อมูล → แนะนำทั่วไปสั้นๆ (50/30/20, เงินสำรอง 3-6 เดือน) แล้วชวนบันทึกข้อมูลในแอป
- ห้ามปฏิเสธการตอบ

${STYLE_RULES}`

const SYSTEM_PROMPT_GENERAL = `คุณคือ MoneyCircle AI ผู้ช่วยภาษาไทย เป็นมิตร พูดคุยได้ทุกเรื่อง ความเชี่ยวชาญหลักคือการเงิน

กฎ:
- ตอบตรงคำถาม สั้น เป็นกันเอง
- ทักทาย → ตอบสั้น 1-3 ประโยค ไม่ยัดเรื่องการเงิน
- คำถามทั่วไป → ตอบก่อน ชวนเรื่องการเงินได้ทีหลังถ้าเหมาะ

${STYLE_RULES}`

const SYSTEM_PROMPT_VISION = `คุณคือ MoneyCircle AI โค้ชการเงินภาษาไทย

กฎเมื่อผู้ใช้แนบรูป:
- อ่านและวิเคราะห์รูปที่แนบมา (สลิป ใบเสร็จ สรุปรายจ่าย ภาพหน้าจอ ฯลฯ)
- สรุปรายการ ยอดเงิน วันที่ ร้านค้า หมวดหมู่ ถ้ามีในภาพ
- แนะนำว่าควรบันทึกเป็นรายการอะไรในแอป (ถ้าเหมาะ)
- ห้ามแต่งตัวเลขที่มองไม่เห็นในภาพ

${STYLE_RULES}`

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

  response += '*สรุปนี้อิงข้อมูลจริงจากแอปของคุณ*'
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

  async function runAgent({ chatMessages, userMessage, userAttachments = [], callbacks = {} }) {
    const hasImages = messageHasImages(userAttachments)
    const isFinance = hasFinancialIntent(userMessage) || hasImages

    // Phase 1: only retrieve financial data when the question is finance-related
    const toolTrace = isFinance ? gatherContext(userMessage, callbacks) : []
    const contextBlock = buildContextBlock(toolTrace)

    let systemPrompt = SYSTEM_PROMPT_GENERAL
    if (hasImages) {
      systemPrompt = SYSTEM_PROMPT_VISION + contextBlock
    } else if (isFinance) {
      systemPrompt = SYSTEM_PROMPT_FINANCE + contextBlock
    }

    const apiMessages = await buildApiMessages(systemPrompt, chatMessages, userAttachments)

    let finalContent = ''

    try {
      finalContent = await streamAnswer(apiMessages, callbacks, {
        temperature: hasImages ? 0.7 : 0.5,
        maxTokens: hasImages ? 800 : 350
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
