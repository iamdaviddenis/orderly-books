import { differenceInDays } from 'date-fns'
import type { Transaction } from '../schema'

export type RecurringCadence = 'weekly' | 'monthly'

export type RecurringCandidate = {
  key: string
  payee: string
  amountTzs: number
  cadence: RecurringCadence
  occurrences: number
  lastDate: string
}

function normalizePayee(payee: string) {
  return payee
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectRecurringCandidates(transactions: Transaction[]): RecurringCandidate[] {
  const expenses = transactions.filter((t) => t.kind === 'expense')
  const groups = new Map<string, Transaction[]>()

  for (const t of expenses) {
    const key = `${normalizePayee(t.payee)}|${t.amountTzs}`
    const arr = groups.get(key) ?? []
    arr.push(t)
    groups.set(key, arr)
  }

  const candidates: RecurringCandidate[] = []
  for (const [key, tx] of groups.entries()) {
    if (tx.length < 2) continue
    const sorted = tx.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const intervals = []
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(differenceInDays(new Date(sorted[i].date), new Date(sorted[i - 1].date)))
    }
    const hasMonthly = intervals.some((d) => d >= 26 && d <= 35)
    const hasWeekly = intervals.some((d) => d >= 6 && d <= 8)
    const cadence = hasMonthly ? 'monthly' : hasWeekly ? 'weekly' : null
    if (!cadence) continue
    candidates.push({
      key,
      payee: sorted[sorted.length - 1].payee,
      amountTzs: sorted[sorted.length - 1].amountTzs,
      cadence,
      occurrences: sorted.length,
      lastDate: sorted[sorted.length - 1].date,
    })
  }

  return candidates.sort((a, b) => b.occurrences - a.occurrences).slice(0, 6)
}

