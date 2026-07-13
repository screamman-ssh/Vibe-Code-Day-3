<script setup>
import { ref, computed } from 'vue'
import PageBanner from '~/components/layout/PageBanner.vue'
import { storeToRefs } from 'pinia'
import { useScoreStore } from '~/stores/score'
import { useDebtsStore } from '~/stores/debts'
import { alertDialog, confirmDialog } from '~/composables/useConfirmDialog'
import { createOpenAIClient, DEFAULT_MODEL, withLlmNoThinking } from '~/composables/useOpenAIClient'
import ChatMessageMarkdown from '~/components/chat/ChatMessageMarkdown.vue'
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Edit,
  ArrowUpRight, 
  ArrowDownRight,
  Check, 
  X, 
  ShieldAlert, 
  Calculator, 
  Sparkles, 
  RefreshCw, 
  Sliders,
  DollarSign
} from 'lucide-vue-next'

const scoreStore = useScoreStore()
const debtsStore = useDebtsStore()
const { items: debts } = storeToRefs(debtsStore)

// Local tab routing within debts page
const currentSection = ref('list') // 'list', 'simulator', 'calculator', 'ai'

// Modal Visibility states
const showAddModal = ref(false)
const showEditModal = ref(false)
const showPayModal = ref(false)

const selectedDebt = ref(null)
const selectedDebtForEdit = ref(null)

// Form fields
const name = ref('')
const originalAmount = ref('')
const balance = ref('')
const apr = ref('')
const minimumPayment = ref('')
const dueDay = ref('15')
const paymentAmount = ref('')

// Simulator state
const extraMonthlyPayback = ref(2000)
const selectedDebtForSim = ref('all')

const targetDebts = computed(() => {
  if (selectedDebtForSim.value === 'all') {
    return debts.value
  }
  return debts.value.filter(d => d.id === selectedDebtForSim.value)
})

const targetMinPaybackSum = computed(() => {
  return targetDebts.value.reduce((sum, d) => sum + d.minimumPayment, 0)
})

const targetTotalSimPaybackSum = computed(() => {
  return targetMinPaybackSum.value + parseFloat(extraMonthlyPayback.value || 0)
})

const simMonthsWidth = computed(() => {
  if (!simulationResults.value) return 0
  const results = simulationResults.value
  
  if (results.neverEndingMin) return 15
  
  const minVal = parseFloat(results.minMonths) || 1
  const extraVal = parseFloat(results.extraMonths) || 0
  
  return Math.min(Math.max(Math.round((extraVal / minVal) * 100), 5), 100)
})

const simInterestWidth = computed(() => {
  if (!simulationResults.value) return 0
  const results = simulationResults.value
  
  if (results.neverEndingMin) return 10
  
  const minVal = results.minInterest || 1
  const extraVal = results.extraInterest || 0
  
  return Math.min(Math.max(Math.round((extraVal / minVal) * 100), 5), 100)
})

// 2D Linear graph points math for simulator
const graphData = computed(() => {
  const list = targetDebts.value
  if (list.length === 0) return null

  const maxMonths = 36 // simulate up to 3 years
  const pointsMin = []
  const pointsExtra = []

  const initialBal = list.reduce((sum, d) => sum + d.balance, 0)
  if (initialBal <= 0) return null

  // clone balances
  const minBalances = list.map(d => ({ bal: d.balance, apr: d.apr, min: d.minimumPayment }))
  const extraBalances = list.map(d => ({ bal: d.balance, apr: d.apr, min: d.minimumPayment, extra: parseFloat(extraMonthlyPayback.value || 0) }))

  // Month 0
  pointsMin.push({ month: 0, balance: initialBal })
  pointsExtra.push({ month: 0, balance: initialBal })

  // Run simulation
  for (let m = 1; m <= maxMonths; m++) {
    // Min Strategy
    let currentMinSum = 0
    minBalances.forEach(d => {
      const interest = d.bal * ((d.apr / 100) / 12)
      d.bal = Math.max(d.bal + interest - d.min, 0)
      currentMinSum += d.bal
    })
    pointsMin.push({ month: m, balance: currentMinSum })

    // Extra Strategy
    let currentExtraSum = 0
    extraBalances.forEach(d => {
      const interest = d.bal * ((d.apr / 100) / 12)
      const totalPayment = d.min + d.extra
      d.bal = Math.max(d.bal + interest - totalPayment, 0)
      currentExtraSum += d.bal
    })
    pointsExtra.push({ month: m, balance: currentExtraSum })
  }

  // Map to SVG coordinate box (500x180)
  // X limits: 40 -> 480 (width margin)
  // Y limits: 160 -> 10 (height margin)
  const mapX = (m) => 40 + (m / maxMonths) * 440
  const mapY = (b) => Math.min(Math.max(160 - (b / initialBal) * 150, 10), 160)

  const pathMin = pointsMin.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.month)} ${mapY(p.balance)}`).join(' ')
  const pathExtra = pointsExtra.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.month)} ${mapY(p.balance)}`).join(' ')

  return {
    pathMin,
    pathExtra,
    initialBal,
    maxMonths
  }
})

