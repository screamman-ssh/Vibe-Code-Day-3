<script setup>
import { computed } from 'vue'
import { Check, X, Plus, Trash2 } from 'lucide-vue-next'
import {
  ACTION_TYPES,
  TX_CATEGORIES,
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

function isEditableTx(action) {
  return props.editable && action.type === ACTION_TYPES.CREATE_TX
}

function isEditableSocial(action) {
  return props.editable && action.type === ACTION_TYPES.CREATE_SOCIAL_POST
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
  <div class="preview-card">
    <p class="preview-card__title">{{ title }}</p>

    <div v-if="txCount > 0 && editable" class="preview-card__table-wrap">
      <table class="preview-card__table">
        <thead>
          <tr>
            <th>ประเภท</th>
            <th>จำนวนเงิน</th>
            <th>หมวด</th>
            <th>ร้าน/รายการ</th>
            <th>วันที่</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <template v-for="(action, idx) in actions" :key="idx">
            <tr v-if="isEditableTx(action)">
              <td>
                <select v-model="action.data.txType" class="preview-card__input" :disabled="disabled">
                  <option value="expense">รายจ่าย</option>
                  <option value="income">รายรับ</option>
                </select>
              </td>
              <td>
                <input
                  v-model.number="action.data.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="preview-card__input preview-card__input--amount"
                  :disabled="disabled"
                />
              </td>
              <td>
                <select v-model="action.data.category" class="preview-card__input" :disabled="disabled">
                  <option v-for="cat in TX_CATEGORIES" :key="cat" :value="cat">
                    {{ CATEGORY_LABELS[cat] || cat }}
                  </option>
                </select>
              </td>
              <td>
                <input
                  v-model="action.data.merchant"
                  type="text"
                  class="preview-card__input"
                  placeholder="ร้านค้า"
                  :disabled="disabled"
                />
              </td>
              <td>
                <input
                  v-model="action.data.date"
                  type="text"
                  class="preview-card__input preview-card__input--date"
                  placeholder="today"
                  :disabled="disabled"
                />
              </td>
              <td>
                <button
                  type="button"
                  class="preview-card__icon-btn"
                  :disabled="disabled"
                  aria-label="ลบรายการ"
                  @click="removeAction(idx)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <button
        type="button"
        class="preview-card__add-row"
        :disabled="disabled"
        @click="addTransactionRow"
      >
        <Plus class="w-3.5 h-3.5" />
        เพิ่มรายการ
      </button>
    </div>

    <div class="preview-card__list">
      <div
        v-for="(action, idx) in actions"
        :key="`summary-${idx}`"
        v-show="!isEditableTx(action)"
        class="preview-card__item"
      >
        <p class="preview-card__item-title">{{ actionTitle(action) }}</p>

        <textarea
          v-if="isEditableSocial(action)"
          v-model="action.data.content"
          rows="3"
          maxlength="500"
          class="preview-card__textarea"
          placeholder="ข้อความโพสต์..."
          :disabled="disabled"
        />
        <p v-else class="preview-card__item-sub">{{ actionSummary(action) }}</p>

        <button
          v-if="editable && !disabled"
          type="button"
          class="preview-card__remove-inline"
          @click="removeAction(idx)"
        >
          ลบ
        </button>
      </div>
    </div>

    <div class="preview-card__actions">
      <button
        type="button"
        class="preview-card__btn preview-card__btn--confirm"
        :disabled="!canConfirm()"
        @click="emit('confirm')"
      >
        <Check class="w-4 h-4" />
        ยืนยัน
      </button>
      <button
        type="button"
        class="preview-card__btn preview-card__btn--cancel"
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
.preview-card {
  border-radius: 12px;
  border: 2px solid var(--color-border-subtle);
  background: color-mix(in oklch, var(--color-primary) 6%, white);
  padding: 0.75rem 0.875rem;
}

.preview-card__title {
  margin: 0 0 0.5rem;
  font-size: var(--text-label);
  font-weight: 700;
  color: var(--color-ink);
}

.preview-card__table-wrap {
  margin-bottom: 0.75rem;
  overflow-x: auto;
}

.preview-card__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-caption);
}

.preview-card__table th,
.preview-card__table td {
  padding: 0.25rem;
  text-align: left;
  vertical-align: middle;
}

.preview-card__table th {
  color: var(--color-ink-muted);
  font-weight: 600;
  white-space: nowrap;
}

.preview-card__input {
  width: 100%;
  min-width: 4.5rem;
  padding: 0.35rem 0.45rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-subtle);
  background: white;
  font-size: var(--text-caption);
  color: var(--color-ink);
}

.preview-card__input--amount {
  min-width: 5rem;
}

.preview-card__input--date {
  min-width: 6rem;
}

.preview-card__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 8px;
  background: color-mix(in oklch, var(--color-danger, #dc2626) 12%, white);
  color: var(--color-danger, #dc2626);
  cursor: pointer;
}

.preview-card__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-card__add-row {
  margin-top: 0.5rem;
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
}

.preview-card__add-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-card__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.preview-card__item {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
}

.preview-card__item-title {
  margin: 0;
  font-size: var(--text-label);
  font-weight: 700;
}

.preview-card__item-sub {
  margin: 0.125rem 0 0;
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
  white-space: pre-line;
}

.preview-card__textarea {
  width: 100%;
  margin-top: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-subtle);
  background: white;
  font-size: var(--text-caption);
  resize: vertical;
}

.preview-card__remove-inline {
  margin-top: 0.375rem;
  border: none;
  background: transparent;
  color: var(--color-danger, #dc2626);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
}

.preview-card__actions {
  display: flex;
  gap: 0.5rem;
}

.preview-card__btn {
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

.preview-card__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preview-card__btn--confirm {
  background: var(--color-primary);
  color: white;
}

.preview-card__btn--cancel {
  background: white;
  color: var(--color-ink);
  border-color: var(--color-border-subtle);
}
</style>
