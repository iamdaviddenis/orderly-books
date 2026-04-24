import { differenceInCalendarDays, endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns'
import type { AppState, IsoDate, MoneyTzs, Obligation, Tier, Transaction } from '../schema'
import { startOfWeekIso } from '../dates'
import { paidTowardObligation, remainingForObligation } from './obligationPayments'

export type AlertSeverity = 'critical' | 'warning' | 'growth' | 'info'
export type Alert = {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  cta?: { label: string; to: string }
}

export type DisciplineLocks = {
  tier3SpendingLocked: boolean
  tier4Locked: boolean
  reasons: string[]
}

export type Tier1Status = {
  dueTotalTzs: MoneyTzs
  paidTotalTzs: MoneyTzs
  remainingTzs: MoneyTzs
  overdue: Obligation[]
  dueSoon: Obligation[]
  nextDue?: Obligation
  isCompleteForCycle: boolean
}

export type SafeToSpend = {
  cashOnHandTzs: MoneyTzs
  reservedTier1Tzs: MoneyTzs
  reservedTier2Tzs: MoneyTzs
  reservedTier3Tzs: MoneyTzs
  safeToSpendTzs: MoneyTzs
}

export type FaithfulnessScore = {
  score: number
  breakdown: { tier1: number; tier2: number; tier3: number; reflections: number }
  note: string
}

export type DisciplineStatus = {
  nowIso: IsoDate
  tier1: Tier1Status
  locks: DisciplineLocks
  safeToSpend: SafeToSpend
  alerts: Alert[]
  faithfulness: FaithfulnessScore
}

function sumMoney(items: Array<{ amountTzs: MoneyTzs }>) {
  return items.reduce<MoneyTzs>((acc, x) => (acc + x.amountTzs) as MoneyTzs, 0 as MoneyTzs)
}

function withinDays(dueIso: IsoDate, now: Date, days: number) {
  const diff = differenceInCalendarDays(new Date(dueIso), now)
  return diff >= 0 && diff <= days
}

function isOverdue(dueIso: IsoDate, now: Date) {
  return differenceInCalendarDays(now, new Date(dueIso)) > 0
}

export function computeCashOnHandTzs(state: AppState): MoneyTzs {
  const income = state.transactions
    .filter((t) => t.kind === 'income')
    .reduce<MoneyTzs>((acc, t) => (acc + t.amountTzs) as MoneyTzs, 0 as MoneyTzs)
  const expense = state.transactions
    .filter((t) => t.kind === 'expense')
    .reduce<MoneyTzs>((acc, t) => (acc + t.amountTzs) as MoneyTzs, 0 as MoneyTzs)
  return (state.startingCashTzs + income - expense) as MoneyTzs
}

export function computeTier1Status(state: AppState, nowIso: IsoDate): Tier1Status {
  const now = new Date(nowIso)
  const cycleEnd = endOfMonth(now)
  const cycleObligations = state.obligations.filter((o) => new Date(o.dueDate) <= cycleEnd)

  const progress = cycleObligations.map((o) => ({
    o,
    paid: paidTowardObligation(state.transactions, o),
    remaining: remainingForObligation(state.transactions, o),
  }))

  const overdue = progress
    .filter((x) => x.remaining > 0)
    .map((x) => x.o)
    .filter((o) => isOverdue(o.dueDate, now))
  const dueSoon = state.obligations
    .filter((o) => remainingForObligation(state.transactions, o) > 0)
    .filter((o) => withinDays(o.dueDate, now, 3))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const pending = state.obligations.filter((o) => remainingForObligation(state.transactions, o) > 0)
  const nextDue = pending
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const dueTotalTzs = progress.reduce<MoneyTzs>((acc, x) => (acc + x.remaining) as MoneyTzs, 0 as MoneyTzs)
  const paidTotalTzs = progress.reduce<MoneyTzs>((acc, x) => (acc + x.paid) as MoneyTzs, 0 as MoneyTzs)
  const remainingTzs = dueTotalTzs

  return {
    dueTotalTzs,
    paidTotalTzs,
    remainingTzs,
    overdue,
    dueSoon,
    nextDue,
    isCompleteForCycle: dueTotalTzs === 0,
  }
}

function sumTransfersDueThisMonth(state: AppState, now: Date): MoneyTzs {
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const due = state.plannedTransfers.filter((t) => {
    if (t.paidAt) return false
    const dueDate = new Date(t.dueDate)
    return dueDate >= monthStart && dueDate <= monthEnd
  })
  return sumMoney(due)
}

function computeWeekBudget(state: AppState, weekStartIso: IsoDate): MoneyTzs {
  const wb = state.weekBudgets.find((w) => w.weekStart === weekStartIso)
  if (wb) return wb.limitTzs as MoneyTzs
  const fallback = state.weekBudgets
    .slice()
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0]?.limitTzs
  return (fallback ?? 230_000) as MoneyTzs
}

