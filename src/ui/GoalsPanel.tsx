import { format, isSameMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import type { Goal, IsoDate, Tier } from '../domain/schema'
import { newId } from '../domain/ids'
import { formatTzs } from '../domain/money'
import { isoNow } from '../domain/dates'
import { Badge } from './components/Badge'
import { Button } from './components/Button'
import { Card, CardBody, CardHeader } from './components/Card'
import { Input, TextArea } from './components/Input'

function isoFromDateOnly(dateOnly: string) {
  const safe = dateOnly?.trim()
  if (!safe) return isoNow()
  const d = new Date(`${safe}T12:00`)
  return Number.isNaN(d.getTime()) ? isoNow() : d.toISOString()
}

export function GoalsPanel({
  tier,
  title,
  nowIso,
  defaultShowAll = false,
}: {
  tier: Tier
  title?: string
  nowIso: IsoDate
  defaultShowAll?: boolean
}) {
  const { state, dispatch } = useApp()
  const now = useMemo(() => new Date(nowIso), [nowIso])

  const tierCategories = useMemo(() => state.categories.filter((c) => c.tierHint === tier), [state.categories, tier])
  const defaultCategoryId = tierCategories[0]?.id ?? state.categories[0]?.id ?? 'cat_discretion'

  const [showAdd, setShowAdd] = useState(false)
  const [showAll, setShowAll] = useState(defaultShowAll)

  const goals = useMemo(() => {
    const list = state.goals
      .filter((g) => g.tier === tier)
      .filter((g) => (showAll ? true : isSameMonth(new Date(g.dueDate), now)))
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    return list
  }, [now, showAll, state.goals, tier])

  const spendByGoalId = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of state.transactions) {
      if (t.kind !== 'expense') continue
      if (t.tier !== tier) continue
      if (!t.goalId) continue
      m.set(t.goalId, (m.get(t.goalId) ?? 0) + t.amountTzs)
    }
    return m
  }, [state.transactions, tier])

  const recentByGoalId = useMemo(() => {
    const m = new Map<string, Array<{ id: string; date: string; payee: string; amountTzs: number }>>()
    for (const t of state.transactions) {
      if (t.kind !== 'expense') continue
      if (t.tier !== tier) continue
      if (!t.goalId) continue
      const list = m.get(t.goalId) ?? []
      list.push({ id: t.id, date: t.date, payee: t.payee, amountTzs: t.amountTzs })
      m.set(t.goalId, list)
    }
    for (const [, list] of m) {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return m
  }, [state.transactions, tier])

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">{title ?? 'Goals (planned)'}</div>
          <div className="mt-1 text-xs text-muted">Set a target, then log actual spending toward it. Spend book stays for everything else.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'This month' : 'Show all'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : 'Add goal'}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {showAdd ? (
          <GoalAddForm
            tier={tier}
            onAdd={(g) => {
              dispatch({ type: 'add_goal', goal: g })
              setShowAdd(false)
            }}
          />
        ) : null}

        {goals.length === 0 ? (
          <div className="text-sm text-muted">No goals yet.</div>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                spentTzs={spendByGoalId.get(g.id) ?? 0}
                recent={recentByGoalId.get(g.id) ?? []}
                categoryOptions={tierCategories}
                defaultCategoryId={defaultCategoryId}
                onDelete={() => {
                  const ok = window.confirm('Delete this goal? (Goal-linked entries stay in your ledger.)')
                  if (!ok) return
                  dispatch({ type: 'delete_goal', id: g.id })
                }}
                onUpdate={(next) => dispatch({ type: 'update_goal', goal: next })}
                onLogSpend={(input) => {
                  dispatch({
                    type: 'add_transaction',
                    tx: {
                      id: newId('tx'),
                      kind: 'expense',
                      tier,
                      date: isoFromDateOnly(input.dateOnly),
                      amountTzs: input.amountTzs,
                      payee: input.payee,
                      categoryId: input.categoryId,
                      notes: input.notes?.trim() ? input.notes.trim() : undefined,
                      goalId: g.id,
                    },
                  })
                }}
                onDeleteSpend={(txId) => dispatch({ type: 'delete_transaction', id: txId })}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function GoalAddForm({ tier, onAdd }: { tier: Tier; onAdd: (g: Goal) => void }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [dueDate, setDueDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="text-sm font-semibold text-text">New goal</div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-3">
          <div className="text-xs text-muted">Goal</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Birthday dinner" />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Target (TZS)</div>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div>
          <div className="text-xs text-muted">Due date</div>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="md:col-span-6">
          <div className="text-xs text-muted">Notes (optional)</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="details, idea, place…" />
        </div>
        <div className="md:col-span-6">
          <Button
            variant="secondary"
            onClick={() => {
              const nm = name.trim()
              const targetTzs = Math.max(0, Math.trunc(Number(target)))
              if (!nm || targetTzs <= 0 || !dueDate) return
              onAdd({
                id: newId('goal'),
                tier,
                name: nm,
                targetTzs,
                dueDate,
                status: 'active',
                createdAt: isoNow(),
                notes: notes.trim() ? notes.trim() : undefined,
              })
              setName('')
              setTarget('')
              setNotes('')
            }}
          >
            Add goal
          </Button>
        </div>
      </div>
    </div>
  )
}

function GoalRow({
  goal,
  spentTzs,
  recent,
  categoryOptions,
  defaultCategoryId,
  onUpdate,
  onDelete,
  onLogSpend,
  onDeleteSpend,
}: {
  goal: Goal
  spentTzs: number
  recent: Array<{ id: string; date: string; payee: string; amountTzs: number }>
  categoryOptions: Array<{ id: string; name: string }>
  defaultCategoryId: string
  onUpdate: (next: Goal) => void
  onDelete: () => void
  onLogSpend: (input: { dateOnly: string; payee: string; amountTzs: number; categoryId: string; notes?: string }) => void
  onDeleteSpend: (txId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)

  const [name, setName] = useState(goal.name)
  const [target, setTarget] = useState(String(goal.targetTzs))
  const [dueDate, setDueDate] = useState(goal.dueDate)
  const [notes, setNotes] = useState(goal.notes ?? '')

  const pct = goal.targetTzs > 0 ? Math.round((100 * Math.min(goal.targetTzs, spentTzs)) / goal.targetTzs) : 0
  const remaining = Math.max(0, goal.targetTzs - spentTzs)
  const overspendPct = goal.targetTzs > 0 && spentTzs > goal.targetTzs ? Math.round(((spentTzs - goal.targetTzs) / goal.targetTzs) * 100) : 0

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-text">Edit goal</div>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Close
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-3">
            <div className="text-xs text-muted">Goal</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted">Target (TZS)</div>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <div className="text-xs text-muted">Due date</div>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="md:col-span-6">
            <div className="text-xs text-muted">Notes</div>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const nm = name.trim()
                const targetTzs = Math.max(0, Math.trunc(Number(target)))
                if (!nm || targetTzs <= 0 || !dueDate) return
                onUpdate({
                  ...goal,
                  name: nm,
                  targetTzs,
                  dueDate,
                  notes: notes.trim() ? notes.trim() : undefined,
                })
                setEditing(false)
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Goal</Badge>
            <div className="truncate text-sm font-semibold text-text">{goal.name}</div>
            <div className="text-xs text-muted">Due {format(new Date(goal.dueDate), 'MMM d, yyyy')}</div>
          </div>
          {goal.notes ? <div className="mt-1 text-xs text-muted">{goal.notes}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-text">{formatTzs(goal.targetTzs)}</div>
          <div className="mt-1 text-xs text-muted">
            Spent {formatTzs(spentTzs)} • Remaining {formatTzs(remaining)}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setLogging((s) => !s)}>
              {logging ? 'Close' : 'Log spend'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <GoalProgress spentTzs={spentTzs} targetTzs={goal.targetTzs} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-muted">{pct}% of goal target</span>
          {overspendPct > 0 ? <span className="font-semibold text-t1">+{overspendPct}% above target</span> : null}
        </div>
      </div>

      {logging ? (
        <GoalSpendForm
          defaultCategoryId={defaultCategoryId}
          categoryOptions={categoryOptions}
          onAdd={(input) => {
            onLogSpend(input)
            setLogging(false)
          }}
        />
      ) : null}

      {recent.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-panel p-3">
          <div className="text-xs font-medium text-text">Recent entries</div>
          <div className="mt-2 space-y-2">
            {recent.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-text">{t.payee}</div>
                  <div className="text-xs text-muted">{format(new Date(t.date), 'MMM d, yyyy')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-text">{formatTzs(t.amountTzs)}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const ok = window.confirm('Delete this entry?')
                      if (!ok) return
                      onDeleteSpend(t.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GoalProgress({ spentTzs, targetTzs }: { spentTzs: number; targetTzs: number }) {
  const progressPct = targetTzs > 0 ? Math.min(100, (spentTzs / targetTzs) * 100) : 0
  const overflowPct = targetTzs > 0 && spentTzs > targetTzs ? Math.min(100, ((spentTzs - targetTzs) / targetTzs) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-full bg-border/45">
        <div className="h-2 rounded-full bg-t2 transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      {overflowPct > 0 ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-t1/12">
            <div className="h-full rounded-full bg-t1 transition-all" style={{ width: `${overflowPct}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-t1">Over target</span>
        </div>
      ) : null}
    </div>
  )
}

function GoalSpendForm({
  categoryOptions,
  defaultCategoryId,
  onAdd,
}: {
  categoryOptions: Array<{ id: string; name: string }>
  defaultCategoryId: string
  onAdd: (input: { dateOnly: string; payee: string; amountTzs: number; categoryId: string; notes?: string }) => void
}) {
  const [dateOnly, setDateOnly] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [notes, setNotes] = useState('')

  return (
    <div className="mt-3 rounded-xl border border-border bg-bg p-4">
      <div className="text-sm font-semibold text-text">Log goal spend</div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Date</div>
          <Input type="date" value={dateOnly} onChange={(e) => setDateOnly(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">What / Payee</div>
          <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g., Dinner date" />
        </div>
        <div>
          <div className="text-xs text-muted">TZS</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div>
          <div className="text-xs text-muted">Category</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-6">
          <div className="text-xs text-muted">Notes (optional)</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="details…" />
        </div>
        <div className="md:col-span-6">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const p = payee.trim()
              const amt = Math.max(0, Math.trunc(Number(amount)))
              if (!p || amt <= 0 || !dateOnly) return
              onAdd({ dateOnly, payee: p, amountTzs: amt, categoryId, notes: notes.trim() ? notes.trim() : undefined })
              setPayee('')
              setAmount('')
              setNotes('')
            }}
          >
            Add entry
          </Button>
        </div>
      </div>
    </div>
  )
}
