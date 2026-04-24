/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useReducer } from 'react'
import type {
  Allocation,
  AppState,
  Category,
  Comment,
  CurrencyCode,
  Goal,
  IsoDate,
  MoneyTzs,
  NetWorth,
  Obligation,
  PlannedTransfer,
  ShoppingTemplateItem,
  WorthItem,
  WorthSnapshot,
  Tier,
  Transaction,
} from '../domain/schema'
import { loadState, saveState } from '../data/storage'
import { computeDisciplineStatus, canAddTransaction } from '../domain/engine/disciplineEngine'
import { sumPaymentsTowardObligation } from '../domain/engine/obligationPayments'
import { newId } from '../domain/ids'
import { isoNow, nextDueDate, previousDueDate, startOfWeekIso } from '../domain/dates'
import { autoCategorize, learnCategorizationOverride } from '../domain/services/categorize'
import { isSupabaseEnabled } from '../data/supabaseClient'
import { fetchRemoteUserState, upsertRemoteUserState } from '../data/supabaseState'
import { useAuth } from './auth'

type CloudSyncStatus = 'disabled' | 'signed_out' | 'loading' | 'syncing' | 'ready' | 'error'
export type CloudSync = {
  enabled: boolean
  status: CloudSyncStatus
  userId?: string
  userEmail?: string
  lastSyncedAt?: IsoDate
  lastError?: string
}

type AppAction =
  | { type: 'hydrate'; state: AppState }
  | { type: 'set_starting_cash'; amountTzs: MoneyTzs }
  | { type: 'set_strict_tier1_gate'; enabled: boolean }
  | { type: 'set_read_only_mode'; enabled: boolean }
  | { type: 'set_net_worth'; netWorth: NetWorth }
  | { type: 'set_allocation'; allocation: Allocation }
  | { type: 'add_obligation'; obligation: Obligation }
  | { type: 'update_obligation'; obligation: Obligation }
  | { type: 'delete_obligation'; id: string }
  | { type: 'mark_obligation_paid'; id: string; paidAt: IsoDate }
  | { type: 'record_obligation_payment'; id: string; at: IsoDate; amountTzs: MoneyTzs }
  | { type: 'void_obligation_payment'; obligationId: string; txId: string }
  | { type: 'add_transfer'; transfer: PlannedTransfer }
  | { type: 'update_transfer'; transfer: PlannedTransfer }
  | { type: 'delete_transfer'; id: string }
  | { type: 'mark_transfer_paid'; id: string; paidAt: IsoDate }
  | { type: 'skip_transfer'; id: string; at: IsoDate; reason: string }
  | { type: 'void_transfer_payment'; transferId: string; txId: string }
  | { type: 'set_week_budget'; weekStart: IsoDate; limitTzs: MoneyTzs }
  | { type: 'sync_shopping_week_from_template'; weekStart: IsoDate }
  | { type: 'add_shopping_template_item'; item: ShoppingTemplateItem }
  | { type: 'update_shopping_template_item'; item: ShoppingTemplateItem }
  | { type: 'delete_shopping_template_item'; id: string }
  | { type: 'toggle_shopping_item'; weekStart: IsoDate; itemId: string; purchased: boolean }
  | { type: 'set_shopping_item_actual'; weekStart: IsoDate; itemId: string; actualTzs: MoneyTzs | undefined }
  | { type: 'add_worth_item'; item: WorthItem; initialSnapshot?: WorthSnapshot }
  | { type: 'update_worth_item'; item: WorthItem }
  | { type: 'delete_worth_item'; id: string }
  | { type: 'add_worth_snapshot'; snapshot: WorthSnapshot }
  | { type: 'delete_worth_snapshot'; id: string }
  | { type: 'add_goal'; goal: Goal }
  | { type: 'update_goal'; goal: Goal }
  | { type: 'delete_goal'; id: string }
  | { type: 'add_transaction'; tx: Transaction; learn?: { payee: string; categoryId: string; tier?: Tier } }
  | { type: 'update_transaction'; tx: Transaction }
  | { type: 'delete_transaction'; id: string }
  | { type: 'add_reflection'; cadence: 'weekly' | 'monthly'; text: string; at: IsoDate }
  | { type: 'add_comment'; comment: Comment }

