import type { IsoDate, MoneyTzs, Obligation, Transaction } from '../schema'
import { previousDueDate } from '../dates'

function obligationCycleStartIso(obligation: Obligation): IsoDate | undefined {
  if (obligation.lastClearedAt) return obligation.lastClearedAt
  if (obligation.recurrence === 'one_time') return undefined
  // Use the previous due date as the start of the current accumulation window.
  // If the obligation gets advanced on full payment, its new cycle start becomes the old due date.
  return previousDueDate(obligation.dueDate, obligation.recurrence)
}

export function sumPaymentsTowardObligation(transactions: Transaction[], obligation: Obligation): MoneyTzs {
  const startIso = obligationCycleStartIso(obligation)
  const startMs = startIso ? new Date(startIso).getTime() : undefined
  const useExclusiveStart = Boolean(obligation.lastClearedAt)

  return transactions
    .filter((t) => t.kind === 'expense' && t.tier === 1 && t.linked?.type === 'obligation' && t.linked.id === obligation.id)
    .filter((t) => {
      if (!startMs) return true
      const ms = new Date(t.date).getTime()
      return useExclusiveStart ? ms > startMs : ms >= startMs
    })
    .reduce<MoneyTzs>((acc, t) => (acc + t.amountTzs) as MoneyTzs, 0 as MoneyTzs)
}

export function paidTowardObligation(transactions: Transaction[], obligation: Obligation): MoneyTzs {
  if (obligation.paidAt) return obligation.amountTzs as MoneyTzs
  const paid = sumPaymentsTowardObligation(transactions, obligation)
  return Math.min(obligation.amountTzs, paid) as MoneyTzs
}

export function remainingForObligation(transactions: Transaction[], obligation: Obligation): MoneyTzs {
  if (obligation.paidAt) return 0 as MoneyTzs
  const paid = paidTowardObligation(transactions, obligation)
  return Math.max(0, obligation.amountTzs - paid) as MoneyTzs
}
