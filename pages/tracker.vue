<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useTransactionsStore, useScoreStore, useUsageStore } from '#imports'
import { 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  X, 
  Calendar as CalendarIcon, 
  Edit3,
  Coins,
  ChevronLeft,
  ChevronRight,
  Camera,
  Sparkles,
  RefreshCw,
  CheckCircle,
  ShieldAlert
} from 'lucide-vue-next'

const router = useRouter()
const txStore = useTransactionsStore()
const scoreStore = useScoreStore()
const usageStore = useUsageStore()

// Calendar navigation states
const today = new Date()
const currentMonth = ref(today.getMonth()) // 0-11
const currentYear = ref(today.getFullYear())
const selectedDate = ref(null) // selected yyyy-mm-dd for Daily Transactions Modal

// Modal visibility states
const showDailyModal = ref(false) // Daily transactions list modal
const showAddModal = ref(false) // Manual Add/Edit Form modal
const isEditing = ref(false)
const currentTxId = ref(null)

// Manual Form fields
const type = ref('expense')
const amount = ref('')
const category = ref('Food')
const note = ref('')
const date = ref(new Date().toISOString().split('T')[0])

// OCR Scan Modal states
const showScanModal = ref(false)
const showUpgradeModal = ref(false)
const fileInput = ref(null)
const previewImage = ref(null)
const isOcrLoading = ref(false)
const showOcrResultForm = ref(false)

// OCR Extracted fields
const ocrAmount = ref('')
const ocrCategory = ref('Food')
const ocrDate = ref('')
const ocrNote = ref('')

const isPremium = computed(() => usageStore.tier === 'premium')

const categories = [
  'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
  'Health', 'Education', 'Debt Payment', 'Savings', 'Income', 'Other'
]

// Calendar month labels (Thai)
const monthLabels = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]
const daysOfWeekLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// Helper to switch months
function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// Generate the 42-day calendar grid
const calendarGrid = computed(() => {
  const firstDayOfMonth = new Date(currentYear.value, currentMonth.value, 1)
  const lastDayOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startDayOfWeek = firstDayOfMonth.getDay()
  const cells = []
  
  // Previous month padding
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i
    const prevYear = currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value
    const prevMonthNum = currentMonth.value === 0 ? 11 : currentMonth.value - 1
    const mStr = String(prevMonthNum + 1).padStart(2, '0')
    const dStr = String(dayNum).padStart(2, '0')
    cells.push({
      dayNumber: dayNum,
      dateString: `${prevYear}-${mStr}-${dStr}`,
      isCurrentMonth: false
    })
  }
  
  // Current month
  const totalDays = lastDayOfMonth.getDate()
  for (let d = 1; d <= totalDays; d++) {
    const mStr = String(currentMonth.value + 1).padStart(2, '0')
    const dStr = String(d).padStart(2, '0')
    cells.push({
      dayNumber: d,
      dateString: `${currentYear.value}-${mStr}-${dStr}`,
      isCurrentMonth: true
    })
  }
  
  // Next month padding
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const nextYear = currentMonth.value === 11 ? currentYear.value + 1 : currentYear.value
    const nextMonthNum = currentMonth.value === 11 ? 0 : currentMonth.value + 1
    const mStr = String(nextMonthNum + 1).padStart(2, '0')
    const dStr = String(d).padStart(2, '0')
    cells.push({
      dayNumber: d,
      dateString: `${nextYear}-${mStr}-${dStr}`,
      isCurrentMonth: false
    })
  }
  return cells
})

// Map transactions to daily sums
const dailySummaries = computed(() => {
  const summaries = {}
  txStore.items.forEach(tx => {
    const txDate = tx.date
    if (!summaries[txDate]) {
      summaries[txDate] = { income: 0, expense: 0 }
    }
    if (tx.type === 'income') {
      summaries[txDate].income += tx.amount
    } else {
      summaries[txDate].expense += tx.amount
    }
  })
  return summaries
})

