import { useTransactionsStore } from '~/stores/transactions'
import { useBudgetStore } from '~/stores/budget'
import { useDebtsStore } from '~/stores/debts'
import { useSocialStore } from '~/stores/social'
import { ACTION_TYPES, resolveActionDate } from '~/utils/chatActionTypes'

export function useActionExecutor() {
  const txStore = useTransactionsStore()
  const budgetStore = useBudgetStore()
  const debtsStore = useDebtsStore()
  const socialStore = useSocialStore()

  async function executeAction(action) {
    const d = action.data || {}

    switch (action.type) {
      case ACTION_TYPES.CREATE_TX:
        return txStore.createTransaction({
          type: d.txType,
          amount: d.amount,
          category: d.category,
          merchant: d.merchant,
          note: d.note,
          date: resolveActionDate(d.date),
          source: 'ai_preview'
        })

      case ACTION_TYPES.UPDATE_TX:
        return txStore.updateTransaction(d.transactionId, {
          type: d.txType,
          amount: d.amount,
          category: d.category,
          merchant: d.merchant,
          note: d.note,
          date: d.date ? resolveActionDate(d.date) : undefined
        })

      case ACTION_TYPES.DELETE_TX:
        return txStore.deleteTransaction(d.transactionId)

      case ACTION_TYPES.SET_BUDGET:
        return budgetStore.updateBudget([{
          category: d.category,
          limitAmount: d.limitAmount
        }], d.month || null)

      case ACTION_TYPES.ADD_DEBT:
        return debtsStore.addDebt({
          name: d.name,
          balance: d.balance,
          apr: d.apr,
          minimumPayment: d.minimumPayment,
          dueDay: d.dueDay
        })

      case ACTION_TYPES.RECORD_DEBT_PAYMENT: {
        const match = debtsStore.items.find(
          item => (item.name || '').toLowerCase() === (d.debtName || '').toLowerCase()
        )
        if (!match) throw new Error(`ไม่พบหนี้ชื่อ ${d.debtName}`)
        return debtsStore.recordPayment(match.id, d.amount)
      }

      case ACTION_TYPES.CREATE_SOCIAL_POST:
        return socialStore.createPost(d.content)

      default:
        throw new Error(`ไม่รองรับ action: ${action.type}`)
    }
  }

  async function executePlan(actions = []) {
    const results = []
    for (const action of actions) {
      results.push(await executeAction(action))
    }
    return results
  }

  return { executeAction, executePlan }
}
