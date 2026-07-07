<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useTransactionsStore } from '~/stores/transactions'
import { useBudgetStore } from '~/stores/budget'
import { useDebtsStore } from '~/stores/debts'
import { useFinancialAgent } from '~/composables/useFinancialAgent'
import { useChatHistory } from '~/composables/useChatHistory'
import { useChatDraft } from '~/composables/useChatDraft'
import { planWriteActions } from '~/composables/useActionPlanner'
import { useActionExecutor } from '~/composables/useActionExecutor'
import { normalizeActions } from '~/utils/chatActionTypes'
import { TOOL_LABELS, assessFinancialDataState } from '~/utils/financialTools'
import ChatMessageMarkdown from '~/components/chat/ChatMessageMarkdown.vue'
import ChatThinkingPlaceholder from '~/components/chat/ChatThinkingPlaceholder.vue'
import ChatComposer from '~/components/chat/ChatComposer.vue'
import ActionPreviewCard from '~/components/chat/ActionPreviewCard.vue'
import {
  Sparkles,
  User,
  Database,
  RotateCcw,
  Lightbulb
} from 'lucide-vue-next'

const auth = useAuthStore()
const txStore = useTransactionsStore()
const budgetStore = useBudgetStore()
const debtsStore = useDebtsStore()
const { runAgent } = useFinancialAgent()
const { executePlan } = useActionExecutor()
const { loadHistory, saveHistory, clearHistory, trimChatContext } = useChatHistory()

const user = computed(() => auth.user || { displayName: 'คุณ', avatarUrl: '', subscriptionTier: 'free', id: 'guest' })
const historyUserIdRef = computed(() => user.value?.id || 'guest')

const {
  draftText,
  attachments: draftAttachments,
  isLoading: isDraftLoading,
  isSyncing: isDraftSyncing,
  loadDraft,
  addFiles,
  removeAttachment,
  retryUpload,
  clearDraft,
  watchDraft
} = useChatDraft(historyUserIdRef)

watchDraft(historyUserIdRef)

function buildWelcomeMessage() {
  return `สวัสดีครับคุณ **${user.value.displayName}**! ผมคือ AI โค้ชการเงินของ MoneyCircle\n\nถามเรื่องงบ ออม หนี้ — หรือคุยเรื่องอื่นก็ได้ ผมจะดึงข้อมูลจากแอปมาช่วยเมื่อเกี่ยวข้อง`
}

function createWelcomeState() {
  return [{ role: 'assistant', content: buildWelcomeMessage(), toolTrace: [], status: 'done' }]
}

function historyUserId() {
  return user.value?.id || 'guest'
}

async function persistChatHistory() {
  try {
    await saveHistory(historyUserId(), messages.value)
  } catch (err) {
    console.error('Failed to persist chat history:', err)
  }
}

async function restoreChatHistory() {
  isHistoryLoading.value = true
  try {
    const saved = await loadHistory(historyUserId())
    if (saved?.length) {
      const onlyWelcome = saved.length === 1
        && saved[0].role === 'assistant'
        && !saved.some(message => message.role === 'user')

      messages.value = onlyWelcome ? createWelcomeState() : saved
      showSuggestions.value = !messages.value.some(message => message.role === 'user')
      return
    }

    messages.value = createWelcomeState()
    showSuggestions.value = true
  } finally {
    isHistoryLoading.value = false
  }
}

const messages = ref(createWelcomeState())
const isLoading = ref(false)
const isStreaming = ref(false)
const activeTools = ref([])
const chatContainer = ref(null)
const showSuggestions = ref(true)
const isHistoryLoading = ref(false)
const attachmentErrors = ref([])
const pendingPlanIndex = ref(null)
const isApplyingPlan = ref(false)

const hasPendingReply = computed(() => isLoading.value || isStreaming.value)
const hasPendingPlan = computed(() => pendingPlanIndex.value != null)

const hasUserMessages = computed(() => messages.value.some(m => m.role === 'user'))

const hasUploadingAttachments = computed(() =>
  draftAttachments.value.some(item => item.status === 'uploading')
)

function isActiveAssistant(idx) {
  return idx === messages.value.length - 1 && messages.value[idx]?.role === 'assistant'
}

function getThinkingStatus(msg, idx) {
  if (!isActiveAssistant(idx) || msg.content) return null
  if (activeTools.value.length || msg.status === 'tools') return 'tools'
  if (isStreaming.value || msg.status === 'streaming') return 'streaming'
  return 'thinking'
}

const overBudgetCategories = computed(() =>
  budgetStore.categories.filter(c => c.spentAmount > c.limitAmount)
)

