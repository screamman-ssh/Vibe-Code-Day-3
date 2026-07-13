<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  Check,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Car,
  Home,
  Zap,
  Clapperboard,
  HeartPulse,
  GraduationCap,
  CreditCard,
  PiggyBank,
  Wallet,
  MoreHorizontal
} from 'lucide-vue-next'
import {
  TX_CATEGORIES,
  CATEGORY_LABELS,
  formatCategoryLabel,
  resolveActionDate
} from '~/utils/chatActionTypes'

const props = defineProps({
  action: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  editable: { type: Boolean, default: true },
  state: {
    type: String,
    default: 'pending',
    validator: v => ['pending', 'applying', 'applied', 'failed'].includes(v)
  },
  showRemove: { type: Boolean, default: false }
})

const emit = defineEmits(['remove'])

const CATEGORY_ICONS = {
  Food: Utensils,
  Transport: Car,
  Housing: Home,
  Utilities: Zap,
  Entertainment: Clapperboard,
  Health: HeartPulse,
  Education: GraduationCap,
  'Debt Payment': CreditCard,
  Savings: PiggyBank,
  Income: Wallet,
  Other: MoreHorizontal
}

const SHORT_LABELS = {
  Food: 'อาหาร',
  Transport: 'เดินทาง',
  Housing: 'บ้าน',
  Utilities: 'สาธารณูปโภค',
  Entertainment: 'บันเทิง',
  Health: 'สุขภาพ',
  Education: 'เรียน',
  'Debt Payment': 'หนี้',
  Savings: 'ออม',
  Income: 'รายรับ',
  Other: 'อื่นๆ'
}

const triggerRef = ref(null)
const trackRef = ref(null)
const dialOpen = ref(false)
const dialStyle = ref({})
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const hasOverflow = ref(false)

let trackObserver = null

const data = computed(() => props.action?.data || {})

const isIncome = computed(() => data.value.txType === 'income')

const displayDate = computed(() => resolveActionDate(data.value.date))

const dateModel = computed({
  get() {
    return resolveActionDate(data.value.date)
  },
  set(value) {
    props.action.data.date = value || resolveActionDate('today')
  }
})

const categoryLabel = computed(() => formatCategoryLabel(data.value.category))

const selectedIcon = computed(() => CATEGORY_ICONS[data.value.category] || MoreHorizontal)

const isReadOnly = computed(() =>
  !props.editable || props.disabled || props.state === 'applied' || props.state === 'applying'
)

const isApplied = computed(() => props.state === 'applied')

const dialCategories = computed(() => {
  if (isIncome.value) {
    return ['Income', 'Savings', 'Other']
  }
  return TX_CATEGORIES.filter(c => c !== 'Income')
})

const amountDisplay = computed(() => {
  const n = Number(data.value.amount)
  if (!Number.isFinite(n)) return ''
  return String(n)
})

function positionDial() {
  const el = triggerRef.value
  if (!el || typeof window === 'undefined') return

  const rect = el.getBoundingClientRect()
  const pad = 12
  const dialWidth = Math.min(window.innerWidth - pad * 2, 340)
  let left = rect.left + rect.width / 2 - dialWidth / 2
  left = Math.max(pad, Math.min(left, window.innerWidth - dialWidth - pad))

  // Prefer above the trigger (reaction-picker style)
  const preferTop = rect.top > 88
  if (preferTop) {
    dialStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${dialWidth}px`,
      bottom: `${window.innerHeight - rect.top + 10}px`,
      top: 'auto'
    }
  } else {
    dialStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${dialWidth}px`,
      top: `${rect.bottom + 10}px`,
      bottom: 'auto'
    }
  }
}

async function openDial() {
  if (isReadOnly.value) return
  dialOpen.value = true
  await nextTick()
  positionDial()
  updateDialScrollState()
}

function closeDial() {
  dialOpen.value = false
}