// Month boundaries
const monthStartDate = computed(() => {
  const mStr = String(currentMonth.value + 1).padStart(2, '0')
  return `${currentYear.value}-${mStr}-01`
})

const monthEndDate = computed(() => {
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  const mStr = String(currentMonth.value + 1).padStart(2, '0')
  return `${currentYear.value}-${mStr}-${lastDay}`
})

// Current month transactions (for summary metrics and bottom general list)
const monthTransactions = computed(() => {
  return txStore.items.filter(tx => {
    return tx.date >= monthStartDate.value && tx.date <= monthEndDate.value
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Selected day transactions (for Daily Transactions Modal)
const dailyTransactions = computed(() => {
  if (!selectedDate.value) return []
  return txStore.items.filter(tx => tx.date === selectedDate.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Monthly totals
const totalIncomeInMonth = computed(() => {
  return monthTransactions.value
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
})

const totalExpenseInMonth = computed(() => {
  return monthTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
})

const netBalanceInMonth = computed(() => {
  return totalIncomeInMonth.value - totalExpenseInMonth.value
})

// Helpers
const formatCategoryThai = (cat) => {
  const mapping = {
    'Food': 'อาหาร',
    'Transport': 'การเดินทาง',
    'Housing': 'ที่อยู่อาศัย',
    'Utilities': 'สาธารณูปโภค',
    'Entertainment': 'ความบันเทิง',
    'Health': 'สุขภาพ',
    'Education': 'การศึกษา',
    'Debt Payment': 'ชำระหนี้',
    'Savings': 'เงินออม',
    'Income': 'รายได้',
    'Other': 'อื่นๆ'
  }
  return mapping[cat] || cat
}

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
}

function handleDayClick(cell) {
  selectedDate.value = cell.dateString
  showDailyModal.value = true
}

// Manual Form helpers
function openAddModal() {
  isEditing.value = false
  currentTxId.value = null
  type.value = 'expense'
  amount.value = ''
  category.value = 'Food'
  note.value = ''
  date.value = new Date().toISOString().split('T')[0]
  showAddModal.value = true
}

function openAddModalForSelectedDay() {
  isEditing.value = false
  currentTxId.value = null
  type.value = 'expense'
  amount.value = ''
  category.value = 'Food'
  note.value = ''
  date.value = selectedDate.value // prefill!
  showAddModal.value = true
}

function openEditModal(tx) {
  isEditing.value = true
  currentTxId.value = tx.id
  type.value = tx.type
  amount.value = tx.amount
  category.value = tx.category
  note.value = tx.note || ''
  date.value = tx.date
  showAddModal.value = true
}

function handleSave() {
  if (!amount.value || amount.value <= 0) return

  const payload = {
    type: type.value,
    amount: parseFloat(amount.value),
    category: category.value,
    note: note.value,
    date: date.value
  }

  if (isEditing.value) {
    txStore.updateTransaction(currentTxId.value, payload)
  } else {
    txStore.createTransaction(payload)
  }

  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore + (type.value === 'income' ? 2 : -1), 0), 100)
  showAddModal.value = false
}

function handleDelete(id) {
  if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
    txStore.deleteTransaction(id)
  }
}

// OCR Scan functions
function openScanModal() {
  if (usageStore.ocrUsedToday >= usageStore.ocrLimit && !isPremium.value) {
    showUpgradeModal.value = true
    return
  }
  previewImage.value = null
  showOcrResultForm.value = false
  isOcrLoading.value = false
  showScanModal.value = true
}

function triggerCamera() {
  fileInput.value.click()
}

function handleFileChange(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target.result
  }
  reader.readAsDataURL(file)

  runOcrMockAnalysis()
}

function runOcrMockAnalysis() {
  isOcrLoading.value = true
  showOcrResultForm.value = false

  setTimeout(() => {
    isOcrLoading.value = false
    usageStore.useOcrScan()

    // Populate mock OCR parameters
    ocrAmount.value = '149'
    ocrCategory.value = 'Food'
    ocrDate.value = selectedDate.value || new Date().toISOString().split('T')[0]
    ocrNote.value = 'สแกนใบเสร็จอัตโนมัติด้วย AI'
    showOcrResultForm.value = true
  }, 2200)
}

function handleConfirmOcr() {
  if (!ocrAmount.value || ocrAmount.value <= 0) return

  txStore.createTransaction({
    type: 'expense',
    amount: parseFloat(ocrAmount.value),
    category: ocrCategory.value,
    note: ocrNote.value,
    date: ocrDate.value,
    source: 'ocr'
  })

  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore - 1, 0), 100)
  showScanModal.value = false
}