function normalizeState(next: AppState): AppState {
  let out = next

  const defaultCategories: Category[] = [
    { id: 'cat_birthdays', name: 'Birthdays & Gifts', tierHint: 4 },
    { id: 'cat_travel', name: 'Travel & Vacations', tierHint: 4 },
    { id: 'cat_entertain', name: 'Entertainment', tierHint: 4 },
    { id: 'cat_home_upgrades', name: 'Home Upgrades', tierHint: 4 },
  ]
  const existingCategoryIds = new Set(out.categories.map((c) => c.id))
  const missingCategories = defaultCategories.filter((c) => !existingCategoryIds.has(c.id))
  if (missingCategories.length > 0) {
    out = { ...out, categories: [...out.categories, ...missingCategories] }
  }

  if (out.shoppingTemplate.length === 0) {
    const seen = new Set<string>()
    const derived: ShoppingTemplateItem[] = []
    for (const w of out.shoppingWeeks) {
      for (const it of w.items) {
        if (seen.has(it.id)) continue
        seen.add(it.id)
        derived.push({
          id: it.id,
          group: it.group,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          estimatedTzs: it.estimatedTzs ?? 0,
          notes: it.notes,
        })
      }
    }
    if (derived.length > 0) {
      out = { ...out, shoppingTemplate: derived }
    }
  }

  return out
}