const suggestions = computed(() => {
  const chips = []
  const dataState = assessFinancialDataState()

  if (!dataState.hasAnyData) {
    return [
      { label: 'เริ่มคุมงบยังไงดี', prompt: 'แนะนำวิธีเริ่มต้นคุมงบประมาณสำหรับมือใหม่' },
      { label: 'เงินสำรองฉุกเฉิน', prompt: 'ควรมีเงินสำรองฉุกเฉินเท่าไหร่' },
      { label: 'Snowball vs Avalanche', prompt: 'อธิบายวิธีปลดหนี้ Snowball และ Avalanche' },
      { label: 'กฎ 50/30/20', prompt: 'กฎ 50/30/20 คืออะไร ใช้ยังไง' }
    ]
  }

  if (overBudgetCategories.value.length) {
    const cat = overBudgetCategories.value[0].category
    chips.push({
      label: `${cat} เกินงบ`,
      prompt: `หมวด ${cat} เกินงบ ช่วยแนะนำการลดรายจ่าย`
    })
  }
  if (debtsStore.totalBalance > 0) {
    chips.push({
      label: 'วางแผนปลดหนี้',
      prompt: `วางแผนปลดหนี้จากยอดคงค้าง ${debtsStore.totalBalance.toLocaleString()} บาท`
    })
  }
  chips.push(
    { label: 'วิเคราะห์รายจ่าย', prompt: 'วิเคราะห์การใช้จ่ายเดือนนี้ให้หน่อย' },
    { label: 'ลดรายจ่าย', prompt: 'แนะนำแผนคุมงบประมาณลดหย่อนรายจ่าย' },
    { label: 'จัดการหนี้', prompt: 'ขอแนวทางจัดการและชำระหนี้สินสะสม' }
  )
  return chips.slice(0, 5)
})

const contextSummary = computed(() => {
  const dataState = assessFinancialDataState()
  if (!dataState.hasAnyData) return 'ยังไม่มีข้อมูล — ให้คำแนะนำทั่วไปได้'
  return `${txStore.items.length} ธุรกรรม · ${budgetStore.categories.length} หมวดงบ · ${debtsStore.items.length} บัญชีหนี้`
})

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function formatToolTrace(trace) {
  if (!trace?.length) return ''
  return trace.map(t => TOOL_LABELS[t.name] || t.name).join(', ')
}

async function resetChat() {
  if (hasPendingReply.value) return
  await clearHistory(historyUserId())
  await clearDraft(historyUserId())
  messages.value = createWelcomeState()
  showSuggestions.value = true
  attachmentErrors.value = []
  scrollToBottom()
}

