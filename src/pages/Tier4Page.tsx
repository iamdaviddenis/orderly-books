import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../app/store'
import type { Transaction } from '../domain/schema'
import { formatTzs } from '../domain/money'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { SpendBookAddForm, SpendBookRow } from '../ui/SpendBook'
import { GoalsPanel } from '../ui/GoalsPanel'

export function Tier4Page() {
  const { state, status, dispatch, actions } = useApp()
  const navigate = useNavigate()
  const now = useMemo(() => new Date(status.nowIso), [status.nowIso])

  const monthStart = useMemo(() => startOfMonth(now), [now])
  const monthEnd = useMemo(() => endOfMonth(now), [now])
  const monthTx = useMemo(() => {
    const startMs = monthStart.getTime()
    const endMs = monthEnd.getTime()
    return state.transactions
      .filter((t): t is Transaction & { kind: 'expense'; tier: 4 } => t.kind === 'expense' && t.tier === 4)
      .filter((t) => {
        const ms = new Date(t.date).getTime()
        return ms >= startMs && ms <= endMs
      })
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [monthEnd, monthStart, state.transactions])

  const tier4Categories = useMemo(() => {
    const list = state.categories.filter((c) => c.tierHint === 4)
    return list.length > 0 ? list : [{ id: 'cat_discretion', name: 'Discretionary' }]
  }, [state.categories])

  const tier4Goals = useMemo(() => state.goals.filter((g) => g.tier === 4 && g.status !== 'cancelled'), [state.goals])
  const tier4GoalOptions = useMemo(() => tier4Goals.filter((g) => g.status === 'active').map((g) => ({ id: g.id, name: g.name })), [tier4Goals])
  const tier4GoalNameById = useMemo(() => new Map(tier4Goals.map((g) => [g.id, g.name])), [tier4Goals])

  const [hideGoalLinked, setHideGoalLinked] = useState(true)
  const visibleTx = useMemo(() => (hideGoalLinked ? monthTx.filter((t) => !t.goalId) : monthTx), [hideGoalLinked, monthTx])

  const spendByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of monthTx) totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountTzs)
    const rows = Array.from(totals.entries())
      .map(([categoryId, amountTzs]) => ({
        categoryId,
        name: state.categories.find((c) => c.id === categoryId)?.name ?? categoryId,
        amountTzs,
      }))
      .sort((a, b) => b.amountTzs - a.amountTzs)
    const total = rows.reduce((acc, r) => acc + r.amountTzs, 0)
    return { rows, total }
  }, [monthTx, state.categories])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-text">Tier 4 — Discretionary</div>
          <div className="mt-1 text-sm text-muted">Birthdays, vacations, nice-to-haves. Spend with freedom after priorities.</div>
        </div>
        <Badge tone={status.locks.reasons.length > 0 ? 'warning' : 'growth'}>{status.locks.reasons.length > 0 ? 'Caution' : 'Ready'}</Badge>
      </div>

      {!status.tier1.isCompleteForCycle ? (
        <Card className="border-t3/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Tier 1 pending</Badge>
              <div className="text-sm font-semibold text-text">Discretionary is last</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>You can still log Tier 4, but keep your focus on clearing Tier 1 first.</span>
              <Button size="sm" variant="secondary" onClick={() => navigate('/tier-1')}>
                Review Tier 1
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Guardrails</div>
            <div className="mt-1 text-xs text-muted">These are reminders (not locks).</div>
          </div>
          <Badge tone="neutral">{format(now, 'MMMM yyyy')}</Badge>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-muted">
          {status.locks.reasons.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {status.locks.reasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <div>All clear. Spend with freedom and zero guilt.</div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="text-xs text-muted">Total spent (month)</div>
              <div className="mt-1 text-xl font-semibold text-text">{formatTzs(spendByCategory.total)}</div>
            </div>
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="text-xs text-muted">Top categories</div>
              {spendByCategory.total <= 0 ? (
                <div className="mt-2 text-sm text-muted">No Tier 4 entries yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {spendByCategory.rows.slice(0, 5).map((r) => (
                    <div key={r.categoryId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-xs text-muted">{r.name}</div>
                      <div className="text-xs font-semibold text-text">{formatTzs(r.amountTzs)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardBody>
	      </Card>

      <GoalsPanel tier={4} nowIso={status.nowIso} defaultShowAll />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Spend book (month)</div>
            <div className="mt-1 text-xs text-muted">
              Use this for unplanned spending. Goal-linked entries show in the Goals section (toggle below to include them here).
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setHideGoalLinked((s) => !s)}>
            {hideGoalLinked ? 'Show goal entries' : 'Hide goal entries'}
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <SpendBookAddForm
            categories={tier4Categories}
            goals={tier4GoalOptions}
	            disabled={state.settings.readOnlyMode}
	            onAdd={(input) => {
	              const res = actions.addQuickExpense({
	                tier: 4,
	                payee: input.payee,
	                amountTzs: input.amountTzs,
	                categoryId: input.categoryId,
	                dateIso: input.dateIso,
	                notes: input.notes,
                goalId: input.goalId,
	              })
	              if (!res.ok) window.alert(res.reason)
	            }}
          />

          {visibleTx.length === 0 ? (
            <div className="text-sm text-muted">No Tier 4 entries yet this month.</div>
          ) : (
            <div className="space-y-2">
              {visibleTx.slice(0, 80).map((t) => (
                <SpendBookRow
                  key={t.id}
                  tx={t}
                  categoryName={state.categories.find((c) => c.id === t.categoryId)?.name ?? t.categoryId}
                  categories={tier4Categories}
                  goals={tier4Goals.map((g) => ({ id: g.id, name: g.name }))}
                  goalName={t.goalId ? tier4GoalNameById.get(t.goalId) : undefined}
                  readOnly={state.settings.readOnlyMode}
                  onDelete={() => dispatch({ type: 'delete_transaction', id: t.id })}
                  onUpdate={(next) => dispatch({ type: 'update_transaction', tx: next })}
                />
              ))}
              {visibleTx.length > 80 ? <div className="text-[11px] text-muted">Showing latest 80 entries.</div> : null}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