function sumTier3SpentThisWeek(state: AppState, weekStartIso: IsoDate, weekEndsOnIso: IsoDate): MoneyTzs {
  const start = new Date(weekStartIso)
  const end = new Date(weekEndsOnIso)
  const spent = state.transactions.filter((t) => {
    if (t.kind !== 'expense') return false
    if (t.tier !== 3) return false
    const d = new Date(t.date)
    return d >= start && d < end
  })
  return sumMoney(spent)
}

function computeLocks(tier1: Tier1Status, state: AppState, nowIso: IsoDate): DisciplineLocks {
  const reasons: string[] = []
  const now = new Date(nowIso)

  const hasTier1Overdue = tier1.overdue.length > 0
  const hasTier1Unpaid = !tier1.isCompleteForCycle

  // No hard locks (MVP discipline via reminders + friction instead of blocking).
  const tier3SpendingLocked = false
  const tier4Locked = false
  if (hasTier1Overdue || hasTier1Unpaid) {
    reasons.push('Tier 1 is still pending. Focus on clearing critical obligations first.')
  }

  // Guardrails for Tier 4 readiness (used for guidance only).
  const weekStart = startOfWeekIso(now, state.settings.weekStartsOn)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndIso = weekEnd.toISOString() as IsoDate
  const weeklyLimit = computeWeekBudget(state, weekStart)
  const tier3Spent = sumTier3SpentThisWeek(state, weekStart, weekEndIso)
  const tier3Over = tier3Spent > weeklyLimit && weeklyLimit > 0

  // Zero-based budget completeness (only enforced when income exists this month).
  const monthKey = format(now, 'yyyy-MM')
  const incomeThisMonth = state.transactions
    .filter((t) => t.kind === 'income' && isSameMonth(new Date(t.date), now))
    .reduce((acc, t) => acc + t.amountTzs, 0) as MoneyTzs
  const allocation = state.allocations.find((a) => a.month === monthKey)
  const allocatedTotal = allocation
    ? ((allocation.tier1Tzs + allocation.tier2Tzs + allocation.tier3Tzs + allocation.tier4Tzs) as MoneyTzs)
    : (0 as MoneyTzs)
  const unassigned = allocation ? ((allocation.incomeTzs - allocatedTotal) as MoneyTzs) : incomeThisMonth > 0 ? incomeThisMonth : (0 as MoneyTzs)
  const zeroBasedIncomplete = incomeThisMonth > 0 && (!allocation || unassigned !== 0)
  if (tier3Over) reasons.push('Tier 3 is over budget this week — tighten essentials before discretionary.')
  if (zeroBasedIncomplete) reasons.push('Monthly income is not fully assigned (zero-based budgeting) — assign before discretionary.')

  // Soft nudges (not locks) for Tier 2 happen in alerts.
  void now
  return { tier3SpendingLocked, tier4Locked, reasons }
}

function computeSafeToSpend(state: AppState, tier1: Tier1Status, nowIso: IsoDate): SafeToSpend {
  const now = new Date(nowIso)
  const cashOnHandTzs = computeCashOnHandTzs(state)
  const reservedTier1Tzs = tier1.remainingTzs
  const reservedTier2Tzs = sumTransfersDueThisMonth(state, now)

  const weekStartIso = startOfWeekIso(now, state.settings.weekStartsOn)
  const weekEnd = new Date(weekStartIso)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndIso = weekEnd.toISOString() as IsoDate
  const weekLimit = computeWeekBudget(state, weekStartIso)
  const tier3Spent = sumTier3SpentThisWeek(state, weekStartIso, weekEndIso)
  const reservedTier3Tzs = (weekLimit > tier3Spent ? (weekLimit - tier3Spent) : 0) as MoneyTzs

  const safeToSpendTzs = Math.max(
    0,
    cashOnHandTzs - reservedTier1Tzs - reservedTier2Tzs - reservedTier3Tzs,
  ) as MoneyTzs

  return {
    cashOnHandTzs,
    reservedTier1Tzs,
    reservedTier2Tzs,
    reservedTier3Tzs,
    safeToSpendTzs,
  }
}