async function clonePreviewUrl(url) {
  if (!url) return null
  if (typeof url !== 'string' || !url.startsWith('blob:')) return url

  const response = await fetch(url)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

async function buildMessageAttachments() {
  const ready = draftAttachments.value.filter(item => item.status === 'ready')

  const previewUrls = await Promise.all(
    ready.map(item => clonePreviewUrl(item.localPreviewUrl))
  )

  return ready.map((item, idx) => ({
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    previewUrl: previewUrls[idx] || item.localPreviewUrl
  }))
}

async function handleAddFiles(fileList) {
  attachmentErrors.value = []
  const errors = await addFiles(fileList)
  if (errors.length) {
    attachmentErrors.value = [...new Set(errors)]
  }
}

async function handleSend(text, options = {}) {
  const msgText = typeof text === 'string' ? text : draftText.value
  const readyAttachments = await buildMessageAttachments()
  const hasText = msgText?.trim()
  const hasAttachments = readyAttachments.length > 0

  if ((!hasText && !hasAttachments) || hasPendingReply.value || hasUploadingAttachments.value || hasPendingPlan.value) return

  showSuggestions.value = false
  messages.value.push({
    role: 'user',
    content: hasText ? msgText.trim() : '(แนบรูป)',
    attachments: readyAttachments
  })

  const sentText = hasText ? msgText.trim() : 'ช่วยวิเคราะห์รูปที่แนบมาให้หน่อย'
  draftText.value = ''
  await clearDraft(historyUserId())
  persistChatHistory()
  scrollToBottom()

  // Phase 3: write intent → vision/text planner → editable preview card
  if (!options.skipIntentRouter && historyUserId() !== 'guest') {
    try {
      const rawPlan = await planWriteActions(sentText, readyAttachments)
      const actions = normalizeActions(rawPlan?.actions)
      if (actions.length) {
        pendingPlanIndex.value = messages.value.push({
          role: 'assistant',
          content: '',
          toolTrace: [],
          status: 'done',
          previewPlan: {
            actions,
            sourceText: sentText,
            attachmentCount: readyAttachments.length,
            state: 'pending'
          }
        }) - 1
        persistChatHistory()
        scrollToBottom()
        return
      }
    } catch (err) {
      console.error('Action planner failed:', err)
    }
  }

  isLoading.value = true
  isStreaming.value = false
  activeTools.value = []

  const chatHistory = trimChatContext(
    messages.value.filter(message => message.role === 'user' || message.role === 'assistant')
  )
  const assistantIndex = messages.value.push({
    role: 'assistant',
    content: '',
    toolTrace: [],
    status: 'thinking'
  }) - 1

  try {
    const result = await runAgent({
      chatMessages: chatHistory,
      userMessage: sentText,
      userAttachments: readyAttachments,
      callbacks: {
        onToolStart(name) {
          messages.value[assistantIndex].status = 'tools'
          if (!activeTools.value.includes(name)) activeTools.value.push(name)
          scrollToBottom()
        },
        onToolDone(name) {
          activeTools.value = activeTools.value.filter(t => t !== name)
          if (!activeTools.value.length) {
            messages.value[assistantIndex].status = 'thinking'
          }
        },
        onStreamStart() {
          isLoading.value = false
          isStreaming.value = true
          messages.value[assistantIndex].status = 'streaming'
        },
        onToken(_chunk, full) {
          isLoading.value = false
          isStreaming.value = true
          messages.value[assistantIndex].status = 'streaming'
          messages.value[assistantIndex].content = full
          scrollToBottom()
        }
      }
    })

    messages.value[assistantIndex].content = result.content
    messages.value[assistantIndex].toolTrace = result.toolTrace
    messages.value[assistantIndex].status = 'done'
  } catch (err) {
    console.error(err)
    messages.value[assistantIndex].content = `ขออภัยครับ เกิดข้อผิดพลาด (${err.message}) กรุณาลองใหม่อีกครั้ง`
    messages.value[assistantIndex].status = 'done'
  } finally {
    isLoading.value = false
    isStreaming.value = false
    activeTools.value = []
    persistChatHistory()
    scrollToBottom()
  }
}

async function applyPreviewPlan(index) {
  const msg = messages.value[index]
  const plan = msg?.previewPlan
  if (!plan || !Array.isArray(plan.actions) || plan.state !== 'pending') return

  const actions = normalizeActions(plan.actions)
  if (!actions.length) {
    plan.state = 'failed'
    plan.error = 'ไม่มีรายการที่บันทึกได้'
    pendingPlanIndex.value = null
    return
  }

  isApplyingPlan.value = true
  plan.state = 'applying'
  plan.actions = actions

  try {
    await executePlan(actions)

    msg.previewPlan.state = 'applied'
    pendingPlanIndex.value = null
    persistChatHistory()

    await handleSend(
      `อัปเดตข้อมูลให้แล้ว: ${plan.sourceText}\n\nช่วยสรุปผลและแนะนำต่อให้หน่อย`,
      { skipIntentRouter: true }
    )
  } catch (err) {
    console.error('Failed to apply plan:', err)
    msg.previewPlan.state = 'failed'
    msg.previewPlan.error = err?.message || 'Apply failed'
    pendingPlanIndex.value = null
    persistChatHistory()
  } finally {
    isApplyingPlan.value = false
  }
}

function cancelPreviewPlan(index) {
  const msg = messages.value[index]
  if (msg?.previewPlan?.state === 'pending' || msg?.previewPlan?.state === 'failed') {
    msg.previewPlan.state = 'cancelled'
    pendingPlanIndex.value = null
    persistChatHistory()
  }
}

watch(() => auth.user?.id, async () => {
  if (!hasPendingReply.value) {
    await restoreChatHistory()
    await loadDraft(historyUserId())
    scrollToBottom()
  }
})

watch(messages, () => scrollToBottom(), { deep: true })
onMounted(async () => {
  await restoreChatHistory()
  await loadDraft(historyUserId())
  scrollToBottom()
})
</script>

<template>
  <div class="chat-page">
    <!-- Compact header -->
    <header class="chat-page__header">
      <div class="flex items-center gap-2 min-w-0">
        <div class="chat-page__avatar chat-page__avatar--brand">
          <Sparkles class="w-4 h-4 fill-current" />
        </div>
        <div class="min-w-0">
          <h1 class="chat-page__title font-brand">AI โค้ชการเงิน</h1>
          <p class="chat-page__meta flex items-center gap-1 truncate">
            <Database class="w-3 h-3 shrink-0" />
            <span class="truncate">{{ contextSummary }}</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        class="chat-page__reset"
        :disabled="hasPendingReply"
        title="เริ่มบทสนทนาใหม่"
        @click="resetChat"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </header>

    <!-- Messages -->
    <div ref="chatContainer" class="chat-page__messages">
      <p v-if="isHistoryLoading" class="chat-page__history-loading">กำลังโหลดประวัติแชท...</p>
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="chat-page__row"
        :class="msg.role === 'user' ? 'chat-page__row--user' : 'chat-page__row--assistant'"
      >
        <div
          v-if="msg.role === 'assistant'"
          class="chat-page__avatar chat-page__avatar--assistant"
          :class="{ 'chat-page__avatar--thinking': getThinkingStatus(msg, idx) }"
        >
          <Sparkles class="w-3.5 h-3.5 fill-primary" />
        </div>

        <div
          class="chat-page__bubble"
          :class="msg.role === 'user' ? 'chat-page__bubble--user' : 'chat-page__bubble--assistant'"
        >
          <template v-if="msg.role === 'assistant'">
            <ChatThinkingPlaceholder
              v-if="getThinkingStatus(msg, idx)"
              :status="getThinkingStatus(msg, idx)"
              :active-tools="getThinkingStatus(msg, idx) === 'tools' ? activeTools : []"
            />
            <ActionPreviewCard
              v-if="msg.previewPlan && (msg.previewPlan.state === 'pending' || msg.previewPlan.state === 'failed')"
              :plan="msg.previewPlan"
              :disabled="hasPendingReply || isApplyingPlan"
              @confirm="applyPreviewPlan(idx)"
              @cancel="cancelPreviewPlan(idx)"
            />
            <p v-if="msg.previewPlan?.state === 'applied'" class="tool-trace-footer">
              บันทึกข้อมูลแล้ว
            </p>
            <p v-if="msg.previewPlan?.state === 'cancelled'" class="tool-trace-footer">
              ยกเลิกการบันทึก
            </p>
            <p v-if="msg.previewPlan?.state === 'failed'" class="chat-page__attachment-error">
              บันทึกไม่สำเร็จ: {{ msg.previewPlan.error || 'เกิดข้อผิดพลาด' }}
            </p>
            <ChatMessageMarkdown
              v-if="msg.content"
              :content="msg.content"
              :streaming="isStreaming && isActiveAssistant(idx)"
            />
            <p v-if="msg.toolTrace?.length && msg.status === 'done'" class="tool-trace-footer">
              ใช้ข้อมูล: {{ formatToolTrace(msg.toolTrace) }}
            </p>
          </template>
          <template v-else>
            <div v-if="msg.attachments?.length" class="chat-page__user-attachments">
              <img
                v-for="attachment in msg.attachments"
                :key="attachment.id"
                :src="attachment.previewUrl"
                :alt="attachment.fileName"
                class="chat-page__user-attachment"
              />
            </div>
            <span v-if="msg.content && msg.content !== '(แนบรูป)'">{{ msg.content }}</span>
          </template>
        </div>

        <div v-if="msg.role === 'user'" class="chat-page__avatar chat-page__avatar--user">
          <img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            :alt="user.displayName"
            class="w-full h-full object-cover rounded-full"
          />
          <User v-else class="w-3.5 h-3.5" />
        </div>
      </div>
    </div>

    <!-- Footer: suggestions + input -->
    <footer class="chat-page__footer">
      <div v-if="showSuggestions || !hasUserMessages" class="chat-page__suggestions">
        <p class="chat-page__suggestions-label">
          <Lightbulb class="w-3 h-3" />
          <span>ลองถาม</span>
        </p>
        <div class="chat-page__suggestions-scroll scrollbar-none">
          <button
            v-for="s in suggestions"
            :key="s.prompt"
            type="button"
            class="chat-page__chip"
            :disabled="hasPendingReply"
            @click="handleSend(s.prompt)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div v-else-if="hasUserMessages && !hasPendingReply" class="chat-page__suggestions-toggle">
        <button type="button" class="chat-page__chip chat-page__chip--ghost" @click="showSuggestions = true">
          <Lightbulb class="w-3 h-3" />
          แสดงคำถามแนะนำ
        </button>
      </div>

      <p v-if="attachmentErrors.length" class="chat-page__attachment-error">
        {{ attachmentErrors[0] }}
      </p>

      <ChatComposer
        v-model="draftText"
        :attachments="draftAttachments"
        :disabled="hasPendingReply || isDraftLoading || hasPendingPlan"
        :is-syncing="isDraftSyncing"
        @send="handleSend()"
        @add-files="handleAddFiles"
        @remove-attachment="removeAttachment"
        @retry-upload="retryUpload"
      />
    </footer>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 40rem;
  margin-left: auto;
  margin-right: auto;
  /* mobile: main pt-3 + floating bottom nav (bottom-4 + bar + labels) */
  height: calc(100dvh - 0.75rem - 6.75rem - env(safe-area-inset-bottom, 0px));
  max-height: calc(100dvh - 0.75rem - 6.75rem - env(safe-area-inset-bottom, 0px));
}

