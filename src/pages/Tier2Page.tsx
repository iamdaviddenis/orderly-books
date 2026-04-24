import { format, startOfYear, subMonths, subYears } from 'date-fns'
import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import { isoNow } from '../domain/dates'
import { formatTzs } from '../domain/money'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input, TextArea } from '../ui/components/Input'
import type { CurrencyCode, PlannedTransfer, Recurrence, WorthItem, WorthItemKind, WorthSnapshot } from '../domain/schema'
import { newId } from '../domain/ids'
import { GoalsPanel } from '../ui/GoalsPanel'

export function Tier2Page() {
  const { state, status, dispatch } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const nowIso = status.nowIso

  const { unpaid, paid, latestPaymentIsoById } = useMemo(() => {
    const now = new Date(nowIso)
    const paidWindowDays = 45
    const recentPaidIds = new Set<string>()
    const latestPaymentIsoById = new Map<string, string>()

    for (const t of state.transactions) {
      if (t.kind !== 'expense') continue
      if (t.tier !== 2) continue
      if (t.linked?.type !== 'transfer') continue
      const id = t.linked.id
      if (!latestPaymentIsoById.has(id)) latestPaymentIsoById.set(id, t.date)
      const diffDays = Math.floor((now.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays <= paidWindowDays) recentPaidIds.add(id)
    }

    const sorted = state.plannedTransfers
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    const unpaid: typeof sorted = []
    const paid: typeof sorted = []
    for (const tr of sorted) {
      const isPaid = Boolean(tr.paidAt) || recentPaidIds.has(tr.id)
      if (isPaid) paid.push(tr)
      else unpaid.push(tr)
    }
    return { unpaid, paid, latestPaymentIsoById }
  }, [state.plannedTransfers, state.transactions, nowIso])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-text">Tier 2 — Investments & fixed savings</div>
          <div className="mt-1 text-sm text-muted">These happen after Tier 1 and before lifestyle spending.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status.tier1.isCompleteForCycle ? 'growth' : 'locked'}>
            {status.tier1.isCompleteForCycle ? 'Ready' : 'Waiting for Tier 1'}
          </Badge>
          <Button variant="secondary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : 'Add transfer'}
          </Button>
        </div>
      </div>

      {!status.tier1.isCompleteForCycle ? (
        <Card className="border-t1/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge tone="critical">Discipline gate</Badge>
              <div className="text-sm font-semibold text-text">Clear Tier 1 first</div>
            </div>
            <div className="mt-1 text-sm text-muted">Tier 2 can be planned anytime, but should be executed after Tier 1.</div>
          </CardHeader>
        </Card>
      ) : null}

      <WorthTracker
        nowIso={nowIso}
        currencyDefault={state.settings.currency}
        items={state.worthItems}
        snapshots={state.worthSnapshots}
        readOnly={state.settings.readOnlyMode}
        dispatch={dispatch}
      />

      {showAdd ? (
        <AddTransferCard
          onAdd={(t) => {
            dispatch({ type: 'add_transfer', transfer: t })
            setShowAdd(false)
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {unpaid.length > 0 ? <div className="text-xs font-semibold text-text">Planned</div> : <div className="text-sm text-muted">No pending transfers.</div>}

        {unpaid.map((t) => (
          <TransferCard key={t.id} transfer={t} dispatch={dispatch} readOnly={state.settings.readOnlyMode} />
        ))}

        {paid.length > 0 ? <div className="pt-2 text-xs font-semibold text-text">Paid (recent + one-time)</div> : null}
        {paid.map((t) => (
          <TransferCard key={t.id} transfer={t} paidIso={t.paidAt ?? latestPaymentIsoById.get(t.id)} dispatch={dispatch} readOnly={state.settings.readOnlyMode} />
        ))}
      </div>

      <GoalsPanel tier={2} nowIso={nowIso} title="Goals (optional)" />
    </div>
  )
}

function TransferCard({
  transfer: t,
  paidIso,
  dispatch,
  readOnly,
}: {
  transfer: PlannedTransfer
  paidIso?: string
  dispatch: ReturnType<typeof useApp>['dispatch']
  readOnly: boolean
}) {
  const isPaid = Boolean(paidIso)
  const [editing, setEditing] = useState(false)
  const [skipReason, setSkipReason] = useState('')

  const [name, setName] = useState(t.name)
  const [amount, setAmount] = useState(String(t.amountTzs))
  const [target, setTarget] = useState(t.targetTzs ? String(t.targetTzs) : '')
  const [targetNote, setTargetNote] = useState(t.targetNote ?? '')
  const [dueDate, setDueDate] = useState(t.dueDate)
  const [recurrence, setRecurrence] = useState<Recurrence>(t.recurrence)
  const [notes, setNotes] = useState(t.notes ?? '')

  if (editing) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="growth">T2</Badge>
              <div className="text-sm font-semibold text-text">Edit transfer</div>
            </div>
            <div className="mt-1 text-xs text-muted">Update targets, recurrence, and notes without deleting.</div>
          </div>
          <Badge tone="neutral">{t.id}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <div className="text-xs text-muted">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted">Amount (TZS)</div>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" disabled={readOnly} />
            </div>
            <div>
              <div className="text-xs text-muted">Target (optional, TZS)</div>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder="e.g., 1200000" disabled={readOnly} />
            </div>
            <div>
              <div className="text-xs text-muted">Due date</div>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted">Recurrence</div>
              <select
                className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                disabled={readOnly}
              >
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="every_6_months">Every 6 months</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-muted">Target note (optional)</div>
              <Input value={targetNote} onChange={(e) => setTargetNote(e.target.value)} placeholder="e.g., 300 shares / month" disabled={readOnly} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Notes (optional)</div>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={readOnly} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => {
                const amountTzs = Math.max(0, Math.trunc(Number(amount)))
                const targetTzsRaw = target.trim() ? Math.max(0, Math.trunc(Number(target))) : 0
                const nextName = name.trim()
                if (!nextName || amountTzs <= 0 || !dueDate) return
                dispatch({
                  type: 'update_transfer',
                  transfer: {
                    ...t,
                    name: nextName,
                    amountTzs,
                    targetTzs: targetTzsRaw > 0 ? targetTzsRaw : undefined,
                    targetNote: targetNote.trim() ? targetNote.trim() : undefined,
                    dueDate,
                    recurrence,
                    notes: notes.trim() ? notes.trim() : undefined,
                  },
                })
                setEditing(false)
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(t.name)
                setAmount(String(t.amountTzs))
                setTarget(t.targetTzs ? String(t.targetTzs) : '')
                setTargetNote(t.targetNote ?? '')
                setDueDate(t.dueDate)
                setRecurrence(t.recurrence)
                setNotes(t.notes ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className={isPaid ? 'opacity-90' : ''}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="growth">{isPaid ? 'Paid' : 'T2'}</Badge>
            <div className="text-sm font-semibold text-text">{t.name}</div>
            {isPaid ? <Badge tone="growth">Paid</Badge> : <Badge tone="warning">Planned</Badge>}
          </div>
          <div className="mt-1 text-xs text-muted">
            {isPaid && paidIso ? (
              <>Paid {format(new Date(paidIso), 'MMM d, yyyy')} • Next due {format(new Date(t.dueDate), 'MMM d, yyyy')}</>
            ) : (
              <>Due {format(new Date(t.dueDate), 'MMM d, yyyy')}</>
            )}{' '}
            • {t.recurrence.replaceAll('_', ' ')}
            {t.targetTzs ? <> • Target {formatTzs(t.targetTzs)}</> : null}
            {t.targetNote ? <> • {t.targetNote}</> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-text">{formatTzs(t.amountTzs)}</div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {!isPaid ? (
              <Button
                size="sm"
                disabled={readOnly}
                onClick={() => {
                  const ok = window.confirm(`Mark this transfer as paid and log ${formatTzs(t.amountTzs)}?\n\n${t.name}`)
                  if (!ok) return
                  dispatch({ type: 'mark_transfer_paid', id: t.id, paidAt: isoNow() })
                }}
              >
                Mark paid
              </Button>
            ) : null}
            {!isPaid ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={readOnly}
                onClick={() => {
                  const reason = skipReason.trim()
                  if (reason.length < 2) return
                  dispatch({ type: 'skip_transfer', id: t.id, at: isoNow(), reason })
                  setSkipReason('')
                }}
              >
                Skip (reason)
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => dispatch({ type: 'delete_transfer', id: t.id })}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isPaid ? (
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="text-xs text-muted">If you must skip, write a reason (required).</div>
            <TextArea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={2}
              placeholder="e.g., cash shortfall this week; will catch up next payroll"
              disabled={readOnly}
            />
          </div>
          {t.skipLog.length > 0 ? (
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-text">Skip history</div>
              <div className="mt-1 space-y-1 text-xs text-muted">
                {t.skipLog.slice(0, 3).map((s) => (
                  <div key={s.at}>
                    {format(new Date(s.at), 'MMM d')} — {s.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  )
}

function AddTransferCard({ onAdd }: { onAdd: (t: PlannedTransfer) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [target, setTarget] = useState('')
  const [dueDate, setDueDate] = useState('2026-04-10')
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly')
  const [targetNote, setTargetNote] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-text">New Tier 2 transfer</div>
        <div className="mt-1 text-xs text-muted">Investments, savings circles, joint accounts.</div>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., CRDB Shares (Personal)" />
        </div>
        <div>
          <div className="text-xs text-muted">Amount (TZS)</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div>
          <div className="text-xs text-muted">Target (optional, TZS)</div>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder="e.g., 1200000" />
        </div>
        <div>
          <div className="text-xs text-muted">Due date</div>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted">Recurrence</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
          >
            <option value="one_time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="every_6_months">Every 6 months</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Target note (optional)</div>
          <Input value={targetNote} onChange={(e) => setTargetNote(e.target.value)} placeholder="e.g., 300 shares / month" />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Notes (optional)</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g., broker account details" />
        </div>
        <div className="md:col-span-2">
          <Button
            onClick={() => {
              const amountTzs = Math.max(0, Math.trunc(Number(amount)))
              const targetTzs = target.trim() ? Math.max(0, Math.trunc(Number(target))) : 0
              if (!name.trim() || amountTzs <= 0 || !dueDate) return
              onAdd({
                id: newId('tr'),
                tier: 2,
                name: name.trim(),
                amountTzs,
                targetTzs: targetTzs > 0 ? targetTzs : undefined,
                targetNote: targetNote.trim() ? targetNote.trim() : undefined,
                dueDate,
                recurrence,
                notes: notes.trim() ? notes.trim() : undefined,
                skipLog: [],
              })
              setName('')
              setAmount('')
              setTarget('')
              setTargetNote('')
              setNotes('')
            }}
          >
            Add transfer
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

type WorthRange = 'all' | '6m' | 'ytd' | '1y' | '2y' | '4y' | '8y'

function isoFromDateOnly(dateOnly: string) {
  const safe = dateOnly?.trim()
  if (!safe) return isoNow()
  const d = new Date(`${safe}T12:00`)
  return Number.isNaN(d.getTime()) ? isoNow() : d.toISOString()
}

function formatWorth(currency: CurrencyCode, value: number) {
  if (currency === 'TZS') return formatTzs(value)
  const sign = value < 0 ? '-' : ''
  return `${sign}USD ${Math.abs(value).toFixed(2)}`
}

function rangeStartFor(range: WorthRange, now: Date): Date | null {
  switch (range) {
    case 'all':
      return null
    case '6m':
      return subMonths(now, 6)
    case 'ytd':
      return startOfYear(now)
    case '1y':
      return subYears(now, 1)
    case '2y':
      return subYears(now, 2)
    case '4y':
      return subYears(now, 4)
    case '8y':
      return subYears(now, 8)
  }
}

function dayStartMs(value: string | number | Date) {
  const d = typeof value === 'number' ? new Date(value) : typeof value === 'string' ? new Date(value) : new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function WorthTracker({
  nowIso,
  currencyDefault,
  items,
  snapshots,
  readOnly,
  dispatch,
}: {
  nowIso: string
  currencyDefault: 'TZS'
  items: WorthItem[]
  snapshots: WorthSnapshot[]
  readOnly: boolean
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso])
  const [currency, setCurrency] = useState<CurrencyCode>(currencyDefault)
  const [range, setRange] = useState<WorthRange>('all')
  const [showAddKind, setShowAddKind] = useState<WorthItemKind | null>(null)

  const rangeStart = useMemo(() => rangeStartFor(range, now), [range, now])

  const scopedItems = useMemo(() => items.filter((i) => i.currency === currency), [items, currency])

  const scopedSnapshots = useMemo(() => {
    const ids = new Set(scopedItems.map((i) => i.id))
    return snapshots.filter((s) => ids.has(s.itemId))
  }, [scopedItems, snapshots])

  const latestSnapshotByItemId = useMemo(() => {
    const m = new Map<string, WorthSnapshot>()
    for (const s of scopedSnapshots) {
      const prev = m.get(s.itemId)
      if (!prev || new Date(s.date).getTime() > new Date(prev.date).getTime()) m.set(s.itemId, s)
    }
    return m
  }, [scopedSnapshots])

  const totals = useMemo(() => {
    let assets = 0
    let liabilities = 0
    for (const it of scopedItems) {
      const snap = latestSnapshotByItemId.get(it.id)
      if (!snap) continue
      if (it.kind === 'asset') assets += snap.value
      else liabilities += snap.value
    }
    return { assets, liabilities, net: assets - liabilities }
  }, [latestSnapshotByItemId, scopedItems])

  const series = useMemo(() => {
    const points: Array<{ at: number; assets: number; liabilities: number; net: number }> = []
    if (scopedItems.length === 0) return { points, max: 0 }

    const itemSnapshots = new Map<string, WorthSnapshot[]>()
    for (const it of scopedItems) itemSnapshots.set(it.id, [])
    for (const s of scopedSnapshots) {
      if (!itemSnapshots.has(s.itemId)) continue
      itemSnapshots.get(s.itemId)!.push(s)
    }
    for (const [itemId, list] of itemSnapshots) {
      // Ensure "latest wins" even when multiple snapshots share the same timestamp (common when logging date-only).
      // State stores newest-first; we sort oldest-first so the final value applied for a day is the latest snapshot.
      const withIdx = list.map((s, idx) => ({ s, idx }))
      withIdx.sort((a, b) => {
        const ta = new Date(a.s.date).getTime()
        const tb = new Date(b.s.date).getTime()
        if (ta !== tb) return ta - tb
        return b.idx - a.idx
      })
      itemSnapshots.set(itemId, withIdx.map((x) => x.s))
    }

    const startMs = rangeStart ? dayStartMs(rangeStart) : null
    const rawDates = new Set<number>()
    for (const s of scopedSnapshots) {
      const ms = dayStartMs(s.date)
      if (startMs !== null && ms < startMs) continue
      rawDates.add(ms)
    }
    rawDates.add(dayStartMs(nowIso))
    const dates = Array.from(rawDates).sort((a, b) => a - b)
    if (dates.length === 0) return { points, max: 0 }

    const currentValue = new Map<string, number>()
    const cursor = new Map<string, number>()
    for (const it of scopedItems) {
      currentValue.set(it.id, 0)
      cursor.set(it.id, 0)
    }

    for (const at of dates) {
      for (const it of scopedItems) {
        const list = itemSnapshots.get(it.id) ?? []
        let idx = cursor.get(it.id) ?? 0
        while (idx < list.length && dayStartMs(list[idx]!.date) <= at) {
          currentValue.set(it.id, list[idx]!.value)
          idx += 1
        }
        cursor.set(it.id, idx)
      }

      let assets = 0
      let liabilities = 0
      for (const it of scopedItems) {
        const v = currentValue.get(it.id) ?? 0
        if (it.kind === 'asset') assets += v
        else liabilities += v
      }
      points.push({ at, assets, liabilities, net: assets - liabilities })
    }

    const max = points.reduce((acc, p) => Math.max(acc, p.assets, p.liabilities, Math.abs(p.net)), 0)
    return { points, max }
  }, [nowIso, rangeStart, scopedItems, scopedSnapshots])

  const itemsByKind = useMemo(() => {
    const assets = scopedItems.filter((i) => i.kind === 'asset')
    const liabilities = scopedItems.filter((i) => i.kind === 'liability')
    return { assets, liabilities }
  }, [scopedItems])

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">Worth tracker (assets + liabilities)</div>
          <div className="mt-1 text-xs text-muted">Log snapshots over time. Chart shows totals by date range.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-border bg-bg px-3 text-sm text-text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            <option value="TZS">TZS</option>
            <option value="USD">USD</option>
          </select>
          <Button size="sm" variant="secondary" onClick={() => setShowAddKind('asset')}>
            New asset
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAddKind('liability')}>
            New liability
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Assets</div>
            <div className="mt-1 text-lg font-semibold text-text">{formatWorth(currency, totals.assets)}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Liabilities</div>
            <div className="mt-1 text-lg font-semibold text-text">{formatWorth(currency, totals.liabilities)}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-xs text-muted">Net</div>
            <div className="mt-1 text-lg font-semibold text-text">{formatWorth(currency, totals.net)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: 'All' },
              { id: '6m', label: '6M' },
              { id: 'ytd', label: 'YTD' },
              { id: '1y', label: '1Y' },
              { id: '2y', label: '2Y' },
              { id: '4y', label: '4Y' },
              { id: '8y', label: '8Y' },
            ] as Array<{ id: WorthRange; label: string }>
          ).map((r) => (
            <Button key={r.id} size="sm" variant={range === r.id ? 'secondary' : 'ghost'} onClick={() => setRange(r.id)}>
              {r.label}
            </Button>
          ))}
          <div className="ml-auto text-xs text-muted">{currency} • {scopedItems.length} items</div>
        </div>

        <WorthLineChart
          points={series.points}
          max={series.max}
          currency={currency}
        />

        {showAddKind ? (
          <WorthAddForm
            kind={showAddKind}
            currency={currency}
            disabled={readOnly}
            onCancel={() => setShowAddKind(null)}
            onSave={(payload) => {
              const itemId = newId('wi')
              const snapshotId = newId('ws')
              dispatch({
                type: 'add_worth_item',
                item: {
                  id: itemId,
                  kind: payload.kind,
                  name: payload.name,
                  type: payload.type,
                  tags: payload.tags,
                  currency: payload.currency,
                },
                initialSnapshot: {
                  id: snapshotId,
                  itemId,
                  date: isoFromDateOnly(payload.dateOnly),
                  value: payload.value,
                },
              })
              setShowAddKind(null)
            }}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WorthItemList
            title="Assets"
            kind="asset"
            items={itemsByKind.assets}
            latestSnapshotByItemId={latestSnapshotByItemId}
            disabled={readOnly}
            dispatch={dispatch}
          />
          <WorthItemList
            title="Liabilities"
            kind="liability"
            items={itemsByKind.liabilities}
            latestSnapshotByItemId={latestSnapshotByItemId}
            disabled={readOnly}
            dispatch={dispatch}
          />
        </div>
      </CardBody>
    </Card>
  )
}

function WorthLineChart({
  points,
  max,
  currency,
}: {
  points: Array<{ at: number; assets: number; liabilities: number; net: number }>
  max: number
  currency: CurrencyCode
}) {
  if (points.length < 2 || max <= 0) {
    return <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">Add a few snapshots to see your worth chart.</div>
  }

  const niceMax = (() => {
    if (!Number.isFinite(max) || max <= 0) return 0
    const exp = Math.floor(Math.log10(max))
    const base = 10 ** exp
    const frac = max / base
    const niceFrac =
      frac <= 1
        ? 1
        : frac <= 1.25
          ? 1.25
          : frac <= 1.5
            ? 1.5
            : frac <= 2
              ? 2
              : frac <= 2.5
                ? 2.5
                : frac <= 5
                  ? 5
                  : 10
    return niceFrac * base
  })()

  const width = 560
  const height = 160
  const padLeft = 74
  const padRight = 10
  const padY = 10
  const chartLeft = padLeft
  const chartRight = width - padRight

  const xFor = (idx: number) => {
    const t = points.length <= 1 ? 0 : idx / (points.length - 1)
    return chartLeft + t * (chartRight - chartLeft)
  }
  const yFor = (v: number) => {
    const t = niceMax <= 0 ? 0 : v / niceMax
    return padY + (1 - t) * (height - padY * 2)
  }

  const assetsPts = points.map((p, idx) => `${xFor(idx)},${yFor(p.assets)}`).join(' ')
  const liabPts = points.map((p, idx) => `${xFor(idx)},${yFor(p.liabilities)}`).join(' ')
  const startLabel = format(new Date(points[0]!.at), 'MMM d, yyyy')
  const endLabel = format(new Date(points[points.length - 1]!.at), 'MMM d, yyyy')

  const fmt = (v: number) => formatWorth(currency, v)
  const axisLabel = (v: number) => {
    if (currency === 'USD') return `USD ${Math.round(v)}`
    const abs = Math.abs(v)
    if (abs >= 1_000_000_000) return `TSh ${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
    if (abs >= 1_000_000) return `TSh ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (abs >= 1_000) return `TSh ${Math.round(abs / 1_000)}k`
    return `TSh ${Math.round(abs)}`
  }
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax].filter((v, idx, arr) => arr.indexOf(v) === idx)

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted">Amount vs time</div>
        <div className="text-xs text-muted">{startLabel} → {endLabel}</div>
      </div>
      <div className="mt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none">
          {ticks
            .slice()
            .reverse()
            .map((v) => (
              <g key={v}>
                <line x1={chartLeft} x2={chartRight} y1={yFor(v)} y2={yFor(v)} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" />
                <text x={chartLeft - 6} y={yFor(v) + 3} textAnchor="end" fontSize="10" fill="#64748b">
                  {axisLabel(v)}
                </text>
              </g>
            ))}
          <line x1={chartLeft} x2={chartLeft} y1={padY} y2={height - padY} stroke="rgba(148,163,184,0.45)" />
          <polyline points={assetsPts} fill="none" stroke="#22c55e" strokeWidth="2.25" />
          <polyline points={liabPts} fill="none" stroke="#ef4444" strokeWidth="2.25" />
          {points.map((p, idx) => (
            <g key={p.at}>
              <title>
                {format(new Date(p.at), 'MMM d, yyyy')} • Assets {fmt(p.assets)} • Liabilities {fmt(p.liabilities)} • Net {fmt(p.net)}
              </title>
              {idx === points.length - 1 ? (
                <>
                  <circle cx={xFor(idx)} cy={yFor(p.assets)} r="3" fill="#22c55e" />
                  <circle cx={xFor(idx)} cy={yFor(p.liabilities)} r="3" fill="#ef4444" />
                </>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: '#22c55e' }} /> Assets
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} /> Liabilities
        </span>
      </div>
    </div>
  )
}

function WorthAddForm({
  kind,
  currency,
  disabled,
  onCancel,
  onSave,
}: {
  kind: WorthItemKind
  currency: CurrencyCode
  disabled: boolean
  onCancel: () => void
  onSave: (payload: { kind: WorthItemKind; name: string; type: string; tags: string[]; currency: CurrencyCode; value: number; dateOnly: string }) => void
}) {
  const typeOptions = ['Bond', 'Cash', 'Shares', 'Property', 'Real Estate', 'Cryptocurrencies', 'Loan', 'General']
  const tagOptions = ['High Risk', 'Low Risk', 'Growth', 'Dividend', 'Long Term', 'Short term', 'Cash Equivalent', 'Tax Advantaged']

  const [name, setName] = useState('')
  const [type, setType] = useState(typeOptions[2]!)
  const [tags, setTags] = useState<string[]>([])
  const [cur, setCur] = useState<CurrencyCode>(currency)
  const [value, setValue] = useState('')
  const [dateOnly, setDateOnly] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-text">{kind === 'asset' ? 'New asset' : 'New liability'}</div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-3">
          <div className="text-xs text-muted">Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., CRDB shares" disabled={disabled} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Type</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={disabled}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs text-muted">Currency</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
            value={cur}
            onChange={(e) => setCur(e.target.value as CurrencyCode)}
            disabled={disabled}
          >
            <option value="TZS">TZS</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-muted">Value</div>
          <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0" disabled={disabled} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Date</div>
          <Input type="date" value={dateOnly} onChange={(e) => setDateOnly(e.target.value)} disabled={disabled} />
        </div>
        <div className="md:col-span-6">
          <div className="text-xs text-muted">Tags</div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {tagOptions.map((t) => {
              const checked = tags.includes(t)
              return (
                <label key={t} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = e.target.checked
                      setTags((prev) => (next ? Array.from(new Set([...prev, t])) : prev.filter((x) => x !== t)))
                    }}
                  />
                  {t}
                </label>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              const nextName = name.trim()
              const v = Number(value)
              if (!nextName) return
              if (!Number.isFinite(v) || v < 0) return
              if (!dateOnly) return
              onSave({ kind, name: nextName, type, tags, currency: cur, value: v, dateOnly })
              setName('')
              setValue('')
              setTags([])
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function WorthItemList({
  title,
  kind,
  items,
  latestSnapshotByItemId,
  disabled,
  dispatch,
}: {
  title: string
  kind: WorthItemKind
  items: WorthItem[]
  latestSnapshotByItemId: Map<string, WorthSnapshot>
  disabled: boolean
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  const [showPaidLiabilities, setShowPaidLiabilities] = useState(false)
  const paidLiabilityCount = useMemo(() => {
    if (kind !== 'liability') return 0
    return items.filter((it) => {
      const snap = latestSnapshotByItemId.get(it.id)
      return Boolean(snap) && (snap?.value ?? 0) <= 0
    }).length
  }, [items, kind, latestSnapshotByItemId])

  const visibleItems = useMemo(() => {
    if (kind !== 'liability') return items
    if (showPaidLiabilities) return items
    return items.filter((it) => {
      const snap = latestSnapshotByItemId.get(it.id)
      if (!snap) return true
      return snap.value > 0
    })
  }, [items, kind, latestSnapshotByItemId, showPaidLiabilities])

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-text">{title}</div>
        {kind === 'liability' && paidLiabilityCount > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setShowPaidLiabilities((s) => !s)}>
            {showPaidLiabilities ? `Hide paid (${paidLiabilityCount})` : `Show paid (${paidLiabilityCount})`}
          </Button>
        ) : null}
      </div>
      {visibleItems.length === 0 ? (
        <div className="mt-2 text-sm text-muted">
          {items.length === 0 ? 'No items yet.' : kind === 'liability' && paidLiabilityCount > 0 && !showPaidLiabilities ? 'All liabilities are paid (hidden).' : 'No items.'}
        </div>
      ) : null}
      <div className="mt-3 space-y-2">
        {visibleItems.map((it) => (
          <WorthItemRow
            key={it.id}
            item={it}
            latest={latestSnapshotByItemId.get(it.id)}
            disabled={disabled}
            onDelete={() => {
              const ok = window.confirm('Delete this item and all its snapshots?')
              if (!ok) return
              dispatch({ type: 'delete_worth_item', id: it.id })
            }}
            onAddSnapshot={(payload) => {
              dispatch({
                type: 'add_worth_snapshot',
                snapshot: {
                  id: newId('ws'),
                  itemId: it.id,
                  date: isoFromDateOnly(payload.dateOnly),
                  value: payload.value,
                },
              })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function WorthItemRow({
  item,
  latest,
  disabled,
  onDelete,
  onAddSnapshot,
}: {
  item: WorthItem
  latest?: WorthSnapshot
  disabled: boolean
  onDelete: () => void
  onAddSnapshot: (payload: { dateOnly: string; value: number }) => void
}) {
  const [showLog, setShowLog] = useState(false)
  const [dateOnly, setDateOnly] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [value, setValue] = useState('')

  return (
    <div className="rounded-xl border border-border bg-panel px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold text-text">{item.name}</div>
            <Badge tone="neutral">{item.type}</Badge>
            {item.tags.slice(0, 2).map((t) => (
              <Badge key={t} tone="neutral">
                {t}
              </Badge>
            ))}
            {item.tags.length > 2 ? <Badge tone="neutral">+{item.tags.length - 2}</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-muted">
            Latest:{' '}
            <span className="text-text">
              {latest ? formatWorth(item.currency, latest.value) : '—'}
            </span>{' '}
            {latest ? <>• {format(new Date(latest.date), 'MMM d, yyyy')}</> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setShowLog((s) => !s)}>
            {showLog ? 'Close' : 'Log value'}
          </Button>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {showLog ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-[11px] text-muted">Date</div>
            <Input type="date" value={dateOnly} onChange={(e) => setDateOnly(e.target.value)} disabled={disabled} />
          </div>
          <div className="md:col-span-2">
            <div className="text-[11px] text-muted">Value ({item.currency})</div>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0" disabled={disabled} />
          </div>
          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                const v = Number(value)
                if (!Number.isFinite(v) || v < 0) return
                if (!dateOnly) return
                onAddSnapshot({ dateOnly, value: v })
                setShowLog(false)
                setValue('')
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
