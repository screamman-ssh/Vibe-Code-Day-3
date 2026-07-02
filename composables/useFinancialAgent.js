import {
  executeFinancialTool,
  summarizeToolResult,
  resolveToolsByIntent,
  hasFinancialIntent,
  assessFinancialDataState,
  buildGeneralFinancialAdvice,
  TOOL_LABELS
} from '~/utils/financialTools'
import { createOpenAIClient, DEFAULT_MODEL } from '~/composables/useOpenAIClient'

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

function buildMockResponse(userMessage, toolTrace) {
  const hasAppData = assessFinancialDataState().hasAnyData || traceHasPersonalData(toolTrace)

  if (!hasAppData) {
    return `${buildGeneralFinancialAdvice(userMessage)}\n\n*โหมดสำรอง — ยังไม่มีข้อมูลในแอป แต่ยังให้คำแนะนำการเงินเบื้องต้นได้*`
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
    return `${buildGeneralFinancialAdvice(userMessage)}\n\n*โหมดสำรอง — ข้อมูลในแอปยังไม่เพียงพอ จึงให้คำแนะนำทั่วไปแทน*`
  }

  response += '*คำแนะนำนี้อิงข้อมูลจริงจากแอปของคุณ (โหมดสำรองเมื่อเชื่อมต่อ AI ไม่ได้)*'
  return response
}

/** Emit text in small chunks so offline fallback still feels streamed */
async function emitSimulatedStream(text, callbacks) {
  callbacks.onStreamStart?.()
  const chunkSize = 12
  let full = ''
  for (let i = 0; i < text.length; i += chunkSize) {
    const piece = text.slice(i, i + chunkSize)
    full += piece
    callbacks.onToken?.(piece, full)
    await new Promise(r => setTimeout(r, 16))
  }
  return full
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

  async function streamAnswer(openai, apiMessages, callbacks) {
    callbacks.onStreamStart?.()
    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: apiMessages,
      temperature: 0.5,
      max_tokens: 350,
      stream: true
    })

    let content = ''
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        content += text
        callbacks.onToken?.(text, content)
      }
    }
    return content
  }

  async function runAgent({ chatMessages, userMessage, callbacks = {} }) {
    const openai = createOpenAIClient()
    const isFinance = hasFinancialIntent(userMessage)

    // Phase 1: only retrieve financial data when the question is finance-related
    const toolTrace = isFinance ? gatherContext(userMessage, callbacks) : []
    const contextBlock = buildContextBlock(toolTrace)
    const systemPrompt = isFinance
      ? SYSTEM_PROMPT_FINANCE + contextBlock
      : SYSTEM_PROMPT_GENERAL

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages.map(m => ({ role: m.role, content: m.content }))
    ]

    let finalContent = ''

    try {
      // Phase 2: stream the answer (plain chat completion, no tools param)
      finalContent = await streamAnswer(openai, apiMessages, callbacks)

      if (!finalContent?.trim() && isFinance) {
        finalContent = buildMockResponse(userMessage, toolTrace)
        await emitSimulatedStream(finalContent, callbacks)
      }

      return {
        content: finalContent,
        toolTrace: toolTrace.map(({ name, args, summary }) => ({ name, args, summary }))
      }
    } catch (err) {
      const mockContent = isFinance
        ? buildMockResponse(userMessage, toolTrace)
        : 'ขออภัยครับ ตอนนี้เชื่อมต่อ AI ไม่ได้ชั่วคราว ลองใหม่อีกครั้งนะครับ'
      finalContent = await emitSimulatedStream(mockContent, callbacks)
      return {
        content: finalContent,
        toolTrace: toolTrace.map(({ name, args, summary }) => ({ name, args, summary })),
        error: err.message
      }
    }
  }

  return { runAgent, TOOL_LABELS }
}