function reducer(state: AppState, action: AppAction): AppState {
  if (
    state.settings.readOnlyMode &&
    action.type !== 'hydrate' &&
    action.type !== 'add_comment' &&
    action.type !== 'set_read_only_mode'
  ) {
    return state
  }
  switch (action.type) {
    case 'hydrate':
      return normalizeState(action.state)
    case 'set_starting_cash':
      return { ...state, startingCashTzs: action.amountTzs, updatedAt: isoNow() }
    case 'set_strict_tier1_gate':
      return { ...state, settings: { ...state.settings, strictTier1Gate: action.enabled }, updatedAt: isoNow() }
    case 'set_read_only_mode':
      return { ...state, settings: { ...state.settings, readOnlyMode: action.enabled }, updatedAt: isoNow() }
    case 'set_net_worth':
      return { ...state, netWorth: action.netWorth, updatedAt: isoNow() }
    case 'set_allocation': {
      const allocations = state.allocations.some((a) => a.month === action.allocation.month)
        ? state.allocations.map((a) => (a.month === action.allocation.month ? action.allocation : a))
        : [action.allocation, ...state.allocations]
      return { ...state, allocations, updatedAt: isoNow() }
    }
    case 'add_obligation':
      return { ...state, obligations: [action.obligation, ...state.obligations], updatedAt: isoNow() }
    case 'update_obligation':
      return {
        ...state,
        obligations: state.obligations.map((o) => (o.id === action.obligation.id ? action.obligation : o)),
        updatedAt: isoNow(),
      }
    case 'delete_obligation':
      return { ...state, obligations: state.obligations.filter((o) => o.id !== action.id), updatedAt: isoNow() }
    case 'mark_obligation_paid': {
      const o = state.obligations.find((x) => x.id === action.id)
      if (!o) return state
      const tx: Transaction = {
        id: newId('tx'),
        kind: 'expense',
        tier: 1,
        date: action.paidAt,
        amountTzs: o.amountTzs,
        payee: o.name,
        categoryId: o.name.toLowerCase().includes('rent') ? 'cat_rent' : 'cat_loans',
        linked: { type: 'obligation', id: o.id },
      }
      const updated: Obligation = { ...o, paidAt: action.paidAt, lastClearedAt: action.paidAt, lastClearedPaymentId: tx.id }
      const obligations = state.obligations.map((x) => (x.id === updated.id ? updated : x))
      // Advance due date for recurring obligations.
      const advanced = obligations.map((x) => {
        if (x.id !== updated.id) return x
        if (x.recurrence === 'one_time') return x
        return { ...x, paidAt: undefined, dueDate: nextDueDate(x.dueDate, x.recurrence) }
      })
      return { ...state, obligations: advanced, transactions: [tx, ...state.transactions], updatedAt: isoNow() }
    }
    case 'record_obligation_payment': {
      const o = state.obligations.find((x) => x.id === action.id)
      if (!o) return state
      if (o.recurrence === 'one_time' && o.paidAt) return state
      if (action.amountTzs <= 0) return state

      const tx: Transaction = {
        id: newId('tx'),
        kind: 'expense',
        tier: 1,
        date: action.at,
        amountTzs: action.amountTzs,
        payee: o.name,
        categoryId: o.name.toLowerCase().includes('rent') ? 'cat_rent' : 'cat_loans',
        linked: { type: 'obligation', id: o.id },
      }

      const nextTransactions = [tx, ...state.transactions]
      const totalPaid = sumPaymentsTowardObligation(nextTransactions, o)
      const isFullyPaid = totalPaid >= o.amountTzs

      const obligations = state.obligations.map((x) => {
        if (x.id !== o.id) return x
        if (!isFullyPaid) return x
        if (x.recurrence === 'one_time') return { ...x, paidAt: action.at, lastClearedAt: action.at, lastClearedPaymentId: tx.id }
        return {
          ...x,
          paidAt: undefined,
          lastClearedAt: action.at,
          lastClearedPaymentId: tx.id,
          dueDate: nextDueDate(x.dueDate, x.recurrence),
        }
      })

      return { ...state, obligations, transactions: nextTransactions, updatedAt: isoNow() }
    }
    case 'void_obligation_payment': {
      const tx = state.transactions.find((t) => t.id === action.txId)
      if (!tx) return state
      if (tx.kind !== 'expense' || tx.tier !== 1) return state
      if (tx.linked?.type !== 'obligation' || tx.linked.id !== action.obligationId) return state

      const transactions = state.transactions.filter((x) => x.id !== action.txId)
      const o = state.obligations.find((x) => x.id === action.obligationId)
      if (!o) return { ...state, transactions, updatedAt: isoNow() }

      // MVP safety rule:
      // Only roll back the obligation cycle when voiding the *clearing* payment.
      // Otherwise, we just remove the transaction (partial payment removal).
      const shouldRollbackCycle = o.lastClearedPaymentId === action.txId

      const obligations = state.obligations.map((x) => {
        if (x.id !== o.id) return x
        if (!shouldRollbackCycle) return x
        if (x.recurrence === 'one_time') {
          return { ...x, paidAt: undefined, lastClearedAt: undefined, lastClearedPaymentId: undefined }
        }
        return {
          ...x,
          paidAt: undefined,
          lastClearedAt: undefined,
          lastClearedPaymentId: undefined,
          dueDate: previousDueDate(x.dueDate, x.recurrence),
        }
      })

      return { ...state, obligations, transactions, updatedAt: isoNow() }
    }
    case 'add_transfer':
      return { ...state, plannedTransfers: [action.transfer, ...state.plannedTransfers], updatedAt: isoNow() }
    case 'update_transfer':
      return {
        ...state,
        plannedTransfers: state.plannedTransfers.map((t) => (t.id === action.transfer.id ? action.transfer : t)),
        updatedAt: isoNow(),
      }
    case 'delete_transfer':
      return { ...state, plannedTransfers: state.plannedTransfers.filter((t) => t.id !== action.id), updatedAt: isoNow() }
    case 'mark_transfer_paid': {
      const t = state.plannedTransfers.find((x) => x.id === action.id)
      if (!t) return state
      const updated: PlannedTransfer = { ...t, paidAt: action.paidAt }
      const tx: Transaction = {
        id: newId('tx'),
        kind: 'expense',
        tier: 2,
        date: action.paidAt,
        amountTzs: t.amountTzs,
        payee: t.name,
        categoryId: 'cat_invest',
        linked: { type: 'transfer', id: t.id },
      }
      const transfers = state.plannedTransfers.map((x) => (x.id === updated.id ? updated : x))
      const advanced = transfers.map((x) => {
        if (x.id !== updated.id) return x
        if (x.recurrence === 'one_time') return x
        return { ...x, paidAt: undefined, dueDate: nextDueDate(x.dueDate, x.recurrence) }
      })
      return { ...state, plannedTransfers: advanced, transactions: [tx, ...state.transactions], updatedAt: isoNow() }
    }
    case 'void_transfer_payment': {
      const tx = state.transactions.find((t) => t.id === action.txId)
      if (!tx) return state
      if (tx.kind !== 'expense' || tx.tier !== 2) return state
      if (tx.linked?.type !== 'transfer' || tx.linked.id !== action.transferId) return state

      const t = state.plannedTransfers.find((x) => x.id === action.transferId)
      const transactions = state.transactions.filter((x) => x.id !== action.txId)
      if (!t) return { ...state, transactions, updatedAt: isoNow() }

      const plannedTransfers = state.plannedTransfers.map((x) => {
        if (x.id !== t.id) return x
        if (x.recurrence === 'one_time') return { ...x, paidAt: undefined }
        return { ...x, paidAt: undefined, dueDate: previousDueDate(x.dueDate, x.recurrence) }
      })
      return { ...state, plannedTransfers, transactions, updatedAt: isoNow() }
    }
    case 'skip_transfer': {
      const transfers = state.plannedTransfers.map((t) => {
        if (t.id !== action.id) return t
        return { ...t, skipLog: [{ at: action.at, reason: action.reason }, ...(t.skipLog ?? [])] }
      })
      return {
        ...state,
        plannedTransfers: transfers,
        auditLog: [{ id: newId('audit'), at: action.at, type: 'skip_transfer', message: action.reason }, ...state.auditLog],
        updatedAt: isoNow(),
      }
    }
    case 'set_week_budget': {
      const found = state.weekBudgets.find((w) => w.weekStart === action.weekStart)
      const weekBudgets = found
        ? state.weekBudgets.map((w) => (w.weekStart === action.weekStart ? { ...w, limitTzs: action.limitTzs } : w))
        : [{ weekStart: action.weekStart, limitTzs: action.limitTzs }, ...state.weekBudgets]
      return {
        ...state,
        weekBudgets,
        auditLog: [
          { id: newId('audit'), at: isoNow(), type: 'edit_budget', message: `Weekly budget set to ${action.limitTzs} TZS.` },
          ...state.auditLog,
        ],
        updatedAt: isoNow(),
      }
    }
    case 'sync_shopping_week_from_template': {
      const existing = state.shoppingWeeks.find((w) => w.weekStart === action.weekStart)
      const templateById = new Map(state.shoppingTemplate.map((i) => [i.id, i]))

      const nextItemsFromTemplate = state.shoppingTemplate.map((tpl) => {
        const found = existing?.items.find((x) => x.id === tpl.id)
        if (!found) {
          return {
            id: tpl.id,
            group: tpl.group,
            name: tpl.name,
            qty: tpl.qty,
            unit: tpl.unit,
            estimatedTzs: tpl.estimatedTzs,
            purchased: false,
            notes: tpl.notes,
          }
        }
        return {
          ...found,
          group: tpl.group,
          name: tpl.name,
          qty: tpl.qty,
          unit: tpl.unit,
          estimatedTzs: tpl.estimatedTzs,
          notes: tpl.notes,
        }
      })

      const extra = existing ? existing.items.filter((x) => !templateById.has(x.id)) : []
      const nextWeek = { weekStart: action.weekStart, items: [...nextItemsFromTemplate, ...extra] }

      const shoppingWeeks = existing
        ? state.shoppingWeeks.map((w) => (w.weekStart === action.weekStart ? nextWeek : w))
        : [nextWeek, ...state.shoppingWeeks]
      return { ...state, shoppingWeeks, updatedAt: isoNow() }
    }
    case 'add_shopping_template_item': {
      const shoppingTemplate = [action.item, ...state.shoppingTemplate]
      return { ...state, shoppingTemplate, updatedAt: isoNow() }
    }
    case 'update_shopping_template_item': {
      const shoppingTemplate = state.shoppingTemplate.map((i) => (i.id === action.item.id ? action.item : i))
      const shoppingWeeks = state.shoppingWeeks.map((w) => ({
        ...w,
        items: w.items.map((it) =>
          it.id === action.item.id
            ? {
                ...it,
                group: action.item.group,
                name: action.item.name,
                qty: action.item.qty,
                unit: action.item.unit,
                estimatedTzs: action.item.estimatedTzs,
                notes: action.item.notes,
              }
            : it,
        ),
      }))
      return { ...state, shoppingTemplate, shoppingWeeks, updatedAt: isoNow() }
    }
    case 'delete_shopping_template_item': {
      const shoppingTemplate = state.shoppingTemplate.filter((i) => i.id !== action.id)
      const shoppingWeeks = state.shoppingWeeks.map((w) => ({ ...w, items: w.items.filter((i) => i.id !== action.id) }))
      return { ...state, shoppingTemplate, shoppingWeeks, updatedAt: isoNow() }
    }
    case 'toggle_shopping_item': {
      const shoppingWeeks = state.shoppingWeeks.map((w) => {
        if (w.weekStart !== action.weekStart) return w
        return { ...w, items: w.items.map((i) => (i.id === action.itemId ? { ...i, purchased: action.purchased } : i)) }
      })
      return { ...state, shoppingWeeks, updatedAt: isoNow() }
    }
    case 'set_shopping_item_actual': {
      const shoppingWeeks = state.shoppingWeeks.map((w) => {
        if (w.weekStart !== action.weekStart) return w
        return {
          ...w,
          items: w.items.map((i) => (i.id === action.itemId ? { ...i, actualTzs: action.actualTzs } : i)),
        }
      })
      return { ...state, shoppingWeeks, updatedAt: isoNow() }
    }
    case 'add_worth_item': {
      const worthItems = [action.item, ...state.worthItems]
      const worthSnapshots = action.initialSnapshot ? [action.initialSnapshot, ...state.worthSnapshots] : state.worthSnapshots
      return { ...state, worthItems, worthSnapshots, updatedAt: isoNow() }
    }
    case 'update_worth_item': {
      const worthItems = state.worthItems.map((i) => (i.id === action.item.id ? action.item : i))
      return { ...state, worthItems, updatedAt: isoNow() }
    }
    case 'delete_worth_item': {
      const worthItems = state.worthItems.filter((i) => i.id !== action.id)
      const worthSnapshots = state.worthSnapshots.filter((s) => s.itemId !== action.id)
      return { ...state, worthItems, worthSnapshots, updatedAt: isoNow() }
    }
    case 'add_worth_snapshot': {
      const worthSnapshots = [action.snapshot, ...state.worthSnapshots]
      return { ...state, worthSnapshots, updatedAt: isoNow() }
    }
    case 'delete_worth_snapshot': {
      const worthSnapshots = state.worthSnapshots.filter((s) => s.id !== action.id)
      return { ...state, worthSnapshots, updatedAt: isoNow() }
    }
    case 'add_goal':
      return { ...state, goals: [action.goal, ...state.goals], updatedAt: isoNow() }
    case 'update_goal':
      return { ...state, goals: state.goals.map((g) => (g.id === action.goal.id ? action.goal : g)), updatedAt: isoNow() }
    case 'delete_goal':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id), updatedAt: isoNow() }
    case 'add_transaction': {
      const next = { ...state, transactions: [action.tx, ...state.transactions], updatedAt: isoNow() }
      if (action.learn) {
        const rule = learnCategorizationOverride(action.learn.payee, action.learn.categoryId, action.learn.tier)
        return { ...next, categorizationRules: [rule, ...next.categorizationRules] }
      }
      return next
    }
    case 'update_transaction': {
      if (!state.transactions.some((t) => t.id === action.tx.id)) return state
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)), updatedAt: isoNow() }
    }
    case 'delete_transaction':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id), updatedAt: isoNow() }
    case 'add_reflection': {
      const entry = { id: newId('ref'), at: action.at, cadence: action.cadence, text: action.text }
      return {
        ...state,
        reflections: [entry, ...state.reflections],
        auditLog: [{ id: newId('audit'), at: action.at, type: 'reflection', message: `${action.cadence} reflection logged.` }, ...state.auditLog],
        updatedAt: isoNow(),
      }
    }
    case 'add_comment':
      return { ...state, comments: [action.comment, ...state.comments], updatedAt: isoNow() }
  }
}