function handleUpgrade() {
  usageStore.unlockPremium()
  showUpgradeModal.value = false
  openScanModal()
}
</script>

<template>
  <div class="page-shell">
    
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2">
      <div>
        <h1 class="page-title font-brand text-2xl">ตัวช่วยบันทึกเงิน (Money Tracker)</h1>
        <p class="page-lead">ประวัติการใช้จ่ายและสแกนใบเสร็จอัตโนมัติด้วยปฏิทินอัจฉริยะ</p>
      </div>
      
      <!-- Quick Action Buttons -->
      <div class="flex gap-2">
        <button 
          @click="openScanModal"
          class="btn-secondary gap-1.5 px-4 py-2 min-h-0 text-xs rounded-full border-accent-emerald text-accent-emerald hover:bg-emerald-50/50 cursor-pointer"
        >
          <Camera class="w-4 h-4" />
          <span>สแกนใบเสร็จ (AI OCR)</span>
        </button>
        <button 
          @click="openAddModal"
          class="btn-primary gap-1 px-4 py-2 min-h-0 text-xs rounded-full cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>จดบันทึก</span>
        </button>
      </div>
    </div>

    <!-- 1. Money Summary Panel (MOVED TO TOP OF CALENDAR) -->
    <div class="grid grid-cols-3 gap-2.5">
      <!-- Income card -->
      <div class="surface-card-sm flex flex-col justify-between p-3.5 border border-border-subtle bg-white">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-bold text-ink-muted uppercase">รายรับเดือนนี้</span>
          <div class="w-6 h-6 rounded-full bg-emerald-50 text-accent-emerald flex items-center justify-center">
            <ArrowUpRight class="w-3.5 h-3.5" />
          </div>
        </div>
        <span class="stat-value text-accent-emerald text-xs font-black mt-3 truncate">
          {{ formatCurrency(totalIncomeInMonth) }}
        </span>
      </div>

      <!-- Expense card -->
      <div class="surface-card-sm flex flex-col justify-between p-3.5 border border-border-subtle bg-white">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-bold text-ink-muted uppercase">รายจ่ายเดือนนี้</span>
          <div class="w-6 h-6 rounded-full bg-red-50 text-tier-risk flex items-center justify-center">
            <ArrowDownRight class="w-3.5 h-3.5" />
          </div>
        </div>
        <span class="stat-value text-tier-risk text-xs font-black mt-3 truncate">
          {{ formatCurrency(totalExpenseInMonth) }}
        </span>
      </div>

      <!-- Net Balance card -->
      <div 
        class="surface-card-sm flex flex-col justify-between p-3.5 border"
        :class="netBalanceInMonth >= 0 ? 'bg-emerald-50/10 border-emerald-100' : 'bg-red-50/10 border-red-100'"
      >
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-bold text-ink-muted uppercase">คงเหลือ</span>
          <div 
            class="w-6 h-6 rounded-full flex items-center justify-center"
            :class="netBalanceInMonth >= 0 ? 'bg-emerald-50 text-accent-emerald' : 'bg-red-50 text-tier-risk'"
          >
            <Coins class="w-3.5 h-3.5" />
          </div>
        </div>
        <span 
          class="stat-value text-xs font-black mt-3 truncate"
          :class="netBalanceInMonth >= 0 ? 'text-accent-emerald' : 'text-tier-risk'"
        >
          {{ formatCurrency(netBalanceInMonth) }}
        </span>
      </div>
    </div>

    <!-- 2. Interactive Monthly Calendar Widget -->
    <div class="surface-card p-4 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
          <CalendarIcon class="w-4 h-4 text-primary" />
          <span>ปฏิทินรายจ่าย</span>
        </span>
        
        <div class="flex items-center gap-2">
          <button 
            @click="prevMonth"
            class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-ink cursor-pointer"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-bold text-ink min-w-[90px] text-center select-none">
            {{ monthLabels[currentMonth] }} {{ currentYear }}
          </span>
          <button 
            @click="nextMonth"
            class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-ink cursor-pointer"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="space-y-1">
        <div class="grid grid-cols-7 text-center text-[10px] font-bold text-ink-muted py-1">
          <span v-for="w in daysOfWeekLabels" :key="w" :class="w === 'อา' ? 'text-red-500' : ''">{{ w }}</span>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <div 
            v-for="cell in calendarGrid" 
            :key="cell.dateString"
            @click="handleDayClick(cell)"
            class="aspect-square flex flex-col justify-between p-1 rounded-lg border text-center transition cursor-pointer select-none text-[11px] font-black relative"
            :class="[
              !cell.isCurrentMonth ? 'text-ink-muted/40 border-transparent bg-slate-50/20' : 'text-ink border-border-subtle bg-white hover:bg-slate-50',
              selectedDate === cell.dateString ? 'ring-2 ring-accent-emerald border-accent-emerald text-accent-emerald scale-[1.03]' : ''
            ]"
          >
            <span class="leading-none text-left select-none">{{ cell.dayNumber }}</span>

            <!-- Indicators for Income/Expenses -->
            <div class="flex flex-col items-center justify-end gap-0.5 mt-auto">
              <div 
                v-if="dailySummaries[cell.dateString]" 
                class="flex gap-0.5"
              >
                <div 
                  v-if="dailySummaries[cell.dateString].income > 0" 
                  class="w-1.5 h-1.5 rounded-full bg-accent-emerald"
                />
                <div 
                  v-if="dailySummaries[cell.dateString].expense > 0" 
                  class="w-1.5 h-1.5 rounded-full bg-tier-risk"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="text-[10px] text-ink-muted text-center pt-1 leading-none font-bold">
        <span>คลิกวันในปฏิทินด้านบนเพื่อเรียกดูและจดบันทึกรายวัน</span>
      </div>
    </div>

    <!-- Monthly History List -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">
          ธุรกรรมประจำเดือนนี้ ({{ monthTransactions.length }})
        </h3>
      </div>

      <div v-if="monthTransactions.length === 0" class="surface-card p-10 text-center text-ink-muted text-xs">
        ไม่มีรายการจดบันทึกในเดือนนี้
      </div>

      <div 
        v-for="tx in monthTransactions" 
        :key="tx.id"
        class="surface-card-sm flex items-center justify-between hover:bg-slate-50/50 transition relative group"
      >
        <div class="flex items-center gap-3">
          <div 
            class="icon-tile"
            :class="tx.type === 'income' ? 'icon-tile--income' : 'icon-tile--expense'"
          >
            <ArrowUpRight v-if="tx.type === 'income'" class="w-4 h-4" />
            <ArrowDownRight v-else class="w-4 h-4" />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-ink leading-tight">
              {{ formatCategoryThai(tx.category) }}
            </span>
            <span class="text-[10px] text-ink-muted mt-1 leading-none flex items-center gap-1 flex-wrap">
              <CalendarIcon class="w-3.5 h-3.5" />
              {{ tx.date }}
              <span v-if="tx.note" class="before:content-['·'] before:mx-1 truncate max-w-[120px]">{{ tx.note }}</span>
              <span v-if="tx.source === 'ocr'" class="chip bg-amber-50 text-amber-600 border-amber-100 text-[8px] font-black px-1.5 py-0.5 leading-none">AI OCR</span>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span 
            class="text-sm font-bold"
            :class="tx.type === 'income' ? 'text-accent-emerald' : 'text-ink'"
          >
            {{ tx.type === 'income' ? '+' : '-' }}{{ formatCurrency(tx.amount) }}
          </span>
          
          <div class="flex gap-1">
            <button 
              @click="openEditModal(tx)"
              class="p-1.5 text-ink-muted hover:text-primary rounded hover:bg-slate-100 cursor-pointer"
            >
              <Edit3 class="w-3.5 h-3.5" />
            </button>
            <button 
              @click="handleDelete(tx.id)"
              class="p-1.5 text-ink-muted hover:text-tier-risk rounded hover:bg-slate-100 cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal 1: Daily Transactions List Modal -->
    <div 
      v-if="showDailyModal" 
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-md bg-white rounded-2xl p-6 border border-border-subtle shadow-xl space-y-4 relative overflow-y-auto max-h-[90vh]">
        <!-- Close Button -->
        <button 
          @click="showDailyModal = false; selectedDate = null"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-base font-bold text-ink flex items-center gap-2 pr-8">
          <CalendarIcon class="w-5 h-5 text-primary animate-pulse" />
          <span>รายการวันที่ {{ selectedDate }}</span>
        </h3>

        <!-- Daily Aggregate Widget -->
        <div class="grid grid-cols-2 gap-3 bg-slate-50 border border-border-subtle p-3 rounded-xl text-xs font-black">
          <div class="flex justify-between items-center">
            <span class="text-ink-muted">รายรับวันนี้:</span>
            <span class="text-accent-emerald">{{ formatCurrency(dailyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-ink-muted">รายจ่ายวันนี้:</span>
            <span class="text-tier-risk">{{ formatCurrency(dailyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)) }}</span>
          </div>
        </div>

        <!-- Daily Items Scroll area -->
        <div class="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          <div v-if="dailyTransactions.length === 0" class="text-center py-8 text-ink-muted text-xs">
            ไม่มีธุรกรรมบันทึกในวันนี้
          </div>

          <div 
            v-for="tx in dailyTransactions" 
            :key="tx.id"
            class="p-3 border border-border-subtle bg-slate-50/50 rounded-xl flex items-center justify-between hover:bg-slate-50 transition relative group"
          >
            <div class="flex items-center gap-3">
              <div 
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0"
                :class="tx.type === 'income' ? 'bg-emerald-50 text-accent-emerald' : 'bg-red-50 text-tier-risk'"
              >
                <ArrowUpRight v-if="tx.type === 'income'" class="w-3.5 h-3.5" />
                <ArrowDownRight v-else class="w-3.5 h-3.5" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-bold text-ink leading-tight">{{ formatCategoryThai(tx.category) }}</span>
                <span v-if="tx.note" class="text-[9px] text-ink-muted mt-0.5 max-w-[150px] truncate">{{ tx.note }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span 
                class="text-xs font-bold"
                :class="tx.type === 'income' ? 'text-accent-emerald' : 'text-ink'"
              >
                {{ tx.type === 'income' ? '+' : '-' }}{{ formatCurrency(tx.amount) }}
              </span>
              <div class="flex gap-0.5">
                <button 
                  @click="openEditModal(tx)"
                  class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-primary cursor-pointer"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                </button>
                <button 
                  @click="handleDelete(tx.id)"
                  class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-tier-risk cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add New Action Button inside daily view -->
        <button 
          @click="openAddModalForSelectedDay"
          class="btn-primary w-full justify-center text-xs cursor-pointer py-2.5 rounded-xl mt-2"
        >
          <Plus class="w-4 h-4" />
          <span>เพิ่มธุรกรรมสำหรับวันนี้</span>
        </button>
      </div>
    </div>

    <!-- Modal 2: Manual Form Modal -->
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-md bg-white rounded-2xl p-6 border border-border-subtle shadow-xl space-y-4 relative">
        <button 
          @click="showAddModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-base font-bold text-ink mb-2">
          {{ isEditing ? 'แก้ไขรายการเงิน' : 'เพิ่มรายการใหม่' }}
        </h3>

        <div class="space-y-3">
          <!-- Type Tab Switch -->
          <div class="tab-switch">
            <button 
              @click="type = 'expense'"
              class="tab-switch-btn"
              :class="type === 'expense' ? 'tab-switch-btn--active bg-red-500 text-white' : 'tab-switch-btn--inactive'"
            >
              รายจ่าย
            </button>
            <button 
              @click="type = 'income'"
              class="tab-switch-btn"
              :class="type === 'income' ? 'tab-switch-btn--active bg-accent-emerald text-white' : 'tab-switch-btn--inactive'"
            >
              รายรับ
            </button>
          </div>

          <!-- Amount -->
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">จำนวนเงิน (THB)</label>
            <input 
              v-model="amount"
              type="number" 
              placeholder="0.00" 
              class="input-field bg-slate-50 border border-slate-200"
            />
          </div>

          <!-- Category -->
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">หมวดหมู่</label>
            <select 
              v-model="category"
              class="input-field bg-slate-50 border border-slate-200"
            >
              <option 
                v-for="cat in categories" 
                :key="cat" 
                :value="cat"
              >
                {{ formatCategoryThai(cat) }}
              </option>
            </select>
          </div>

          <!-- Category placeholder spacer (merchant deleted) -->

          <!-- Note -->
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">บันทึกช่วยจำ (ไม่บังคับ)</label>
            <input 
              v-model="note"
              type="text" 
              placeholder="ข้อความเพิ่มเติม..." 
              class="input-field bg-slate-50 border border-slate-200"
            />
          </div>

          <!-- Date -->
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">วันที่ทำรายการ</label>
            <input 
              v-model="date"
              type="date" 
              class="input-field bg-slate-50 border border-slate-200"
            />
          </div>
        </div>

        <button 
          @click="handleSave"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          บันทึกรายการ
        </button>
      </div>
    </div>

    <!-- Modal 3: AI OCR Scanner Modal -->
    <div 
      v-if="showScanModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-md bg-white rounded-2xl p-6 border border-border-subtle shadow-xl space-y-4 relative overflow-y-auto max-h-[90vh]">
        <button 
          @click="showScanModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <X class="w-5 h-5" />
        </button>

        <h3 class="text-base font-bold text-ink flex items-center gap-1.5">
          <Camera class="w-5 h-5 text-accent-emerald" />
          <span>สแกนใบเสร็จด้วย AI OCR</span>
        </h3>

        <!-- Daily Quota Counter -->
        <div class="flex justify-between items-center bg-slate-50 border border-border-subtle p-3 rounded-xl text-xs">
          <span class="font-bold text-ink">โควตาสแกนวันนี้: {{ usageStore.ocrUsedToday }} / {{ usageStore.ocrLimit }} ครั้ง</span>
          <span v-if="isPremium" class="text-[9px] font-black bg-emerald-50 text-accent-emerald border border-emerald-100 px-2 py-0.5 rounded-full">พรีเมียม</span>
          <span v-else class="text-[9px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full">แผนฟรี</span>
        </div>

        <!-- File Camera Select Box -->
        <div 
          v-if="!previewImage && !isOcrLoading"
          @click="triggerCamera"
          class="border-2 border-dashed border-slate-200 hover:border-accent-emerald rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/50 cursor-pointer transition"
        >
          <div class="w-12 h-12 rounded-full bg-accent-emerald/10 flex items-center justify-center text-accent-emerald">
            <Camera class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <span class="text-xs font-bold text-ink">กดเพื่อถ่ายภาพหรือแนบใบเสร็จ</span>
            <p class="text-[9px] text-ink-muted">อัปโหลดไฟล์ภาพ .jpg, .png</p>
          </div>
          <input 
            ref="fileInput"
            type="file" 
            accept="image/*" 
            capture="environment" 
            class="hidden" 
            @change="handleFileChange"
          />
        </div>

        <!-- OCR Loader -->
        <div 
          v-if="isOcrLoading"
          class="flex flex-col items-center justify-center p-8 text-center space-y-4"
        >
          <RefreshCw class="w-7 h-7 text-primary animate-spin" />
          <div class="space-y-1">
            <h4 class="text-xs font-bold text-ink">กำลังวิเคราะห์ภาพใบเสร็จ...</h4>
            <p class="text-[9px] text-ink-muted">AI Gemma กำลังสกัดยอดเงิน ชื่อร้าน และหมวดหมู่</p>
          </div>
        </div>

        <!-- Image Preview -->
        <div v-if="previewImage && !isOcrLoading" class="relative rounded-xl overflow-hidden border border-border-subtle bg-slate-100 max-h-40 flex items-center justify-center">
          <img :src="previewImage" class="object-cover max-h-40 w-full" />
          <button 
            @click="previewImage = null; showOcrResultForm = false"
            class="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Extracted Form details -->
        <div v-if="showOcrResultForm" class="space-y-3 pt-2">
          <div class="flex items-center gap-1.5 text-xs font-black text-accent-emerald">
            <CheckCircle class="w-4 h-4 fill-emerald-50" />
            <span>AI สกัดยอดสำเร็จ! ตรวจสอบความถูกต้อง</span>
          </div>

          <div class="space-y-2 text-xs">
            <!-- Merchant placeholder spacer (ocrMerchant deleted) -->

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="field-label font-bold text-ink text-[11px]">ยอดเงินรวม (THB)</label>
                <input v-model="ocrAmount" type="number" class="input-field py-2 min-h-10 bg-slate-50 border border-slate-200" />
              </div>
              <div class="space-y-1">
                <label class="field-label font-bold text-ink text-[11px]">หมวดหมู่</label>
                <select v-model="ocrCategory" class="input-field py-2 min-h-10 bg-slate-50 border border-slate-200">
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ formatCategoryThai(cat) }}</option>
                </select>
              </div>
            </div>

            <div class="space-y-1">
              <label class="field-label font-bold text-ink text-[11px]">วันที่ใบเสร็จ</label>
              <input v-model="ocrDate" type="date" class="input-field py-2 min-h-10 bg-slate-50 border border-slate-200" />
            </div>
            
            <div class="space-y-1">
              <label class="field-label font-bold text-ink text-[11px]">บันทึกเพิ่มเติม</label>
              <input v-model="ocrNote" type="text" class="input-field py-2 min-h-10 bg-slate-50 border border-slate-200" />
            </div>
          </div>

          <button 
            @click="handleConfirmOcr"
            class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
          >
            บันทึกรายจ่ายใบเสร็จ
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 4: Quota Upgrade Modal -->
    <div 
      v-if="showUpgradeModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-sm bg-white rounded-2xl p-6 border border-border-subtle shadow-xl space-y-4 text-center relative">
        <button 
          @click="showUpgradeModal = false"
          class="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <Sparkles class="w-6 h-6 fill-amber-500" />
        </div>

        <h3 class="text-base font-bold text-ink">โควตาสแกนรายวันเต็มแล้ว</h3>
        
        <p class="text-xs text-ink-muted leading-relaxed">
          ยอดการสแกนใบเสร็จฟรี 5 ครั้งต่อวันหมดลงแล้ว กรุณาอัปเกรดเป็นระดับพรีเมียมเพื่อขยายโควตาการสแกนไม่จำกัดและ AI โค้ชส่วนตัว
        </p>

        <div class="flex gap-2 pt-2">
          <button 
            @click="showUpgradeModal = false"
            class="btn-secondary flex-1 justify-center text-xs cursor-pointer"
          >
            ภายหลัง
          </button>
          <button 
            @click="handleUpgrade"
            class="btn-primary flex-1 justify-center text-xs bg-amber-500 hover:bg-amber-600 cursor-pointer"
          >
            อัปเกรด (Beta ฟรี)
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
