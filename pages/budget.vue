<script setup>
import { ref, computed } from 'vue'
import PageBanner from '~/components/layout/PageBanner.vue'
import { useBudgetStore } from '~/stores/budget'
import { useScoreStore } from '~/stores/score'
import { 
  PieChart, 
  PiggyBank,
  Save, 
  Edit3, 
  X, 
  Plus, 
  Trash2 
} from 'lucide-vue-next'

const budgetStore = useBudgetStore()
const scoreStore = useScoreStore()

// Add Modal states
const showAddModal = ref(false)
const newCategoryName = ref('')
const newLimit = ref('')

// Edit Modal states
const showEditModal = ref(false)
const editingOldName = ref('')
const editingCategoryName = ref('')
const editingLimit = ref('')

const totalLimit = computed(() => {
  return budgetStore.categories.reduce((sum, c) => sum + c.limitAmount, 0)
})

const totalSpent = computed(() => {
  return budgetStore.categories.reduce((sum, c) => sum + c.spentAmount, 0)
})

const adherencePercentage = computed(() => {
  if (totalLimit.value === 0) return 100
  return Math.round((totalSpent.value / totalLimit.value) * 100)
})

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
    'Other': 'อื่นๆ'
  }
  return mapping[cat] || cat
}

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
}

// Add category handlers
function openAddModal() {
  newCategoryName.value = ''
  newLimit.value = ''
  showAddModal.value = true
}

function handleAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return

  const success = budgetStore.addCategory(name, parseFloat(newLimit.value || 0))
  if (!success) {
    alert('หมวดหมู่นี้มีอยู่แล้วในระบบ')
    return
  }

  // Trigger score update simulation
  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore + 1, 0), 100)
  showAddModal.value = false
}

// Edit category handlers
function openEditModal(c) {
  editingOldName.value = c.category
  editingCategoryName.value = c.category
  editingLimit.value = c.limitAmount
  showEditModal.value = true
}

function handleSaveEdit() {
  const name = editingCategoryName.value.trim()
  if (!name) return

  budgetStore.editCategory(editingOldName.value, name, parseFloat(editingLimit.value || 0))

  // Trigger score update simulation
  scoreStore.currentScore.totalScore = Math.min(Math.max(scoreStore.currentScore.totalScore + 1, 0), 100)
  showEditModal.value = false
}

// Delete category handler
function handleDeleteCategory(categoryName) {
  if (confirm(`คุณต้องการลบหมวดหมู่ "${formatCategoryThai(categoryName)}" และข้อมูลวงเงินใช่หรือไม่?`)) {
    budgetStore.deleteCategory(categoryName)
  }
}
</script>