type AppContextValue = {
  state: AppState
  nowIso: IsoDate
  status: ReturnType<typeof computeDisciplineStatus>
  cloud: CloudSync
  dispatch: React.Dispatch<AppAction>

  actions: {
    addQuickExpense: (input: {
      payee: string
      amountTzs: number
      tier: 3 | 4
      dateIso?: IsoDate
      categoryId?: string
      notes?: string
      goalId?: string
      currency?: CurrencyCode
    }) => {
      ok: true
    } | { ok: false; reason: string }
    addComment: (input: { author: string; message: string; relatedTo?: { type: 'obligation' | 'transfer' | 'transaction'; id: string } }) => { ok: true } | { ok: false; reason: string }
  }
}

const AppContext = createContext<AppContextValue | null>(null)

function makeNowIso() {
  return new Date().toISOString() as IsoDate
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const load = useMemo(() => loadState(), [])
  const [state, dispatch] = useReducer(reducer, normalizeState(load.state))
  const auth = useAuth()
  const userId = auth.user?.id
  const userEmail = auth.user?.email

  const [cloud, setCloud] = React.useState<CloudSync>(() => {
    if (!isSupabaseEnabled) return { enabled: false, status: 'disabled' }
    return { enabled: true, status: 'signed_out' }
  })
  const cloudStatusRef = React.useRef<CloudSyncStatus>(cloud.status)
  React.useEffect(() => {
    cloudStatusRef.current = cloud.status
  }, [cloud.status])
  const initialSyncDoneRef = React.useRef<boolean>(false)

  const [nowIso, setNowIso] = React.useState<IsoDate>(() => makeNowIso())
  React.useEffect(() => {
    const id = window.setInterval(() => setNowIso(makeNowIso()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const status = useMemo(() => computeDisciplineStatus(state, nowIso), [state, nowIso])

  const initialSyncForUser = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      setCloud({ enabled: false, status: 'disabled' })
      initialSyncForUser.current = null
      initialSyncDoneRef.current = false
      return
    }
    if (auth.loading) {
      setCloud((c) => ({ ...c, enabled: true, status: 'loading' }))
      return
    }
    if (!userId) {
      setCloud({ enabled: true, status: 'signed_out' })
      initialSyncForUser.current = null
      initialSyncDoneRef.current = false
      return
    }
    if (initialSyncForUser.current === userId && initialSyncDoneRef.current) return
    initialSyncForUser.current = userId
    initialSyncDoneRef.current = false

    let cancelled = false
    ;(async () => {
      try {
        setCloud({ enabled: true, status: 'loading', userId, userEmail })

        const remote = await fetchRemoteUserState(userId)
        if (cancelled) return

        if (remote) {
          const remoteMs = new Date(remote.state.updatedAt).getTime()
          const localMs = new Date(state.updatedAt).getTime()
          if (remoteMs > localMs) {
            dispatch({ type: 'hydrate', state: remote.state })
            saveState(remote.state)
          } else if (localMs > remoteMs) {
            await upsertRemoteUserState(userId, state)
          }
        } else {
          await upsertRemoteUserState(userId, state)
        }

        if (cancelled) return
        initialSyncDoneRef.current = true
        setCloud({ enabled: true, status: 'ready', userId, userEmail, lastSyncedAt: isoNow() })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Cloud sync failed.'
        initialSyncDoneRef.current = true
        setCloud({ enabled: true, status: 'error', userId, userEmail, lastError: msg })
      }
    })()

    return () => {
      cancelled = true
    }
    // Intentionally exclude `state` to avoid re-running initial sync for normal edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, userId, userEmail])

  React.useEffect(() => {
    saveState(state)
  }, [state])

  // Create this week's shopping checklist from the reusable template (after cloud init).
  React.useEffect(() => {
    if (state.shoppingTemplate.length === 0) return
    if (isSupabaseEnabled && userId && cloud.status !== 'ready') return
    const now = new Date(nowIso)
    const weekStart = startOfWeekIso(now, state.settings.weekStartsOn)
    const exists = state.shoppingWeeks.some((w) => w.weekStart === weekStart)
    if (exists) return
    dispatch({ type: 'sync_shopping_week_from_template', weekStart })
  }, [cloud.status, nowIso, state.settings.weekStartsOn, state.shoppingTemplate.length, state.shoppingWeeks, userId])

  React.useEffect(() => {
    if (!isSupabaseEnabled || !userId) return
    if (!initialSyncDoneRef.current) return
    if (cloudStatusRef.current === 'loading') return

    setCloud((c) => (c.enabled ? { ...c, status: c.status === 'ready' ? 'syncing' : c.status } : c))
    const id = window.setTimeout(async () => {
      try {
        await upsertRemoteUserState(userId, state)
        setCloud((c) => ({ ...c, enabled: true, status: 'ready', userId, userEmail, lastSyncedAt: isoNow(), lastError: undefined }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Cloud save failed.'
        setCloud((c) => ({ ...c, enabled: true, status: 'error', userId, userEmail, lastError: msg }))
      }
    }, 800)
    return () => window.clearTimeout(id)
  }, [state, userId, userEmail])

  const actions = useMemo<AppContextValue['actions']>(() => {
    return {
      addQuickExpense: (input) => {
        if (state.settings.readOnlyMode) return { ok: false, reason: 'Read-only mode is enabled.' }
        const payee = input.payee.trim()
        if (!payee) return { ok: false, reason: 'Payee is required.' }
        const amountTzs = Math.max(0, Math.trunc(input.amountTzs)) as MoneyTzs
        if (amountTzs <= 0) return { ok: false, reason: 'Amount must be greater than 0.' }

        if (input.goalId) {
          const goal = state.goals.find((g) => g.id === input.goalId)
          if (!goal) return { ok: false, reason: 'Selected goal no longer exists.' }
          if (goal.tier !== input.tier) return { ok: false, reason: 'Goal tier does not match this transaction tier.' }
        }

        if (input.tier === 4 && state.settings.strictTier1Gate && !status.tier1.isCompleteForCycle) {
          const ok = window.confirm('Tier 1 is still pending. Discretionary spending is last. Do you want to log this Tier 4 expense anyway?')
          if (!ok) return { ok: false, reason: 'Cancelled. Keep focus on Tier 1.' }
        }

        const auto = input.categoryId ? null : autoCategorize(state, payee)
        const categoryId = input.categoryId ?? auto?.categoryId ?? 'cat_discretion'
        const tier: Tier = input.tier

        const tx: Transaction = {
          id: newId('tx'),
          kind: 'expense',
          tier,
          date: input.dateIso ?? isoNow(),
          amountTzs,
          payee,
          categoryId,
          notes: input.notes?.trim() ? input.notes.trim() : undefined,
          goalId: input.goalId,
        }

        const allowed = canAddTransaction(status, tx)
        if (!allowed.ok) return allowed

        dispatch({
          type: 'add_transaction',
          tx,
          learn: { payee, categoryId, tier: auto?.tier ?? undefined },
        })
        return { ok: true }
      },
      addComment: (input) => {
        const author = input.author.trim()
        const message = input.message.trim()
        if (!author) return { ok: false, reason: 'Author is required.' }
        if (message.length < 2) return { ok: false, reason: 'Comment is too short.' }
        dispatch({
          type: 'add_comment',
          comment: { id: newId('cmt'), at: isoNow(), author, message, relatedTo: input.relatedTo },
        })
        return { ok: true }
      },
    }
  }, [state, status])

  const value = useMemo<AppContextValue>(() => ({ state, nowIso, status, cloud, dispatch, actions }), [state, nowIso, status, cloud, actions])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