function computeAlerts(state: AppState, tier1: Tier1Status, locks: DisciplineLocks, nowIso: IsoDate): Alert[] {
  const alerts: Alert[] = []
  const now = new Date(nowIso)

  if (tier1.overdue.length > 0) {
    const top = tier1.overdue.slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    alerts.push({
      id: 't1_overdue',
      severity: 'critical',
      title: 'Tier 1 Overdue',
      message: `${top.name} is overdue. Prioritize clearing Tier 1 and keep non-essential spending minimal.`,
      cta: { label: 'Open Tier 1', to: '/tier-1' },
    })
  } else if (tier1.dueSoon.length > 0) {
    const next = tier1.dueSoon[0]
    alerts.push({
      id: 't1_due_soon',
      severity: 'warning',
      title: 'Tier 1 Due Soon',
      message: `${next.name} is due within 3 days. Pay critical obligations first.`,
      cta: { label: 'Open Tier 1', to: '/tier-1' },
    })
  } else if (!tier1.isCompleteForCycle) {
    alerts.push({
      id: 't1_pending',
      severity: 'info',
      title: 'Tier 1 Pending',
      message: 'Tier 1 is not fully cleared yet. Keep your focus on critical obligations first.',
      cta: { label: 'Review Tier 1', to: '/tier-1' },
    })
  }

  const tier2Ready = tier1.isCompleteForCycle
  if (tier2Ready) {
    const dueThisMonth = state.plannedTransfers.filter((t) => {
      if (t.paidAt) return false
      return isSameMonth(new Date(t.dueDate), now)
    })
    if (dueThisMonth.length > 0) {
      alerts.push({
        id: 't2_ready',
        severity: 'growth',
        title: 'Tier 2 Ready',
        message: 'Tier 1 is clear. Your growth transfers are ready to process.',
        cta: { label: 'Open Tier 2', to: '/tier-2' },
      })
    }
  }
  void locks

  return alerts
}

function computeFaithfulness(state: AppState, tier1: Tier1Status, nowIso: IsoDate): FaithfulnessScore {
  const now = new Date(nowIso)

  // Tier 1: heavy penalty for overdue.
  let tier1Pts = 50
  if (tier1.overdue.length > 0) tier1Pts = 10
  else if (!tier1.isCompleteForCycle) tier1Pts = 30

  // Tier 2: % of planned transfers paid this month.
  const plannedThisMonth = state.plannedTransfers.filter((t) => isSameMonth(new Date(t.dueDate), now))
  const paidThisMonth = plannedThisMonth.filter((t) => Boolean(t.paidAt))
  const ratio = plannedThisMonth.length === 0 ? 1 : paidThisMonth.length / plannedThisMonth.length
  const tier2Pts = Math.round(20 * ratio)

  // Tier 3: weekly budget adherence.
  const weekStartIso = startOfWeekIso(now, state.settings.weekStartsOn)
  const weekEnd = new Date(weekStartIso)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndIso = weekEnd.toISOString() as IsoDate
  const weekLimit = computeWeekBudget(state, weekStartIso)
  const tier3Spent = sumTier3SpentThisWeek(state, weekStartIso, weekEndIso)

  let tier3Pts = 20
  if (weekLimit > 0) {
    if (tier3Spent > weekLimit) tier3Pts = 8
    else if (tier3Spent > 0.9 * weekLimit) tier3Pts = 14
  }

  // Reflections: last 7 + last 30 days.
  const weeklyDone = state.reflections.some((r) => r.cadence === 'weekly' && differenceInCalendarDays(now, new Date(r.at)) <= 7)
  const monthlyDone = state.reflections.some((r) => r.cadence === 'monthly' && differenceInCalendarDays(now, new Date(r.at)) <= 30)
  const reflectionsPts = (weeklyDone ? 5 : 0) + (monthlyDone ? 5 : 0)

  const score = Math.max(0, Math.min(100, tier1Pts + tier2Pts + tier3Pts + reflectionsPts))
  const note =
    score >= 90
      ? 'Strong discipline. Keep the momentum.'
      : score >= 70
        ? 'Good foundation. Tighten the next weak spot.'
        : 'Focus on clearing Tier 1 and stabilizing weekly spending.'

  return { score, breakdown: { tier1: tier1Pts, tier2: tier2Pts, tier3: tier3Pts, reflections: reflectionsPts }, note }
}

export function computeDisciplineStatus(state: AppState, nowIso: IsoDate): DisciplineStatus {
  const tier1 = computeTier1Status(state, nowIso)
  const locks = computeLocks(tier1, state, nowIso)
  const safeToSpend = computeSafeToSpend(state, tier1, nowIso)
  const alerts = computeAlerts(state, tier1, locks, nowIso)
  const faithfulness = computeFaithfulness(state, tier1, nowIso)
  return { nowIso, tier1, locks, safeToSpend, alerts, faithfulness }
}

export function canAddTransaction(
  _status: DisciplineStatus,
  tx: Pick<Transaction, 'tier' | 'kind'>,
): { ok: true } | { ok: false; reason: string } {
  if (tx.kind !== 'expense') return { ok: true }
  // No hard locks: allow spending, but use reminders + UI friction.
  return { ok: true }
}

export function defaultTierForCategory(categoryTierHint?: Tier): Tier {
  return categoryTierHint ?? 3
}
