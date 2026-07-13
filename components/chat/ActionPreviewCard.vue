<script setup>
import { computed } from 'vue'
import { Check, X, Plus } from 'lucide-vue-next'
import SpendingRecordCard from '~/components/chat/SpendingRecordCard.vue'
import {
  ACTION_TYPES,
  CATEGORY_LABELS,
  createEmptyTransaction,
  planSummary,
  countTransactionActions
} from '~/utils/chatActionTypes'

const props = defineProps({
  plan: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  editable: { type: Boolean, default: true }
})

const emit = defineEmits(['confirm', 'cancel'])

const actions = computed(() => Array.isArray(props.plan?.actions) ? props.plan.actions : [])

const title = computed(() => planSummary(actions.value))

const txCount = computed(() => countTransactionActions(actions.value))

const planState = computed(() => props.plan?.state || 'pending')

const hasNonTxActions = computed(() =>
  actions.value.some(action => action.type !== ACTION_TYPES.CREATE_TX)
)

const showActions = computed(() =>
  props.editable && (planState.value === 'pending' || planState.value === 'failed')
)

function formatCurrency(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '-'
  return `${n.toLocaleString()} บาท`
}

function actionTitle(action) {
  switch (action.type) {
    case ACTION_TYPES.CREATE_TX: return 'บันทึกรายการ'
    case ACTION_TYPES.UPDATE_TX: return 'แก้ไขรายการ'
    case ACTION_TYPES.DELETE_TX: return 'ลบรายการ'
    case ACTION_TYPES.SET_BUDGET: return 'ตั้งงบประมาณ'
    case ACTION_TYPES.ADD_DEBT: return 'เพิ่มหนี้'
    case ACTION_TYPES.RECORD_DEBT_PAYMENT: return 'บันทึกจ่ายหนี้'
    case ACTION_TYPES.CREATE_SOCIAL_POST: return 'โพสต์ชุมชน'
    default: return action.type || 'Action'
  }
}

function actionSummary(action) {
  const d = action.data || {}
  switch (action.type) {
    case ACTION_TYPES.CREATE_TX:
      return `${d.txType === 'income' ? 'รายรับ' : 'รายจ่าย'} · ${formatCurrency(d.amount)} · ${CATEGORY_LABELS[d.category] || d.category || '-'}`
    case ACTION_TYPES.UPDATE_TX:
      return `แก้ไข #${d.transactionId || '-'}`
    case ACTION_TYPES.DELETE_TX:
      return `ลบ #${d.transactionId || '-'}`
    case ACTION_TYPES.SET_BUDGET:
      return `${CATEGORY_LABELS[d.category] || d.category || '-'} · วงเงิน ${formatCurrency(d.limitAmount)}`
    case ACTION_TYPES.ADD_DEBT:
      return `${d.name || '-'} · ยอด ${formatCurrency(d.balance)}`
    case ACTION_TYPES.RECORD_DEBT_PAYMENT:
      return `${d.debtName || '-'} · จ่าย ${formatCurrency(d.amount)}`
    case ACTION_TYPES.CREATE_SOCIAL_POST:
      return d.content || '-'
    default:
      return JSON.stringify(d)
  }
}

function isCreateTx(action) {
  return action.type === ACTION_TYPES.CREATE_TX
}

function isEditableSocial(action) {
  return props.editable && action.type === ACTION_TYPES.CREATE_SOCIAL_POST
}

function isNonTxAction(action) {
  return !isCreateTx(action)
}

function addTransactionRow() {
  if (!props.plan.actions) props.plan.actions = []
  props.plan.actions.push(createEmptyTransaction())
}

function removeAction(index) {
  props.plan.actions.splice(index, 1)
}

function canConfirm() {
  return actions.value.length > 0 && !props.disabled
}
</script>