@media (min-width: 768px) {
  .chat-page {
    height: calc(100dvh - 3rem);
    max-height: calc(100dvh - 3rem);
    max-width: 44rem;
  }
}

.chat-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem 0.75rem;
  flex-shrink: 0;
}

.chat-page__title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-ink);
}

.chat-page__meta {
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
  margin-top: 0.125rem;
}

.chat-page__reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 12px;
  border: 2px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  color: var(--color-ink-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 150ms, background 150ms;
}

.chat-page__reset:hover:not(:disabled) {
  color: var(--color-ink);
  background: var(--color-surface-bg);
}

.chat-page__reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-page__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.chat-page__avatar--brand {
  background: color-mix(in oklch, var(--color-primary) 12%, white);
  color: var(--color-primary);
  border: 2px solid color-mix(in oklch, var(--color-primary) 20%, transparent);
}

.chat-page__avatar--assistant {
  background: color-mix(in oklch, var(--color-primary) 10%, white);
  color: var(--color-primary);
  border: 2px solid color-mix(in oklch, var(--color-primary) 18%, transparent);
}

.chat-page__avatar--user {
  background: var(--color-surface-bg);
  color: var(--color-ink-muted);
  border: 2px solid var(--color-border-subtle);
}

.chat-page__messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem 0.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.chat-page__history-loading {
  margin: 0;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-ink-muted);
  padding: 0.5rem 0;
}