function updateDialScrollState() {
  const el = trackRef.value
  if (!el) return

  const maxScroll = el.scrollWidth - el.clientWidth
  hasOverflow.value = maxScroll > 4
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft < maxScroll - 4
}

function scrollDial(direction) {
  const el = trackRef.value
  if (!el) return
  const amount = Math.max(112, Math.round(el.clientWidth * 0.55))
  el.scrollBy({ left: direction * amount, behavior: 'smooth' })
}

function attachTrackObserver() {
  trackObserver?.disconnect()
  if (!trackRef.value || typeof ResizeObserver === 'undefined') return

  trackObserver = new ResizeObserver(() => updateDialScrollState())
  trackObserver.observe(trackRef.value)
}

function detachTrackObserver() {
  trackObserver?.disconnect()
  trackObserver = null
}

function toggleDial() {
  if (dialOpen.value) closeDial()
  else openDial()
}

function selectCategory(cat) {
  if (isReadOnly.value) return
  props.action.data.category = cat
  if (cat === 'Income') {
    props.action.data.txType = 'income'
  } else if (props.action.data.txType === 'income' && cat !== 'Savings') {
    props.action.data.txType = 'expense'
  }
  closeDial()
}

function setTxType(type) {
  if (isReadOnly.value) return
  props.action.data.txType = type
  if (type === 'income' && props.action.data.category !== 'Income' && props.action.data.category !== 'Savings') {
    props.action.data.category = 'Income'
  }
  if (type === 'expense' && props.action.data.category === 'Income') {
    props.action.data.category = 'Food'
  }
  closeDial()
}

function onAmountInput(event) {
  const raw = event.target.value.replace(/[^\d.]/g, '')
  const n = Number(raw)
  props.action.data.amount = Number.isFinite(n) ? n : 0
}

function onKeydown(event) {
  if (event.key === 'Escape') closeDial()
}

function onViewportChange() {
  if (dialOpen.value) {
    positionDial()
    updateDialScrollState()
  }
}

watch(isReadOnly, (locked) => {
  if (locked) closeDial()
})

watch(dialOpen, async (open) => {
  if (!open) {
    detachTrackObserver()
    return
  }
  await nextTick()
  updateDialScrollState()
  attachTrackObserver()
})