<template>
  <div
    class="action-preview"
    :class="{ 'action-preview--tx-only': txCount > 0 && !hasNonTxActions }"
  >
    <p v-if="hasNonTxActions || txCount === 0" class="action-preview__title">{{ title }}</p>

    <div v-if="txCount > 0" class="action-preview__tx-stack">
      <template v-for="(action, idx) in actions" :key="`tx-${idx}`">
        <SpendingRecordCard
          v-if="isCreateTx(action)"
          :action="action"
          :disabled="disabled"
          :editable="editable"
          :state="planState"
          :show-remove="editable && planState !== 'applied' && txCount > 1"
          @remove="removeAction(idx)"
        />
      </template>

      <button
        v-if="editable && planState !== 'applied'"
        type="button"
        class="action-preview__add-row"
        :disabled="disabled"
        @click="addTransactionRow"
      >
        <Plus class="w-3.5 h-3.5" />
        เพิ่มรายการ
      </button>
    </div>

    <div v-if="hasNonTxActions" class="action-preview__list">
      <div
        v-for="(action, idx) in actions"
        :key="`summary-${idx}`"
        v-show="isNonTxAction(action)"
        class="action-preview__item"
      >
        <p class="action-preview__item-title">{{ actionTitle(action) }}</p>

        <textarea
          v-if="isEditableSocial(action)"
          v-model="action.data.content"
          rows="3"
          maxlength="500"
          class="action-preview__textarea"
          placeholder="ข้อความโพสต์..."
          :disabled="disabled"
        />
        <p v-else class="action-preview__item-sub">{{ actionSummary(action) }}</p>

        <button
          v-if="editable && !disabled && planState !== 'applied'"
          type="button"
          class="action-preview__remove-inline"
          @click="removeAction(idx)"
        >
          ลบ
        </button>
      </div>
    </div>

    <p v-if="plan.error && planState === 'failed'" class="action-preview__error">
      บันทึกไม่สำเร็จ: {{ plan.error }}
    </p>

    <div v-if="showActions" class="action-preview__actions">
      <button
        type="button"
        class="action-preview__btn action-preview__btn--confirm"
        :disabled="!canConfirm()"
        @click="emit('confirm')"
      >
        <Check class="w-4 h-4" />
        ยืนยัน
      </button>
      <button
        type="button"
        class="action-preview__btn action-preview__btn--cancel"
        :disabled="disabled"
        @click="emit('cancel')"
      >
        <X class="w-4 h-4" />
        ยกเลิก
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-preview {
  border-radius: 12px;
  border: 2px solid var(--color-border-subtle);
  background: color-mix(in oklch, var(--color-primary) 6%, white);
  padding: 0.75rem 0.875rem;
}

.action-preview--tx-only {
  border: none;
  background: transparent;
  padding: 0;
}

.action-preview__title {
  margin: 0 0 0.5rem;
  font-size: var(--text-label);
  font-weight: 700;
  color: var(--color-ink);
}

.action-preview__tx-stack {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-bottom: 0.75rem;
}

.action-preview--tx-only .action-preview__tx-stack {
  margin-bottom: 0.5rem;
}

.action-preview__add-row {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px dashed var(--color-border-subtle);
  background: white;
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  align-self: flex-start;
}

.action-preview__add-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-preview__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-preview__item {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
}

.action-preview__item-title {
  margin: 0;
  font-size: var(--text-label);
  font-weight: 700;
}

.action-preview__item-sub {
  margin: 0.125rem 0 0;
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
  white-space: pre-line;
}

.action-preview__textarea {
  width: 100%;
  margin-top: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-subtle);
  background: white;
  font-size: var(--text-caption);
  resize: vertical;
}

.action-preview__remove-inline {
  margin-top: 0.375rem;
  border: none;
  background: transparent;
  color: var(--color-danger, #dc2626);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
}

.action-preview__error {
  margin: 0 0 0.5rem;
  font-size: var(--text-caption);
  color: var(--color-danger, #dc2626);
}

.action-preview__actions {
  display: flex;
  gap: 0.5rem;
}

.action-preview__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-size: var(--text-label);
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
}

.action-preview__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.action-preview__btn--confirm {
  background: var(--color-primary);
  color: white;
}

.action-preview__btn--cancel {
  background: white;
  color: var(--color-ink);
  border-color: var(--color-border-subtle);
}
</style>