// Calculator states
const calcPrincipal = ref(100000)
const calcApr = ref(7.5)
const calcMonths = ref(24)

// AI Analysis states
const aiAnalysisResult = ref('')
const isAiLoading = ref(false)

const totalDebtBalance = computed(() => debtsStore.totalBalance)
const totalOriginalDebt = computed(() => debtsStore.totalOriginalAmount)

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
}

const percentPaid = (debt) => {
  const orig = debt.originalAmount ?? debt.balance ?? 1
  const paid = Math.max(orig - debt.balance, 0)
  return Math.round((paid / orig) * 100)
}

function openAddModal() {
  name.value = ''
  originalAmount.value = ''
  balance.value = ''
  apr.value = ''
  minimumPayment.value = ''
  dueDay.value = '15'
  showAddModal.value = true
}

function handleSaveDebt() {
  if (!name.value || !originalAmount.value) return

  debtsStore.addDebt({
    name: name.value,
    originalAmount: originalAmount.value,
    balance: balance.value || originalAmount.value,
    apr: apr.value,
    minimumPayment: minimumPayment.value,
    dueDay: dueDay.value
  })

  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore - 2, 0), 100)
  showAddModal.value = false
}

function openEditModal(debt) {
  selectedDebtForEdit.value = debt
  name.value = debt.name
  originalAmount.value = debt.originalAmount
  balance.value = debt.balance
  apr.value = debt.apr
  minimumPayment.value = debt.minimumPayment
  dueDay.value = debt.dueDay
  showEditModal.value = true
}

function handleUpdateDebt() {
  if (!name.value || !originalAmount.value) return

  debtsStore.updateDebt(selectedDebtForEdit.value.id, {
    name: name.value,
    originalAmount: originalAmount.value,
    balance: balance.value,
    apr: apr.value,
    minimumPayment: minimumPayment.value,
    dueDay: dueDay.value
  })

  showEditModal.value = false
}

function openPayModal(debt) {
  selectedDebt.value = debt
  paymentAmount.value = debt.minimumPayment
  showPayModal.value = true
}

function handleLogPayment() {
  if (!paymentAmount.value || paymentAmount.value <= 0) return

  debtsStore.recordPayment(selectedDebt.value.id, paymentAmount.value)
  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore + 3, 0), 100)
  showPayModal.value = false
}

async function handleDeleteDebt(id) {
  const ok = await confirmDialog('คุณต้องการลบข้อมูลหนี้สินนี้ใช่หรือไม่?', { variant: 'danger' })
  if (ok) {
    debtsStore.deleteDebt(id)
  }
}

// 1. Debt Simulation Strategy Computations
const simulationResults = computed(() => {
  const list = targetDebts.value
  if (list.length === 0) return null
  
  let totalMinMonths = 0
  let totalMinInterestPaid = 0
  let totalExtraMonths = 0
  let totalExtraInterestPaid = 0
  let neverEndingMin = false
  
  list.forEach(d => {
    // A. Minimum Payment Strategy
    let balMin = d.balance
    const minPay = d.minimumPayment
    const monthlyRate = (d.apr / 100) / 12
    let minMonthsCount = 0
    let minInterestCount = 0
    
    if (minPay <= balMin * monthlyRate) {
      neverEndingMin = true
    } else {
      let loopCount = 0
      while (balMin > 0 && loopCount < 360) {
        loopCount++
        const interest = balMin * monthlyRate
        minInterestCount += interest
        balMin = balMin + interest - minPay
        if (balMin < 0) balMin = 0
        minMonthsCount++
      }
      totalMinMonths += minMonthsCount
      totalMinInterestPaid += minInterestCount
    }
    
    // B. Custom Extra Payment Strategy
    let balExtra = d.balance
    const extraPay = minPay + parseFloat(extraMonthlyPayback.value || 0)
    let extraMonthsCount = 0
    let extraInterestCount = 0
    
    let loopCount2 = 0
    while (balExtra > 0 && loopCount2 < 360) {
      loopCount2++
      const interest = balExtra * monthlyRate
      extraInterestCount += interest
      balExtra = balExtra + interest - extraPay
      if (balExtra < 0) balExtra = 0
      extraMonthsCount++
    }
    totalExtraMonths = Math.max(totalExtraMonths, extraMonthsCount)
    totalExtraInterestPaid += extraInterestCount
  })
  
  const interestSaved = neverEndingMin ? 'มหาศาล' : (totalMinInterestPaid - totalExtraInterestPaid)
  const timeSaved = neverEndingMin ? 'ไม่สิ้นสุด' : `${Math.max(totalMinMonths - totalExtraMonths, 0)} เดือน`
  
  return {
    minMonths: neverEndingMin ? 'ไม่สิ้นสุด (หนี้จะบาน)' : `${totalMinMonths} เดือน`,
    minInterest: totalMinInterestPaid,
    extraMonths: `${totalExtraMonths} เดือน`,
    extraInterest: totalExtraInterestPaid,
    timeSaved,
    interestSaved,
    neverEndingMin
  }
})