.chat-page__row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 100%;
}

.chat-page__row--user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.chat-page__row--assistant {
  align-self: flex-start;
}

.chat-page__bubble {
  max-width: min(88%, 28rem);
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: var(--text-base);
  line-height: 1.5;
  word-break: break-word;
}

.chat-page__bubble--user {
  background: var(--color-primary);
  color: white;
  border-bottom-right-radius: 4px;
  white-space: pre-line;
  font-weight: 500;
}

.chat-page__user-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
}

.chat-page__user-attachment {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.chat-page__attachment-error {
  margin: 0 0 0.375rem;
  font-size: var(--text-caption);
  color: var(--color-danger, #dc2626);
  padding-left: 0.25rem;
}

.chat-page__avatar--thinking {
  animation: chat-avatar-pulse 1.4s ease-in-out infinite;
}

@keyframes chat-avatar-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-primary) 20%, transparent);
  }
  50% {
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-primary) 12%, transparent);
  }
}

.chat-page__bubble--assistant {
  background: var(--color-surface-card);
  color: var(--color-ink);
  border: 2px solid var(--color-border-subtle);
  border-bottom-left-radius: 4px;
}

.chat-page__bubble--typing {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  min-height: 2.5rem;
}

.chat-page__footer {
  flex-shrink: 0;
  padding: 0.5rem 0.25rem;
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
  border-top: 2px solid var(--color-border-subtle);
  background: var(--color-surface-bg);
  z-index: 20;
}

@media (max-width: 767px) {
  .chat-page__footer {
    border-top: 2px solid var(--color-border-subtle);
  }
}

.chat-page__suggestions {
  margin-bottom: 0.5rem;
}

.chat-page__suggestions-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--color-ink-muted);
  margin-bottom: 0.375rem;
  padding-left: 0.125rem;
}

.chat-page__suggestions-scroll {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding-bottom: 0.125rem;
  -webkit-overflow-scrolling: touch;
}

.chat-page__suggestions-toggle {
  margin-bottom: 0.5rem;
}

.chat-page__chip {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: var(--text-label);
  font-weight: 600;
  white-space: nowrap;
  border: 2px solid color-mix(in oklch, var(--color-primary) 25%, var(--color-border-subtle));
  background: var(--color-surface-card);
  color: var(--color-primary);
  cursor: pointer;
  transition: background 150ms, border-color 150ms;
}

.chat-page__chip:hover:not(:disabled) {
  background: color-mix(in oklch, var(--color-primary) 8%, white);
  border-color: color-mix(in oklch, var(--color-primary) 35%, transparent);
}

.chat-page__chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-page__chip--ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-ink-muted);
  border-color: var(--color-border-subtle);
  background: transparent;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