watch(dialCategories, async () => {
  if (!dialOpen.value) return
  await nextTick()
  updateDialScrollState()
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  detachTrackObserver()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <article
    class="spend-card"
    :class="{
      'spend-card--applied': isApplied,
      'spend-card--applying': state === 'applying',
      'spend-card--income': isIncome
    }"
    aria-label="บัตรบันทึกรายการ"
  >
    <header class="spend-card__top">
      <div class="spend-card__type-toggle" role="group" aria-label="ประเภทรายการ">
        <button
          type="button"
          class="spend-card__type-btn"
          :class="{ 'spend-card__type-btn--active': !isIncome }"
          :disabled="isReadOnly"
          @click="setTxType('expense')"
        >
          รายจ่าย
        </button>
        <button
          type="button"
          class="spend-card__type-btn"
          :class="{ 'spend-card__type-btn--active': isIncome }"
          :disabled="isReadOnly"
          @click="setTxType('income')"
        >
          รายรับ
        </button>
      </div>

      <div class="spend-card__top-right">
        <input
          v-if="!isReadOnly"
          v-model="dateModel"
          type="date"
          class="spend-card__date"
          aria-label="วันที่"
        />
        <span v-else class="spend-card__date-text">{{ displayDate }}</span>
        <button
          v-if="showRemove && editable && !disabled && state !== 'applied'"
          type="button"
          class="spend-card__remove"
          aria-label="ลบรายการ"
          @click="emit('remove')"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <div class="spend-card__merchant">
      <input
        v-if="!isReadOnly"
        v-model="action.data.merchant"
        type="text"
        class="spend-card__merchant-input"
        placeholder="ชื่อร้าน / รายการ"
      />
      <p v-else class="spend-card__merchant-text">{{ data.merchant || '-' }}</p>
    </div>

    <div class="spend-card__amount-row">
      <div class="spend-card__amount">
        <input
          v-if="!isReadOnly"
          :value="amountDisplay"
          type="text"
          inputmode="decimal"
          class="spend-card__amount-input"
          placeholder="0"
          @input="onAmountInput"
        />
        <span v-else class="spend-card__amount-value">{{ amountDisplay || '0' }}</span>
        <span class="spend-card__currency">บาท</span>
      </div>

      <!-- Category trigger — opens floating speed dial -->
      <button
        ref="triggerRef"
        type="button"
        class="spend-card__cat-trigger"
        :class="{ 'spend-card__cat-trigger--open': dialOpen }"
        :disabled="isReadOnly"
        :aria-expanded="dialOpen"
        aria-haspopup="listbox"
        @click="toggleDial"
      >
        <span class="spend-card__cat-orb">
          <component :is="selectedIcon" class="spend-card__cat-icon" />
        </span>
        <span class="spend-card__cat-meta">
          <span class="spend-card__cat-kicker">หมวด</span>
          <span class="spend-card__cat-name">{{ categoryLabel }}</span>
        </span>
        <ChevronDown class="spend-card__cat-chevron" />
      </button>
    </div>

    <div v-if="isApplied" class="spend-card__success">
      <Check class="w-4 h-4" />
      บันทึกข้อมูลสำเร็จ
    </div>
  </article>

  <Teleport to="body">
    <div
      v-if="dialOpen"
      class="cat-dial-root"
    >
      <button
        type="button"
        class="cat-dial-backdrop"
        aria-label="ปิดเลือกหมวด"
        @click="closeDial"
      />

      <div
        class="cat-dial"
        role="listbox"
        aria-label="เลือกหมวดหมู่"
        :style="dialStyle"
      >
        <div
          class="cat-dial__shell"
          :class="{ 'cat-dial__shell--overflow': hasOverflow }"
        >
          <button
            v-if="hasOverflow && canScrollLeft"
            type="button"
            class="cat-dial__scroll cat-dial__scroll--left"
            aria-label="เลื่อนหมวดซ้าย"
            @click.stop="scrollDial(-1)"
          >
            <ChevronLeft class="cat-dial__scroll-icon" />
          </button>

          <div
            ref="trackRef"
            class="cat-dial__track"
            @scroll="updateDialScrollState"
          >
            <button
              v-for="cat in dialCategories"
              :key="cat"
              type="button"
              role="option"
              class="cat-dial__item"
              :class="{ 'cat-dial__item--active': data.category === cat }"
              :aria-selected="data.category === cat"
              :title="CATEGORY_LABELS[cat] || cat"
              @click="selectCategory(cat)"
            >
              <span class="cat-dial__orb">
                <component :is="CATEGORY_ICONS[cat] || MoreHorizontal" class="cat-dial__icon" />
              </span>
              <span class="cat-dial__name">{{ SHORT_LABELS[cat] || cat }}</span>
            </button>
          </div>

          <button
            v-if="hasOverflow && canScrollRight"
            type="button"
            class="cat-dial__scroll cat-dial__scroll--right"
            aria-label="เลื่อนหมวดขวา"
            @click.stop="scrollDial(1)"
          >
            <ChevronRight class="cat-dial__scroll-icon" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.spend-card {
  position: relative;
  border-radius: 18px;
  border: 2px solid color-mix(in oklch, var(--color-primary) 16%, white);
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--color-primary) 5%, white) 0%, white 42%);
  padding: 0.75rem 0.75rem 0.875rem;
  overflow: hidden;
}

