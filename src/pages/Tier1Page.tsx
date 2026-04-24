import { differenceInCalendarDays, endOfMonth, format } from 'date-fns'
import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import { isoNow } from '../domain/dates'
import { paidTowardObligation, remainingForObligation } from '../domain/engine/obligationPayments'
import { formatTzs } from '../domain/money'
import type { Obligation, Recurrence, Transaction } from '../domain/schema'
import { newId } from '../domain/ids'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input, TextArea } from '../ui/components/Input'
import { Progress } from '../ui/components/Progress'
import { GoalsPanel } from '../ui/GoalsPanel'

export function Tier1Page() {
  const { state, status, dispatch, actions } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const [showDueSection, setShowDueSection] = useState(true)
  const [showUpcomingSection, setShowUpcomingSection] = useState(false)
  const [showPaidSection, setShowPaidSection] = useState(false)
  const [author, setAuthor] = useState('Mariam')
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const nowIso = status.nowIso

  const { dueNow, upcoming, recentlyCleared, paymentsById } = useMemo(() => {
    const now = new Date(nowIso)
    const cycleEnd = endOfMonth(now)
    const paidWindowDays = 45

    const paymentsById = new Map<string, Transaction[]>()
    for (const t of state.transactions) {
      if (t.kind !== 'expense') continue
      if (t.tier !== 1) continue
      if (t.linked?.type !== 'obligation') continue
      const list = paymentsById.get(t.linked.id) ?? []
      list.push(t)
      paymentsById.set(t.linked.id, list)
    }
    for (const [, list] of paymentsById) {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }

    const entries = state.obligations
      .map((o) => {
        const paidTzs = paidTowardObligation(state.transactions, o)
        const remainingTzs = remainingForObligation(state.transactions, o)
        const clearedIso = o.paidAt ?? o.lastClearedAt
        const recently =
          clearedIso && differenceInCalendarDays(now, new Date(clearedIso)) >= 0 && differenceInCalendarDays(now, new Date(clearedIso)) <= paidWindowDays
        const daysUntilDue = differenceInCalendarDays(new Date(o.dueDate), now)
        // If the next due is very soon (e.g., weekly), don't hide it in "Paid" for long.
        const eligibleForPaidSection = recently && daysUntilDue >= 14
        return { obligation: o, paidTzs, remainingTzs, eligibleForPaidSection, clearedIso }
      })
      .sort((a, b) => new Date(a.obligation.dueDate).getTime() - new Date(b.obligation.dueDate).getTime())

    const dueNow = entries.filter((e) => e.remainingTzs > 0 && new Date(e.obligation.dueDate) <= cycleEnd)
    const upcoming = entries.filter((e) => e.remainingTzs > 0 && new Date(e.obligation.dueDate) > cycleEnd && !e.eligibleForPaidSection)
    const recentlyCleared = entries.filter((e) => e.eligibleForPaidSection || (e.obligation.recurrence === 'one_time' && Boolean(e.obligation.paidAt)))

    return { dueNow, upcoming, recentlyCleared, paymentsById }
  }, [state.obligations, state.transactions, nowIso])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-text">Tier 1 — Critical obligations</div>
          <div className="mt-1 text-sm text-muted">Non-negotiables. Tier 1 is the first focus; the app will keep reminding you until it’s cleared.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status.tier1.overdue.length > 0 ? 'critical' : status.tier1.isCompleteForCycle ? 'growth' : 'warning'}>
            {status.tier1.overdue.length > 0 ? 'Overdue' : status.tier1.isCompleteForCycle ? 'Cleared' : 'Pending'}
          </Badge>
          <Button variant="secondary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : 'Add obligation'}
          </Button>
        </div>
      </div>

      {showAdd ? (
        <AddObligationCard
          onAdd={(obl) => {
            dispatch({ type: 'add_obligation', obligation: obl })
            setShowAdd(false)
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {dueNow.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text">Due / overdue (this month)</div>
            <Button size="sm" variant="ghost" onClick={() => setShowDueSection((s) => !s)}>
              {showDueSection ? 'Hide' : `Show (${dueNow.length})`}
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted">No Tier 1 due items this month.</div>
        )}
        {showDueSection
          ? dueNow.map((e) => (
              <ObligationCard
                key={e.obligation.id}
                obligation={e.obligation}
                paidTzs={e.paidTzs}
                remainingTzs={e.remainingTzs}
                overdue={status.tier1.overdue.some((x) => x.id === e.obligation.id)}
                payments={paymentsById.get(e.obligation.id) ?? []}
                dispatch={dispatch}
                readOnly={state.settings.readOnlyMode}
                mode="due"
              />
            ))
          : null}

        {upcoming.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-xs font-semibold text-text">Upcoming</div>
            <Button size="sm" variant="ghost" onClick={() => setShowUpcomingSection((s) => !s)}>
              {showUpcomingSection ? 'Hide' : `Show (${upcoming.length})`}
            </Button>
          </div>
        ) : null}
        {showUpcomingSection
          ? upcoming.map((e) => (
              <ObligationCard
                key={e.obligation.id}
                obligation={e.obligation}
                paidTzs={e.paidTzs}
                remainingTzs={e.remainingTzs}
                overdue={false}
                payments={paymentsById.get(e.obligation.id) ?? []}
                dispatch={dispatch}
                readOnly={state.settings.readOnlyMode}
                mode="upcoming"
              />
            ))
          : null}

        {recentlyCleared.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-xs font-semibold text-text">Paid (recent + one-time)</div>
            <Button size="sm" variant="ghost" onClick={() => setShowPaidSection((s) => !s)}>
              {showPaidSection ? 'Hide' : `Show (${recentlyCleared.length})`}
            </Button>
          </div>
        ) : null}
        {showPaidSection
          ? recentlyCleared.map((e) => (
              <ObligationCard
                key={e.obligation.id}
                obligation={e.obligation}
                paidTzs={e.paidTzs}
                remainingTzs={e.remainingTzs}
                overdue={false}
                payments={paymentsById.get(e.obligation.id) ?? []}
                dispatch={dispatch}
                readOnly={state.settings.readOnlyMode}
                mode="paid"
              />
            ))
          : null}
      </div>

      <GoalsPanel tier={1} nowIso={nowIso} title="Goals (optional)" />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-text">Accountability comments</div>
          <div className="mt-1 text-xs text-muted">Read-only mode still allows comments.</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted">Author</div>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-muted">Message</div>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g., Please confirm Jisoti paid today." />
            </div>
          </div>
          {commentError ? <div className="text-xs text-t1">{commentError}</div> : null}
          <Button
            variant="secondary"
            onClick={() => {
              setCommentError(null)
              const res = actions.addComment({ author, message: comment })
              if (!res.ok) setCommentError(res.reason)
              else setComment('')
            }}
          >
            Add comment
          </Button>

          <div className="space-y-2">
            {state.comments.length === 0 ? (
              <div className="text-sm text-muted">No comments yet.</div>
            ) : (
              state.comments.slice(0, 5).map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-bg px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-text">{c.author}</div>
                    <div className="text-xs text-muted">{format(new Date(c.at), 'MMM d, HH:mm')}</div>
                  </div>
                  <div className="mt-1 text-sm text-muted">{c.message}</div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function ObligationCard({
  obligation: o,
  paidTzs,
  remainingTzs,
  overdue,
  payments,
  dispatch,
  readOnly,
  mode,
}: {
  obligation: Obligation
  paidTzs: number
  remainingTzs: number
  overdue: boolean
  payments: Transaction[]
  dispatch: ReturnType<typeof useApp>['dispatch']
  readOnly: boolean
  mode: 'due' | 'upcoming' | 'paid'
}) {
  const [showPay, setShowPay] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [payError, setPayError] = useState<string | null>(null)
  const [showPayments, setShowPayments] = useState(false)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(o.name)
  const [amount, setAmount] = useState(String(o.amountTzs))
  const [dueDate, setDueDate] = useState(o.dueDate)
  const [recurrence, setRecurrence] = useState<Recurrence>(o.recurrence)
  const [notes, setNotes] = useState(o.notes ?? '')

  const pct = o.amountTzs > 0 ? Math.round((100 * Math.min(o.amountTzs, paidTzs)) / o.amountTzs) : 0
  const tone = remainingTzs <= 0 ? 'growth' : overdue ? 'critical' : 'warning'

  if (editing) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="critical">T1</Badge>
              <div className="text-sm font-semibold text-text">Edit obligation</div>
            </div>
            <div className="mt-1 text-xs text-muted">Update amount, due date, and recurrence without deleting.</div>
          </div>
          <Badge tone="neutral">{o.id}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <div className="text-xs text-muted">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted">Amount (TZS)</div>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
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
          </div>
          <div>
            <div className="text-xs text-muted">Notes (optional)</div>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => {
                const amountTzs = Math.max(0, Math.trunc(Number(amount)))
                const nextName = name.trim()
                if (!nextName || amountTzs <= 0 || !dueDate) return
                dispatch({
                  type: 'update_obligation',
                  obligation: {
                    ...o,
                    name: nextName,
                    amountTzs,
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
                setName(o.name)
                setAmount(String(o.amountTzs))
                setDueDate(o.dueDate)
                setRecurrence(o.recurrence)
                setNotes(o.notes ?? '')
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
    <Card key={o.id} className={overdue ? 'border-t1/40' : ''}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="critical">T1</Badge>
            <div className="truncate text-sm font-semibold text-text">{o.name}</div>
            {remainingTzs <= 0 ? (
              <Badge tone="growth">Paid</Badge>
            ) : overdue ? (
              <Badge tone="critical">Overdue</Badge>
            ) : mode === 'upcoming' ? (
              <Badge tone="neutral">Upcoming</Badge>
            ) : (
              <Badge tone="warning">Pending</Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-muted">
            Due {format(new Date(o.dueDate), 'MMM d, yyyy')} • {o.recurrence.replaceAll('_', ' ')}
            {o.lastClearedAt ? <> • Last cleared {format(new Date(o.lastClearedAt), 'MMM d, yyyy')}</> : null}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold text-text">{formatTzs(o.amountTzs)}</div>
          <div className="mt-1 text-xs text-muted">
            Paid {formatTzs(paidTzs)} • Remaining <span className={remainingTzs > 0 ? 'text-text' : 'text-t2'}>{formatTzs(remainingTzs)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {mode !== 'paid' ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={readOnly || remainingTzs <= 0}
                  onClick={() => {
                    setPayError(null)
                    setPayDate(format(new Date(), 'yyyy-MM-dd'))
                    setPayAmount(String(remainingTzs))
                    setShowPay(true)
                  }}
                >
                  Pay remaining
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={readOnly || remainingTzs <= 0}
                  onClick={() => {
                    setPayError(null)
                    setPayDate(format(new Date(), 'yyyy-MM-dd'))
                    setPayAmount('')
                    setShowPay(true)
                  }}
                >
                  Log payment
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => dispatch({ type: 'delete_obligation', id: o.id })}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        <Progress value={pct} tone={tone} />
        {payments.length > 0 ? (
          <div className="rounded-xl border border-border bg-bg px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text">Payment log</div>
              <Button size="sm" variant="ghost" onClick={() => setShowPayments((s) => !s)}>
                {showPayments ? 'Hide' : `Show (${payments.length})`}
              </Button>
            </div>
            {showPayments ? (
              <div className="mt-3 space-y-2">
                {payments.slice(0, 10).map((t) => (
                  <PaymentLogRow
                    key={t.id}
                    tx={t}
                    readOnly={readOnly}
                    onDelete={() => {
                      const ok = window.confirm('Void this payment entry? If it was the clearing payment, the obligation will reopen.')
                      if (!ok) return
                      dispatch({ type: 'void_obligation_payment', obligationId: o.id, txId: t.id })
                    }}
                    onUpdateDate={(nextIso) => {
                      dispatch({ type: 'update_transaction', tx: { ...t, date: nextIso } })
                      if (o.lastClearedPaymentId === t.id) {
                        dispatch({ type: 'update_obligation', obligation: { ...o, lastClearedAt: nextIso } })
                      }
                    }}
                  />
                ))}
                {payments.length > 10 ? <div className="text-[11px] text-muted">Showing latest 10 payments.</div> : null}
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted">Tracks partial payments with date + amount.</div>
            )}
          </div>
        ) : null}
        {showPay ? (
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="text-sm font-semibold text-text">Log a payment (partial allowed)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="min-w-[160px]">
                <div className="text-[11px] text-muted">Paid date</div>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="numeric" placeholder="TZS" className="w-40" />
              <Button
                size="sm"
                disabled={readOnly}
                onClick={() => {
                  setPayError(null)
                  const amountTzs = Math.max(0, Math.trunc(Number(payAmount)))
                  if (amountTzs <= 0) return setPayError('Amount must be greater than 0.')
                  if (remainingTzs > 0 && amountTzs > remainingTzs) {
                    const ok = window.confirm(`This is more than the remaining amount (${formatTzs(remainingTzs)}). Log anyway?`)
                    if (!ok) return
                  }
                  dispatch({ type: 'record_obligation_payment', id: o.id, at: isoFromDateOnly(payDate), amountTzs })
                  setShowPay(false)
                }}
              >
                Add payment
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPay(false)}>
                Cancel
              </Button>
            </div>
            {payError ? <div className="mt-2 text-xs text-t1">{payError}</div> : null}
          </div>
        ) : null}
        {o.notes ? <div className="text-sm text-muted">{o.notes}</div> : null}
      </CardBody>
    </Card>
  )
}

function PaymentLogRow({
  tx,
  readOnly,
  onDelete,
  onUpdateDate,
}: {
  tx: Transaction
  readOnly: boolean
  onDelete: () => void
  onUpdateDate: (nextIso: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [dateOnly, setDateOnly] = useState(() => format(new Date(tx.date), 'yyyy-MM-dd'))

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-3 py-2">
        <div className="text-xs text-muted">{format(new Date(tx.date), 'MMM d, yyyy')}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-text">{formatTzs(tx.amountTzs)}</div>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setEditing(true)}>
            Edit date
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2">
      <div className="flex items-center gap-2">
        <Input type="date" value={dateOnly} onChange={(e) => setDateOnly(e.target.value)} className="w-44" />
        <div className="text-xs font-semibold text-text">{formatTzs(tx.amountTzs)}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => {
            onUpdateDate(isoFromDateOnly(dateOnly))
            setEditing(false)
          }}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDateOnly(format(new Date(tx.date), 'yyyy-MM-dd'))
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function isoFromDateOnly(dateOnly: string) {
  const safe = dateOnly?.trim()
  if (!safe) return isoNow()
  const d = new Date(`${safe}T12:00`)
  return Number.isNaN(d.getTime()) ? isoNow() : d.toISOString()
}

function AddObligationCard({ onAdd }: { onAdd: (obl: Obligation) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('2026-04-01')
  const [recurrence, setRecurrence] = useState<Recurrence>('one_time')
  const [notes, setNotes] = useState('')

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-text">New Tier 1 obligation</div>
        <div className="mt-1 text-xs text-muted">Use this for rent, loans, essential fixed commitments.</div>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Kodi (Rent)" />
        </div>
        <div>
          <div className="text-xs text-muted">Amount (TZS)</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" />
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
          <div className="text-xs text-muted">Notes (optional)</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment method, confirmations needed, etc." />
        </div>
        <div className="md:col-span-2">
          <Button
            onClick={() => {
              const amountTzs = Math.max(0, Math.trunc(Number(amount)))
              if (!name.trim() || amountTzs <= 0 || !dueDate) return
              onAdd({
                id: newId('obl'),
                tier: 1,
                name: name.trim(),
                amountTzs,
                dueDate,
                recurrence,
                notes: notes.trim() ? notes.trim() : undefined,
              })
              setName('')
              setAmount('')
              setNotes('')
            }}
          >
            Add obligation
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
