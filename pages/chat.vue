<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useTransactionsStore } from '~/stores/transactions'
import { useBudgetStore } from '~/stores/budget'
import { useDebtsStore } from '~/stores/debts'
import { useFinancialAgent } from '~/composables/useFinancialAgent'
import { TOOL_LABELS, assessFinancialDataState } from '~/utils/financialTools'
import ChatMessageMarkdown from '~/components/chat/ChatMessageMarkdown.vue'
import {
  Sparkles,
  Send,
  RefreshCw,
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

const user = computed(() => auth.user || { displayName: 'คุณ', avatarUrl: '', subscriptionTier: 'free' })

function buildWelcomeMessage() {
  return `สวัสดีครับคุณ **${user.value.displayName}**! ผมคือ AI โค้ชการเงินของ MoneyCircle\n\nถามเรื่องงบ ออม หนี้ — หรือคุยเรื่องอื่นก็ได้ ผมจะดึงข้อมูลจากแอปมาช่วยเมื่อเกี่ยวข้อง`
}

const messages = ref([
  { role: 'assistant', content: buildWelcomeMessage(), toolTrace: [] }
])
const inputMessage = ref('')
const isLoading = ref(false)
const isStreaming = ref(false)
const activeTools = ref([])
const chatContainer = ref(null)
const showSuggestions = ref(true)

const hasUserMessages = computed(() => messages.value.some(m => m.role === 'user'))

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

function resetChat() {
  if (isLoading.value) return
  messages.value = [{ role: 'assistant', content: buildWelcomeMessage(), toolTrace: [] }]
  showSuggestions.value = true
  scrollToBottom()
}

async function handleSend(text) {
  const msgText = typeof text === 'string' ? text : inputMessage.value
  if (!msgText?.trim() || isLoading.value) return

  showSuggestions.value = false
  messages.value.push({ role: 'user', content: msgText.trim() })
  inputMessage.value = ''
  scrollToBottom()

  isLoading.value = true
  activeTools.value = []

  const chatHistory = messages.value.filter(m => m.role === 'user' || m.role === 'assistant')
  const assistantIndex = messages.value.push({
    role: 'assistant',
    content: '',
    toolTrace: []
  }) - 1

  try {
    const result = await runAgent({
      chatMessages: chatHistory,
      userMessage: msgText.trim(),
      callbacks: {
        onToolStart(name) {
          if (!activeTools.value.includes(name)) activeTools.value.push(name)
          scrollToBottom()
        },
        onToolDone(name) {
          activeTools.value = activeTools.value.filter(t => t !== name)
        },
        onStreamStart() {
          isLoading.value = false
          isStreaming.value = true
        },
        onToken(_chunk, full) {
          isLoading.value = false
          isStreaming.value = true
          messages.value[assistantIndex].content = full
          scrollToBottom()
        }
      }
    })

    messages.value[assistantIndex].content = result.content
    messages.value[assistantIndex].toolTrace = result.toolTrace
  } catch (err) {
    console.error(err)
    messages.value[assistantIndex].content = `ขออภัยครับ เกิดข้อผิดพลาด (${err.message}) กรุณาลองใหม่อีกครั้ง`
  } finally {
    isLoading.value = false
    isStreaming.value = false
    activeTools.value = []
    scrollToBottom()
  }
}

watch(messages, () => scrollToBottom(), { deep: true })
onMounted(() => scrollToBottom())
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
        :disabled="isLoading"
        title="เริ่มบทสนทนาใหม่"
        @click="resetChat"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </header>

    <!-- Messages -->
    <div ref="chatContainer" class="chat-page__messages">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="chat-page__row"
        :class="msg.role === 'user' ? 'chat-page__row--user' : 'chat-page__row--assistant'"
      >
        <div
          v-if="msg.role === 'assistant'"
          class="chat-page__avatar chat-page__avatar--assistant"
        >
          <Sparkles class="w-3.5 h-3.5 fill-primary" />
        </div>

        <div
          class="chat-page__bubble"
          :class="msg.role === 'user' ? 'chat-page__bubble--user' : 'chat-page__bubble--assistant'"
        >
          <template v-if="msg.role === 'assistant'">
            <ChatMessageMarkdown
              v-if="msg.content"
              :content="msg.content"
              :streaming="isStreaming && idx === messages.length - 1"
            />
            <p v-if="msg.toolTrace?.length" class="tool-trace-footer">
              ใช้ข้อมูล: {{ formatToolTrace(msg.toolTrace) }}
            </p>
          </template>
          <template v-else>{{ msg.content }}</template>
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

      <!-- Typing indicator -->
      <div v-if="isLoading || activeTools.length" class="chat-page__row chat-page__row--assistant">
        <div class="chat-page__avatar chat-page__avatar--assistant animate-pulse">
          <RefreshCw class="w-3.5 h-3.5 animate-spin" />
        </div>
        <div class="chat-page__bubble chat-page__bubble--assistant chat-page__bubble--typing">
          <span>{{ isLoading && !activeTools.length ? 'กำลังคิดคำตอบ...' : 'กำลังดึงข้อมูลจากแอป...' }}</span>
          <div v-if="activeTools.length" class="flex flex-wrap gap-1 mt-1.5">
            <span v-for="tool in activeTools" :key="tool" class="tool-status-chip">
              {{ TOOL_LABELS[tool] || tool }}
            </span>
          </div>
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
            :disabled="isLoading"
            @click="handleSend(s.prompt)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div v-else-if="hasUserMessages && !isLoading" class="chat-page__suggestions-toggle">
        <button type="button" class="chat-page__chip chat-page__chip--ghost" @click="showSuggestions = true">
          <Lightbulb class="w-3 h-3" />
          แสดงคำถามแนะนำ
        </button>
      </div>

      <form class="chat-page__input-row" @submit.prevent="handleSend()">
        <input
          id="chat-message-input"
          v-model="inputMessage"
          type="text"
          autocomplete="off"
          aria-label="พิมพ์คำถาม"
          placeholder="พิมพ์คำถาม..."
          class="chat-page__input"
          :disabled="isLoading"
        />
        <button
          type="submit"
          class="chat-page__send"
          :disabled="isLoading || !inputMessage.trim()"
          aria-label="ส่งข้อความ"
        >
          <Send class="w-4 h-4" />
        </button>
      </form>
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
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-ink);
}

.chat-page__meta {
  font-size: 0.625rem;
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
  padding: 0.625rem 0.875rem;
  border-radius: 12px;
  font-size: 0.8125rem;
  line-height: 1.55;
  word-break: break-word;
}

.chat-page__bubble--user {
  background: var(--color-primary);
  color: white;
  border-bottom-right-radius: 4px;
  white-space: pre-line;
}

.chat-page__bubble--assistant {
  background: var(--color-surface-card);
  color: var(--color-ink);
  border: 2px solid var(--color-border-subtle);
  border-bottom-left-radius: 4px;
}

.chat-page__bubble--typing {
  color: var(--color-ink-muted);
  font-size: 0.75rem;
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
  font-size: 0.625rem;
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
  font-size: 0.6875rem;
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

.chat-page__input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chat-page__input {
  flex: 1;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  border-radius: 12px;
  border: 2px solid var(--color-border-subtle);
  background: var(--color-surface-card);
  font-size: 0.8125rem;
  color: var(--color-ink);
  outline: none;
  transition: border-color 150ms;
}

.chat-page__input:focus {
  border-color: var(--color-primary);
}

.chat-page__input:disabled {
  opacity: 0.6;
}

.chat-page__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 150ms;
}

.chat-page__send:hover:not(:disabled) {
  opacity: 0.9;
}

.chat-page__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