.spend-card--income {
  border-color: color-mix(in oklch, #059669 22%, white);
  background:
    linear-gradient(180deg, color-mix(in oklch, #059669 7%, white) 0%, white 42%);
}

.spend-card--applied {
  border-color: color-mix(in oklch, #10b981 40%, white);
  background: color-mix(in oklch, #10b981 5%, white);
}

.spend-card--applying {
  opacity: 0.85;
  pointer-events: none;
}

.spend-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.spend-card__type-toggle {
  display: inline-flex;
  padding: 0.15rem;
  border-radius: 999px;
  background: color-mix(in oklch, var(--color-border-subtle) 70%, white);
}

.spend-card__type-btn {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: background 160ms ease-out, color 160ms ease-out;
}

.spend-card__type-btn:disabled {
  cursor: default;
}

.spend-card__type-btn--active {
  background: white;
  color: var(--color-primary);
  box-shadow: 0 1px 3px color-mix(in oklch, black 8%, transparent);
}

.spend-card--income .spend-card__type-btn--active {
  color: #059669;
}

.spend-card__top-right {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.spend-card__date {
  border: 1px solid var(--color-border-subtle);
  background: white;
  border-radius: 8px;
  padding: 0.2rem 0.35rem;
  font-size: var(--text-caption);
  color: var(--color-ink);
  max-width: 8.5rem;
}

.spend-card__date-text {
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
}

.spend-card__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  border-radius: 8px;
  background: color-mix(in oklch, var(--color-danger, #dc2626) 10%, white);
  color: var(--color-danger, #dc2626);
  cursor: pointer;
}

.spend-card__merchant {
  margin-bottom: 0.35rem;
}

.spend-card__merchant-input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.15rem 0.1rem;
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--color-ink);
  outline: none;
}

.spend-card__merchant-input::placeholder {
  color: var(--color-ink-muted);
  font-weight: 500;
}

.spend-card__merchant-text {
  margin: 0;
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--color-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spend-card__amount-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
}

.spend-card__amount {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.spend-card__amount-input,
.spend-card__amount-value {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  font-family: var(--font-brand, inherit);
  font-size: clamp(2rem, 8vw, 2.6rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--color-primary);
  outline: none;
}

.spend-card--income .spend-card__amount-input,
.spend-card--income .spend-card__amount-value {
  color: #059669;
}

.spend-card__amount-input::placeholder {
  color: color-mix(in oklch, var(--color-primary) 35%, white);
}

.spend-card__currency {
  font-size: var(--text-label);
  font-weight: 700;
  color: var(--color-ink-muted);
  flex-shrink: 0;
}

.spend-card__cat-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  max-width: 9.5rem;
  border: 1px solid var(--color-border-subtle);
  background: white;
  border-radius: 999px;
  padding: 0.3rem 0.55rem 0.3rem 0.3rem;
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in oklch, black 5%, transparent);
  transition: border-color 160ms ease-out, box-shadow 160ms ease-out;
}

.spend-card__cat-trigger:disabled {
  cursor: default;
  opacity: 0.85;
}

.spend-card__cat-trigger--open,
.spend-card__cat-trigger:not(:disabled):hover {
  border-color: color-mix(in oklch, var(--color-primary) 35%, white);
  box-shadow: 0 4px 14px color-mix(in oklch, var(--color-primary) 12%, transparent);
}

.spend-card__cat-orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: color-mix(in oklch, var(--color-primary) 12%, white);
  color: var(--color-primary);
  flex-shrink: 0;
}

.spend-card--income .spend-card__cat-orb {
  background: color-mix(in oklch, #059669 12%, white);
  color: #059669;
}

.spend-card__cat-icon {
  width: 1rem;
  height: 1rem;
}

.spend-card__cat-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  line-height: 1.1;
}

.spend-card__cat-kicker {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.spend-card__cat-name {
  font-size: var(--text-caption);
  font-weight: 800;
  color: var(--color-ink);
  max-width: 4.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spend-card__cat-chevron {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--color-ink-muted);
  flex-shrink: 0;
  transition: transform 160ms ease-out;
}

.spend-card__cat-trigger--open .spend-card__cat-chevron {
  transform: rotate(180deg);
}

.spend-card__success {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 2px solid color-mix(in oklch, #10b981 35%, white);
  background: color-mix(in oklch, #10b981 12%, white);
  color: #059669;
  font-size: var(--text-label);
  font-weight: 700;
}
</style>

<style>
/* Teleported — must be unscoped */
.cat-dial-root {
  position: fixed;
  inset: 0;
  z-index: 80;
  pointer-events: none;
}

.cat-dial-backdrop {
  position: fixed;
  inset: 0;
  border: none;
  background: color-mix(in oklch, black 18%, transparent);
  pointer-events: auto;
  cursor: pointer;
  animation: cat-dial-fade 140ms ease-out;
}

.cat-dial {
  pointer-events: auto;
  padding: 0.45rem;
  border-radius: 999px;
  background-color: #ffffff;
  background-image: none;
  isolation: isolate;
  border: 1px solid #e8e8e8;
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.16),
    0 2px 6px rgba(0, 0, 0, 0.08);
  animation: cat-dial-pop 180ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: bottom center;
  overflow: hidden;
}

.cat-dial__shell {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.cat-dial__shell--overflow::before,
.cat-dial__shell--overflow::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.75rem;
  z-index: 1;
  pointer-events: none;
}

.cat-dial__shell--overflow::before {
  left: 0;
  background: linear-gradient(90deg, #ffffff 35%, rgba(255, 255, 255, 0));
}

.cat-dial__shell--overflow::after {
  right: 0;
  background: linear-gradient(270deg, #ffffff 35%, rgba(255, 255, 255, 0));
}

.cat-dial__scroll {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 999px;
  border: 1px solid #e2e2e2;
  background: #ffffff;
  color: #64748b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: background 140ms ease-out, color 140ms ease-out, transform 140ms ease-out;
}

.cat-dial__scroll:hover {
  background: #f8fafc;
  color: var(--color-primary, #be1a1a);
}

.cat-dial__scroll:active {
  transform: translateY(-50%) scale(0.94);
}

.cat-dial__scroll--left {
  left: 0.2rem;
}

.cat-dial__scroll--right {
  right: 0.2rem;
}

.cat-dial__scroll-icon {
  width: 1rem;
  height: 1rem;
}

.cat-dial__track {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0.2rem 0.35rem 0.3rem;
  background-color: #ffffff;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
}

.cat-dial__shell--overflow .cat-dial__track {
  padding-left: 1.9rem;
  padding-right: 1.9rem;
}

.cat-dial__track::-webkit-scrollbar {
  display: none;
}

.cat-dial__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  flex: 0 0 auto;
  width: 3.1rem;
  border: none;
  background: transparent;
  padding: 0.1rem;
  cursor: pointer;
}

.cat-dial__orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 999px;
  background: #f1f3f5;
  color: #64748b;
  transition:
    transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
    background 150ms ease-out,
    color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.cat-dial__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.cat-dial__name {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-ink-muted, #64748b);
  text-align: center;
  max-width: 3.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-dial__item:hover .cat-dial__orb,
.cat-dial__item:focus-visible .cat-dial__orb {
  transform: translateY(-4px) scale(1.08);
  background: color-mix(in oklch, var(--color-primary, #be1a1a) 12%, white);
  color: var(--color-primary, #be1a1a);
}

.cat-dial__item--active .cat-dial__orb {
  background: var(--color-primary, #be1a1a);
  color: white;
  transform: translateY(-3px) scale(1.06);
  box-shadow: 0 6px 14px color-mix(in oklch, var(--color-primary, #be1a1a) 28%, transparent);
}

.cat-dial__item--active .cat-dial__name {
  color: var(--color-primary, #be1a1a);
  font-weight: 800;
}

.cat-dial__item:active .cat-dial__orb {
  transform: scale(0.94);
}

@keyframes cat-dial-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cat-dial-pop {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cat-dial,
  .cat-dial-backdrop,
  .cat-dial__orb {
    animation: none;
    transition: none;
  }
}
</style>