// 2. Calculator Computations (PMT formula)
const calculatorResults = computed(() => {
  const p = parseFloat(calcPrincipal.value || 0)
  const r = parseFloat(calcApr.value || 0) / 100 / 12
  const n = parseInt(calcMonths.value || 1)
  
  if (p <= 0) return { pmt: 0, totalPayment: 0, totalInterest: 0 }
  if (r === 0) {
    return {
      pmt: p / n,
      totalPayment: p,
      totalInterest: 0
    }
  }
  
  const rateFactor = Math.pow(1 + r, n)
  const pmt = p * r * rateFactor / (rateFactor - 1)
  const totalPayment = pmt * n
  const totalInterest = totalPayment - p

  return {
    pmt,
    totalPayment,
    totalInterest
  }
})

// 3. AI Debt Strategy Planner Call
async function triggerAiAnalysis() {
  if (debts.value.length === 0) {
    await alertDialog('กรุณาเพิ่มบัญชีหนี้สินก่อนรับแผนวิเคราะห์')
    return
  }

  isAiLoading.value = true
  aiAnalysisResult.value = ''

  const debtDescription = debts.value.map(d => `- ${d.name}: ยอดคงค้าง ${d.balance} บาท, ดอกเบี้ย APR ${d.apr}%, จ่ายขั้นต่ำ ${d.minimumPayment} บาท/เดือน`).join('\n')

  const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านกลยุทธ์การชำระหนี้ (Personal Debt Planner) ประจำแอปพลิเคชัน MoneyCircle
จงวิเคราะห์สถานะหนี้สินของผู้ใช้ และเสนอแนวทางปลดหนี้ที่ดีที่สุดอย่างกระชับ เข้าใจง่าย โดยเปรียบเทียบกลยุทธ์:
1. Debt Avalanche (จ่ายดอกเบี้ยสูงก่อน)
2. Debt Snowball (เคลียร์หนี้ยอดเล็กก่อน)
และเสนอแนวทางลดรายจ่ายเพื่อหาเงินโปะเพิ่มเติม ตกแต่งข้อความโดยใช้ Markdown หัวข้อสวยงาม`

  const userPrompt = `นี่คือรายการหนี้สินของฉัน:\n${debtDescription}\n\nโปรดเสนอแผนชำระหนี้ที่ดีที่สุดให้ฉันหน่อยครับ`

  try {
    const openai = createOpenAIClient()

    const response = await openai.chat.completions.create(withLlmNoThinking({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }))

    aiAnalysisResult.value = response.choices[0].message.content
    isAiLoading.value = false
  } catch (err) {
    console.error(err)
    aiAnalysisResult.value = `[เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ AI: ${err.message}]\n\nแนะให้ดำเนินการจ่ายโปะหนี้อัตราดอกเบี้ย APR 18% (สินเชื่อส่วนบุคคล B) ก่อนเพื่อจำกัดดอกเบี้ยทับถมที่สูงที่สุดในระบบครับ`
    isAiLoading.value = false
  }
}
</script>

<template>
  <div class="page-shell">
    
    <PageBanner
      title="วิเคราะห์หนี้สิน"
      lead="เปรียบเทียบกลยุทธ์จำลอง คอนฟิกโปะหนี้ และวิเคราะห์แผนด้วย AI"
    >
      <template #icon>
        <Wallet class="w-5 h-5" />
      </template>
      <template #actions>
        <button
          @click="openAddModal"
          class="btn-primary gap-1 px-4 py-2 min-h-0 text-xs cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>เพิ่มหนี้</span>
        </button>
      </template>
    </PageBanner>

    <!-- Quick Tab Selectors -->
    <div class="tab-switch">
      <button 
        @click="currentSection = 'list'"
        class="tab-switch-btn text-xs font-semibold py-1.5"
        :class="currentSection === 'list' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        บัญชีหนี้สิน
      </button>
      <button 
        @click="currentSection = 'simulator'"
        class="tab-switch-btn text-xs font-semibold py-1.5"
        :class="currentSection === 'simulator' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        จำลองการโปะหนี้
      </button>
      <button 
        @click="currentSection = 'calculator'"
        class="tab-switch-btn text-xs font-semibold py-1.5"
        :class="currentSection === 'calculator' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        คำนวณเงินกู้
      </button>
      <button 
        @click="currentSection = 'ai'"
        class="tab-switch-btn text-xs font-semibold py-1.5"
        :class="currentSection === 'ai' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        วิเคราะห์ด้วย AI
      </button>
    </div>

    <!-- SECTION 1: DEBT LIST TAB -->
    <div v-if="currentSection === 'list'" class="space-y-4">
      
      <!-- Summary metrics widget -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Remaining Owed -->
        <div class="surface-card p-4 flex items-center gap-3 bg-surface-card border border-border-subtle">
          <div class="w-10 h-10 rounded-full bg-red-50 text-tier-risk flex items-center justify-center shrink-0">
            <Wallet class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-caption text-ink-muted leading-none">ยอดหนี้คงเหลือปัจจุบัน</span>
            <span class="text-lg font-brand font-black text-ink mt-1.5 leading-none">
              {{ formatCurrency(totalDebtBalance) }}
            </span>
          </div>
        </div>

        <!-- Total Original Debt borrowed -->
        <div class="surface-card p-4 flex items-center gap-3 bg-surface-card border border-border-subtle">
          <div class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 text-ink-muted flex items-center justify-center shrink-0">
            <DollarSign class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-caption text-ink-muted leading-none">ยอดหนี้ตั้งต้นทั้งหมด</span>
            <span class="text-lg font-brand font-black text-ink mt-1.5 leading-none">
              {{ formatCurrency(totalOriginalDebt) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Debts List -->
      <div class="space-y-3">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">บัญชีหนี้สินของคุณ</h3>

        <div v-if="debts.length === 0" class="surface-card p-8 text-center text-ink-muted text-xs">
          ไม่มีข้อมูลบัญชีหนี้สินในระบบ กดปุ่ม "เพิ่มหนี้" ด้านบนเพื่อเริ่มบันทึก
        </div>

        <div 
          v-for="d in debts" 
          :key="d.id"
          class="surface-card p-4 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition relative group bg-surface-card border border-border-subtle"
        >
          <!-- Card Header details -->
          <div class="flex items-start justify-between">
            <div class="flex flex-col flex-1">
              <span class="text-sm font-bold text-ink leading-tight">{{ d.name }}</span>
              <span class="text-caption text-ink-muted mt-1 leading-none">
                อัตราดอกเบี้ย APR {{ d.apr }}% · จ่ายขั้นต่ำ {{ formatCurrency(d.minimumPayment) }}
              </span>
            </div>

            <!-- Edit and Delete actions -->
            <div class="flex items-center gap-1.5">
              <button 
                @click="openEditModal(d)"
                class="p-1.5 text-ink-muted hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition"
              >
                <Edit class="w-4 h-4" />
              </button>
              <button 
                @click="handleDeleteDebt(d.id)"
                class="p-1.5 text-ink-muted hover:text-tier-risk hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Progress bar visualization -->
          <div class="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
            <div class="flex justify-between text-micro text-ink-muted leading-none">
              <span>ชำระไปแล้ว {{ percentPaid(d) }}%</span>
              <span>คงค้าง {{ formatCurrency(d.balance) }} / ตั้งต้น {{ formatCurrency(d.originalAmount ?? d.balance) }}</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                class="bg-accent-emerald h-full rounded-full transition-all duration-500" 
                :style="{ width: `${percentPaid(d)}%` }"
              ></div>
            </div>
          </div>

          <!-- Bottom detailed layout fields -->
          <div class="grid grid-cols-2 gap-4 pt-1 text-xs">
            <div class="flex flex-col">
              <span class="text-caption text-ink-muted leading-none">วันผ่อนชำระ</span>
              <span class="text-sm font-bold text-ink mt-1.5">ทุกวันที่ {{ d.dueDay }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-caption text-ink-muted leading-none">สถานะส่งตรงเวลา</span>
              <span class="text-xs font-bold text-ink mt-1.5">
                <span class="chip bg-orange-50 text-streak-flame border-orange-100 text-micro font-bold px-1.5 py-0.5 rounded">
                  ตรงเวลา {{ d.onTimeStreak }} งวด
                </span>
              </span>
            </div>
          </div>

          <!-- Pay action trigger -->
          <button 
            @click="openPayModal(d)"
            class="btn-secondary w-full justify-center text-xs py-1.5 min-h-9 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5" />
            <span>บันทึกการชำระเงินงวดนี้</span>
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION 2: EXTRA PAYBACK SIMULATOR TAB -->
    <div v-else-if="currentSection === 'simulator'" class="space-y-4">
      <div class="surface-card space-y-4">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
          <Sliders class="w-4 h-4 text-primary" />
          <span>จำลองแผนการโปะหนี้รายเดือน (Extra Payback)</span>
        </h3>
        
        <p class="text-xs text-ink-muted leading-relaxed">
          จำลองการหักยอดเงินพิเศษเพิ่มเติมจากยอดจ่ายขั้นต่ำในแต่ละเดือน เพื่อเปรียบเทียบระยะเวลาชำระคืนและดอกเบี้ยสะสมที่จะประหยัดได้
        </p>

        <!-- Select debt for simulation -->
        <div class="space-y-1.5 border-b border-border-subtle pb-3">
          <label class="field-label font-bold text-ink text-label">เลือกบัญชีหนี้สินเพื่อจำลอง</label>
          <select 
            v-model="selectedDebtForSim"
            class="input-field bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-xs py-1.5 min-h-9 cursor-pointer"
          >
            <option value="all">ทุกบัญชีรวมกัน (All Debts)</option>
            <option 
              v-for="d in debts" 
              :key="d.id" 
              :value="d.id"
            >
              {{ d.name }} (คงเหลือ: {{ formatCurrency(d.balance) }})
            </option>
          </select>
        </div>

        <!-- Show baseline vs total sim payback sum -->
        <div class="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 text-xs">
          <div>
            <span class="text-ink-muted text-caption block leading-none">ยอดผ่อนปกติ (ขั้นต่ำ)</span>
            <span class="font-bold text-ink text-[13px] mt-1 block">{{ formatCurrency(targetMinPaybackSum) }} / เดือน</span>
          </div>
          <div>
            <span class="text-ink-muted text-caption block leading-none">ยอดชำระจำลอง (ขั้นต่ำ + โปะ)</span>
            <span class="font-bold text-accent-emerald text-[13px] mt-1 block">{{ formatCurrency(targetTotalSimPaybackSum) }} / เดือน</span>
          </div>
        </div>

        <!-- Slider Range control -->
        <div class="space-y-2 pt-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-ink">เงินโปะเพิ่มต่อเดือน (Extra Pay):</span>
            <span class="text-base font-black text-accent-emerald">{{ formatCurrency(extraMonthlyPayback) }}</span>
          </div>
          <input 
            v-model="extraMonthlyPayback"
            type="range"
            min="0"
            max="15000"
            step="500"
            class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      </div>

      <!-- Comparison Metrics Cards and Graphs grid wrapper -->
      <div v-if="simulationResults" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Strategy A: Minimum Payment -->
        <div class="surface-card p-4 space-y-3 bg-surface-card border border-slate-100">
          <div class="flex items-center justify-between border-b border-border-subtle pb-2">
            <span class="text-xs font-bold text-ink">แผน A: จ่ายเฉพาะขั้นต่ำ</span>
            <span class="chip bg-slate-100 text-ink-muted text-nano font-black">มาตรฐาน</span>
          </div>
          <div class="space-y-2 text-xs leading-none">
            <div class="flex justify-between">
              <span class="text-ink-muted">ระยะเวลาปลดหนี้ทั้งหมด:</span>
              <span class="font-bold text-ink" :class="simulationResults.neverEndingMin ? 'text-tier-risk' : ''">
                {{ simulationResults.minMonths }}
              </span>
            </div>
            <div class="flex justify-between" v-if="!simulationResults.neverEndingMin">
              <span class="text-ink-muted">รวมดอกเบี้ยจ่ายทั้งหมด:</span>
              <span class="font-bold text-tier-risk">{{ formatCurrency(simulationResults.minInterest) }}</span>
            </div>
          </div>
        </div>

        <!-- Strategy B: Minimum + Extra Pay -->
        <div class="surface-card p-4 space-y-3 bg-surface-card border border-accent-emerald/20 bg-emerald-50/5">
          <div class="flex items-center justify-between border-b border-border-subtle pb-2">
            <span class="text-xs font-bold text-accent-emerald">แผน B: จ่ายขั้นต่ำ + โปะพิเศษ</span>
            <span class="chip bg-emerald-50 text-accent-emerald border-emerald-100 text-nano font-black">ประหยัดสูงสุด</span>
          </div>
          <div class="space-y-2 text-xs leading-none">
            <div class="flex justify-between">
              <span class="text-ink-muted">ระยะเวลาปลดหนี้ทั้งหมด:</span>
              <span class="font-bold text-accent-emerald">{{ simulationResults.extraMonths }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-muted">รวมดอกเบี้ยจ่ายทั้งหมด:</span>
              <span class="font-bold text-accent-emerald">{{ formatCurrency(simulationResults.extraInterest) }}</span>
            </div>
          </div>
        </div>

        <!-- Linear Trend Graph Card -->
        <div v-if="graphData" class="surface-card col-span-1 md:col-span-2 p-4 space-y-4 bg-surface-card border border-slate-100">
          <h4 class="text-xs font-bold text-ink flex items-center gap-1.5 border-b border-border-subtle pb-2">
            <Sliders class="w-4 h-4 text-primary" />
            <span>กราฟวิเคราะห์แนวโน้มการชำระหนี้สะสม (Payoff Trend Line Chart)</span>
          </h4>

          <div class="space-y-3">
            <div class="flex justify-between items-center text-caption text-ink-muted px-1">
              <span>แกน Y: ยอดหนี้คงค้างสะสม (บาท)</span>
              <span>แกน X: ระยะเวลาการจำลอง (36 เดือน)</span>
            </div>

            <!-- SVG Line Graph box -->
            <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50 p-3 rounded-2xl">
              <svg viewBox="0 0 500 180" class="w-full h-auto overflow-visible select-none">
                <!-- Horizontal Grid Lines -->
                <line x1="40" y1="10" x2="480" y2="10" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2" />
                <line x1="40" y1="85" x2="480" y2="85" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2" />
                <line x1="40" y1="160" x2="480" y2="160" stroke="#cbd5e1" stroke-width="1.5" />

                <!-- Vertical Grid lines (Axes) -->
                <line x1="40" y1="10" x2="40" y2="160" stroke="#cbd5e1" stroke-width="1.5" />
                <line x1="480" y1="10" x2="480" y2="160" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2" />

                <!-- Paths representing line trends -->
                <!-- Plan A: Minimum Only (Grey dashed path) -->
                <path :d="graphData.pathMin" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="4,4" class="transition-all duration-500" />
                
                <!-- Plan B: Extra Pay (Solid Emerald path) -->
                <path :d="graphData.pathExtra" fill="none" stroke="#10b981" stroke-width="3.5" class="transition-all duration-500" />

                <!-- X Axis Text ticks -->
                <text x="40" y="175" class="text-micro fill-slate-400 font-bold" text-anchor="middle">เดือน 0</text>
                <text x="186.6" y="175" class="text-micro fill-slate-400 font-bold" text-anchor="middle">เดือน 12</text>
                <text x="333.3" y="175" class="text-micro fill-slate-400 font-bold" text-anchor="middle">เดือน 24</text>
                <text x="480" y="175" class="text-micro fill-slate-400 font-bold" text-anchor="middle">เดือน 36</text>

                <!-- Y Axis Text ticks -->
                <text x="32" y="14" class="text-nano fill-slate-400 font-bold" text-anchor="end">{{ formatCurrency(graphData.initialBal) }}</text>
                <text x="32" y="89" class="text-nano fill-slate-400 font-bold" text-anchor="end">{{ formatCurrency(graphData.initialBal / 2) }}</text>
                <text x="32" y="164" class="text-nano fill-slate-400 font-bold" text-anchor="end">฿0</text>
              </svg>
            </div>

            <!-- Custom Legend Markers -->
            <div class="flex gap-4 items-center justify-center text-caption pt-1">
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-0.5 border-t-2 border-dashed border-slate-400"></span>
                <span class="text-ink-muted">แผน A: ผ่อนขั้นต่ำปกติ ({{ simulationResults.minMonths }})</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-4 h-0.5 bg-accent-emerald"></span>
                <span class="font-bold text-accent-emerald">แผน B: จ่ายขั้นต่ำ + โปะพิเศษ ({{ simulationResults.extraMonths }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Time and Interest Savings Highlight Alert Card -->
        <div class="surface-card col-span-1 md:col-span-2 bg-duo-green-light/30 border-2 border-primary/20 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles class="w-5 h-5 fill-primary" />
          </div>
          <div class="flex-1 space-y-1">
            <h4 class="text-xs font-bold text-ink">คุณประหยัดเงินและเวลาได้มหาศาล!</h4>
            <p class="text-caption text-ink-muted leading-relaxed">
              การโปะเงินเพิ่มเดือนละ {{ formatCurrency(extraMonthlyPayback) }} จะช่วยคุณลดระยะเวลาปลดหนี้ลงได้ถึง <span class="font-bold text-accent-emerald">{{ simulationResults.timeSaved }}</span> และลดรายจ่ายดอกเบี้ยสะสมลงไปได้กว่า <span class="font-bold text-accent-emerald">{{ typeof simulationResults.interestSaved === 'string' ? simulationResults.interestSaved : formatCurrency(simulationResults.interestSaved) }}</span>!
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 3: LOAN CALCULATOR TAB -->
    <div v-else-if="currentSection === 'calculator'" class="space-y-4">
      <div class="surface-card space-y-4">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
          <Calculator class="w-4 h-4 text-primary" />
          <span>เครื่องคำนวณอัตราดอกเบี้ยและยอดผ่อนเงินกู้ (Loan Calculator)</span>
        </h3>

        <!-- Form fields for loan calculator -->
        <div class="space-y-3">
          <div class="space-y-1">
            <label class="field-label font-bold text-ink text-label">เงินต้นเงินกู้ (Principal Amount)</label>
            <input 
              v-model="calcPrincipal" 
              type="number" 
              class="input-field bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 py-2 min-h-10 text-xs" 
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="field-label font-bold text-ink text-label">อัตราดอกเบี้ยปี APR (%)</label>
              <input 
                v-model="calcApr" 
                type="number" 
                class="input-field bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 py-2 min-h-10 text-xs" 
              />
            </div>
            <div class="space-y-1">
              <label class="field-label font-bold text-ink text-label">ระยะเวลาผ่อนชำระ (เดือน)</label>
              <input 
                v-model="calcMonths" 
                type="number" 
                class="input-field bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 py-2 min-h-10 text-xs" 
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Calculator Results Box -->
      <div class="grid grid-cols-3 gap-2.5">
        <!-- Monthly payment card -->
        <div class="surface-card-sm flex flex-col justify-between p-3.5 border border-border-subtle bg-surface-card">
          <span class="text-micro font-bold text-ink-muted uppercase">ยอดผ่อนต่อเดือน</span>
          <span class="stat-value text-accent-emerald text-sm font-black mt-3 truncate">
            {{ formatCurrency(calculatorResults.pmt) }}
          </span>
        </div>

        <!-- Total interest paid card -->
        <div class="surface-card-sm flex flex-col justify-between p-3.5 border border-border-subtle bg-surface-card">
          <span class="text-micro font-bold text-ink-muted uppercase">ดอกเบี้ยจ่ายรวม</span>
          <span class="stat-value text-tier-risk text-sm font-black mt-3 truncate">
            {{ formatCurrency(calculatorResults.totalInterest) }}
          </span>
        </div>

        <!-- Total payment card -->
        <div class="surface-card-sm flex flex-col justify-between p-3.5 border border-border-subtle bg-surface-card">
          <span class="text-micro font-bold text-ink-muted uppercase">ยอดจ่ายคืนรวม</span>
          <span class="stat-value text-ink text-sm font-black mt-3 truncate">
            {{ formatCurrency(calculatorResults.totalPayment) }}
          </span>
        </div>
      </div>
    </div>

    <!-- SECTION 4: AI STRATEGY ANALYSIS TAB -->
    <div v-else-if="currentSection === 'ai'" class="space-y-4">
      <div class="surface-card space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Sparkles class="w-5 h-5 fill-amber-500" />
          </div>
          <div class="flex-1 space-y-1">
            <h3 class="text-xs font-bold text-ink">วิเคราะห์แนวทางและกลยุทธ์การชำระหนี้ด้วย AI</h3>
            <p class="text-caption text-ink-muted leading-relaxed">
              AI จะนำข้อมูลยอดหนี้ APR ดอกเบี้ย และรายจ่ายงบประมาณจริงของคุณมาทำการวิเคราะห์ เพื่อสรุปลำดับการชำระชะลอหนี้ให้ประหยัดที่สุด
            </p>
          </div>
        </div>

        <!-- Action Button trigger -->
        <button 
          @click="triggerAiAnalysis"
          :disabled="isAiLoading"
          class="btn-primary w-full justify-center text-xs py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw v-if="isAiLoading" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4 fill-white" />
          <span>{{ isAiLoading ? 'กำลังสร้างแผนปลดหนี้ส่วนตัว...' : 'ให้ AI วิเคราะห์แผนปลดหนี้ตอนนี้' }}</span>
        </button>
      </div>

      <!-- AI Response Markdown panel -->
      <div
        v-if="aiAnalysisResult"
        class="surface-card p-5 bg-surface-card border border-border-subtle"
      >
        <ChatMessageMarkdown :content="aiAnalysisResult" />
      </div>
    </div>

    <!-- Add Debt Modal Markup -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-sm bg-surface-card rounded-xl p-6 border-2 border-border-subtle space-y-4 relative">
        <button 
          @click="showAddModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-base font-bold text-ink">เพิ่มบัญชีหนี้สิน</h3>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ชื่อบัญชี / รายการหนี้</label>
            <input 
              v-model="name"
              type="text" 
              placeholder="เช่น บัตรเครดิตธนาคาร..." 
              class="input-field"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ยอดหนี้ตั้งต้น (Original Limit)</label>
              <input 
                v-model="originalAmount"
                type="number" 
                placeholder="เช่น 50000" 
                class="input-field"
              />
            </div>
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ยอดคงค้างปัจจุบัน (Balance)</label>
              <input 
                v-model="balance"
                type="number" 
                placeholder="เช่น 35000" 
                class="input-field"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ดอกเบี้ยปี APR (%)</label>
              <input 
                v-model="apr"
                type="number" 
                placeholder="16" 
                class="input-field"
              />
            </div>
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">วันจ่ายของเดือน</label>
              <select 
                v-model="dueDay"
                class="input-field text-xs py-1"
              >
                <option v-for="d in 28" :key="d" :value="d">วันที่ {{ d }}</option>
              </select>
            </div>
          </div>

          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ยอดจ่ายขั้นต่ำต่อเดือน (THB)</label>
            <input 
              v-model="minimumPayment"
              type="number" 
              placeholder="ประเมิน 5% อัตโนมัติ..." 
              class="input-field"
            />
          </div>
        </div>

        <button 
          @click="handleSaveDebt"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          เพิ่มรายการหนี้สิน
        </button>
      </div>
    </div>

    <!-- Edit Debt Modal Markup -->
    <div 
      v-if="showEditModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-sm bg-surface-card rounded-xl p-6 border-2 border-border-subtle space-y-4 relative">
        <button 
          @click="showEditModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-base font-bold text-ink">แก้ไขบัญชีหนี้สิน</h3>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ชื่อบัญชี / รายการหนี้</label>
            <input 
              v-model="name"
              type="text" 
              class="input-field"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ยอดหนี้ตั้งต้น (Original Limit)</label>
              <input 
                v-model="originalAmount"
                type="number" 
                class="input-field"
              />
            </div>
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ยอดคงค้างปัจจุบัน (Balance)</label>
              <input 
                v-model="balance"
                type="number" 
                class="input-field"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">ดอกเบี้ยปี APR (%)</label>
              <input 
                v-model="apr"
                type="number" 
                class="input-field"
              />
            </div>
            <div class="space-y-1">
              <label class="field-label font-bold text-ink">วันจ่ายของเดือน</label>
              <select 
                v-model="dueDay"
                class="input-field text-xs py-1"
              >
                <option v-for="d in 28" :key="d" :value="d">วันที่ {{ d }}</option>
              </select>
            </div>
          </div>

          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ยอดจ่ายขั้นต่ำต่อเดือน (THB)</label>
            <input 
              v-model="minimumPayment"
              type="number" 
              class="input-field"
            />
          </div>
        </div>

        <button 
          @click="handleUpdateDebt"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          บันทึกการแก้ไข
        </button>
      </div>
    </div>

    <!-- Pay Debt Modal Markup -->
    <div 
      v-if="showPayModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-xs bg-surface-card rounded-xl p-6 border-2 border-border-subtle space-y-4 relative">
        <button 
          @click="showPayModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-sm font-bold text-ink leading-tight">
          ชำระเงิน: {{ selectedDebt?.name }}
        </h3>

        <div class="space-y-1">
          <label class="field-label font-bold text-ink">จำนวนเงินที่ชำระ (THB)</label>
          <input 
            v-model="paymentAmount"
            type="number" 
            class="input-field"
          />
        </div>

        <button 
          @click="handleLogPayment"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          ยืนยันการชำระเงิน
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