<template>
  <div class="page-shell">
    
    <PageBanner
      title="วางแผนงบประมาณ"
      lead="เปรียบเทียบวงเงินเป้าหมายและรายจ่ายรายหมวดหมู่ของคุณ"
    >
      <template #icon>
        <PiggyBank class="w-5 h-5" />
      </template>
      <template #actions>
        <button
          @click="openAddModal"
          class="btn-primary gap-1 px-4 py-2 min-h-0 text-xs cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>เพิ่มหมวดหมู่</span>
        </button>
      </template>
    </PageBanner>

    <!-- Adherence Gauge Card -->
    <div class="surface-card flex flex-col items-center p-6 text-center">
      <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <PieChart class="w-6 h-6 text-primary" />
      </div>
      <h3 class="text-sm font-bold text-ink">สัดส่วนการใช้งบประมาณ</h3>
      <span class="text-3xl font-brand font-black text-ink mt-2">
        {{ adherencePercentage }}%
      </span>
      <p class="text-xs text-ink-muted leading-relaxed mt-1">
        จ่ายไปแล้ว {{ formatCurrency(totalSpent) }} จากยอดรวมที่ตั้งเป้า {{ formatCurrency(totalLimit) }}
      </p>

      <!-- Overall progress bar -->
      <div class="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
        <div 
          class="h-full rounded-full transition-all duration-500"
          :class="adherencePercentage >= 100 ? 'bg-tier-risk' : adherencePercentage >= 85 ? 'bg-tier-building' : 'bg-accent-emerald'"
          :style="{ width: `${Math.min(adherencePercentage, 100)}%` }"
        />
      </div>
    </div>

    <!-- Categories Grid Layout -->
    <div class="space-y-4">
      <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider">งบประมาณแยกหมวด</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        
        <!-- Category Card -->
        <div 
          v-for="c in budgetStore.categories" 
          :key="c.category"
          class="surface-card-sm flex flex-col justify-between min-h-[8.5rem] relative group border-2 border-border-subtle hover:bg-slate-50/50 transition p-4 rounded-xl bg-surface-card"
        >
          <!-- Info block -->
          <div class="space-y-1.5">
            <div class="flex items-start justify-between gap-1.5">
              <span class="text-sm font-bold text-ink leading-tight truncate" :title="formatCategoryThai(c.category)">
                {{ formatCategoryThai(c.category) }}
              </span>
              
              <div class="flex gap-1 items-center shrink-0">
                <span 
                  v-if="c.spentAmount > c.limitAmount" 
                  class="chip chip-negative text-nano font-black px-1.5 py-0.5 leading-none"
                >
                  เกินงบ
                </span>
                <span 
                  v-else-if="c.limitAmount > 0 && (c.spentAmount / c.limitAmount) >= 0.85" 
                  class="chip bg-sunshine-yellow/10 text-tier-building border-tier-building/20 text-nano font-black px-1.5 py-0.5 leading-none"
                >
                  ใกล้เต็ม
                </span>
              </div>
            </div>

            <div class="flex flex-col text-caption text-ink-muted leading-tight">
              <span>จ่ายแล้ว: <span class="font-bold text-ink">{{ formatCurrency(c.spentAmount) }}</span></span>
              <span class="mt-1">งบตั้งเป้า: <span class="font-bold text-ink">{{ formatCurrency(c.limitAmount) }}</span></span>
            </div>
          </div>

          <!-- Bottom elements -->
          <div class="space-y-3 mt-4">
            <!-- Progress bar -->
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-300"
                :class="c.spentAmount > c.limitAmount ? 'bg-tier-risk' : (c.spentAmount / (c.limitAmount || 1)) >= 0.85 ? 'bg-tier-building' : 'bg-accent-emerald'"
                :style="{ width: `${Math.min((c.spentAmount / (c.limitAmount || 1)) * 100, 100)}%` }"
              />
            </div>

            <!-- Card Actions -->
            <div class="flex justify-end gap-1">
              <button 
                @click="openEditModal(c)"
                class="p-1 text-ink-muted hover:text-primary rounded hover:bg-slate-100 cursor-pointer"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button 
                @click="handleDeleteCategory(c.category)"
                class="p-1 text-ink-muted hover:text-tier-risk rounded hover:bg-slate-100 cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Add Category Dotted Card -->
        <div 
          @click="openAddModal"
          class="border-2 border-dashed border-cloud-gray hover:border-primary bg-slate-50/20 hover:bg-slate-50/50 transition cursor-pointer rounded-xl min-h-[8.5rem] flex flex-col items-center justify-center gap-2 p-4 text-center select-none"
        >
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Plus class="w-4 h-4" />
          </div>
          <span class="text-xs font-bold text-ink">เพิ่มหมวดหมู่ใหม่</span>
        </div>

      </div>
    </div>

    <!-- Modal 1: Add Category Modal -->
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

        <h3 class="text-base font-bold text-ink">
          เพิ่มหมวดหมู่ใหม่
        </h3>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ชื่อหมวดหมู่</label>
            <input 
              v-model="newCategoryName"
              type="text" 
              placeholder="เช่น การกุศล, ช้อปปิ้ง..." 
              class="input-field"
            />
          </div>

          <div class="space-y-1">
            <label class="field-label font-bold text-ink">งบประมาณเป้าหมาย (THB)</label>
            <input 
              v-model="newLimit"
              type="number" 
              placeholder="0.00" 
              class="input-field"
            />
          </div>
        </div>

        <button 
          @click="handleAddCategory"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          <Save class="w-4 h-4" />
          <span>เพิ่มหมวดหมู่</span>
        </button>
      </div>
    </div>

    <!-- Modal 2: Edit Limit / Category Modal -->
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

        <h3 class="text-base font-bold text-ink">
          แก้ไขหมวดหมู่ & งบประมาณ
        </h3>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="field-label font-bold text-ink">ชื่อหมวดหมู่</label>
            <input 
              v-model="editingCategoryName"
              type="text" 
              class="input-field"
            />
          </div>

          <div class="space-y-1">
            <label class="field-label font-bold text-ink">วงเงินเป้าหมาย (THB)</label>
            <input 
              v-model="editingLimit"
              type="number" 
              class="input-field"
              @keyup.enter="handleSaveEdit"
            />
          </div>
        </div>

        <button 
          @click="handleSaveEdit"
          class="btn-primary w-full justify-center text-sm cursor-pointer mt-2"
        >
          <Save class="w-4 h-4" />
          <span>บันทึกการแก้ไข</span>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>
