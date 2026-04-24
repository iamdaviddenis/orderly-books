import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import { startOfWeekIso } from '../domain/dates'
import { formatTzs } from '../domain/money'
import { newId } from '../domain/ids'
import type { ShoppingTemplateItem, Transaction } from '../domain/schema'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input, TextArea } from '../ui/components/Input'
import { Progress } from '../ui/components/Progress'
import { SpendBookAddForm, SpendBookRow } from '../ui/SpendBook'
import { GoalsPanel } from '../ui/GoalsPanel'
import { useNavigate } from 'react-router-dom'

type ShoppingDispatch = (
  action:
    | { type: 'sync_shopping_week_from_template'; weekStart: string }
    | { type: 'add_shopping_template_item'; item: ShoppingTemplateItem }
    | { type: 'update_shopping_template_item'; item: ShoppingTemplateItem }
    | { type: 'delete_shopping_template_item'; id: string }
    | { type: 'toggle_shopping_item'; weekStart: string; itemId: string; purchased: boolean }
    | { type: 'set_shopping_item_actual'; weekStart: string; itemId: string; actualTzs: number | undefined },
) => void

export function Tier3Page() {
  const { state, status, dispatch, actions } = useApp()
  const navigate = useNavigate()
  const now = useMemo(() => new Date(status.nowIso), [status.nowIso])
  const weekStart = startOfWeekIso(now, state.settings.weekStartsOn)
  const defaultWeekBudget = useMemo(() => {
    const fallback = state.weekBudgets
      .slice()
      .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0]?.limitTzs
    return fallback ?? 230_000
  }, [state.weekBudgets])
  const weekBudget = state.weekBudgets.find((w) => w.weekStart === weekStart)?.limitTzs ?? defaultWeekBudget
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  const tier3Tx = useMemo(() => {
    const start = new Date(weekStart)
    const end = weekEnd
    return state.transactions
      .filter((t) => t.kind === 'expense' && t.tier === 3)
      .filter((t) => {
        const d = new Date(t.date)
        return d >= start && d < end
      })
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [state.transactions, weekStart, weekEnd])

  const spent = useMemo(() => tier3Tx.reduce((acc, t) => acc + t.amountTzs, 0), [tier3Tx])
  const pct = weekBudget > 0 ? Math.round((100 * spent) / weekBudget) : 0
  const tone = pct >= 100 ? 'critical' : pct >= 80 ? 'warning' : 'growth'

  const shopping = state.shoppingWeeks.find((w) => w.weekStart === weekStart)
  const shoppingSpent = useMemo(() => {
    if (!shopping) return 0
    return shopping.items.reduce((acc, i) => acc + (i.actualTzs ?? (i.purchased ? i.estimatedTzs : 0)), 0)
  }, [shopping])

  const [budgetDraft, setBudgetDraft] = useState<{ weekStart: string; value: string }>(() => ({ weekStart, value: String(weekBudget) }))
  const budgetInput = budgetDraft.weekStart === weekStart ? budgetDraft.value : String(weekBudget)
  const [showTemplate, setShowTemplate] = useState(false)
  const [hideGoalLinked, setHideGoalLinked] = useState(false)

  const monthStart = useMemo(() => startOfMonth(now), [now])
  const monthEnd = useMemo(() => endOfMonth(now), [now])
  const monthTx = useMemo(() => {
    const startMs = monthStart.getTime()
    const endMs = monthEnd.getTime()
    return state.transactions
      .filter((t): t is Transaction & { kind: 'expense'; tier: 3 } => t.kind === 'expense' && t.tier === 3)
      .filter((t) => {
        const ms = new Date(t.date).getTime()
        return ms >= startMs && ms <= endMs
      })
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [monthEnd, monthStart, state.transactions])

  const visibleMonthTx = useMemo(() => (hideGoalLinked ? monthTx.filter((t) => !t.goalId) : monthTx), [hideGoalLinked, monthTx])

  const tier3Categories = useMemo(() => state.categories.filter((c) => c.tierHint === 3), [state.categories])
  const tier3Goals = useMemo(() => state.goals.filter((g) => g.tier === 3 && g.status !== 'cancelled'), [state.goals])
  const tier3GoalOptions = useMemo(() => tier3Goals.filter((g) => g.status === 'active').map((g) => ({ id: g.id, name: g.name })), [tier3Goals])
  const tier3GoalNameById = useMemo(() => new Map(tier3Goals.map((g) => [g.id, g.name])), [tier3Goals])

  const spendByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of visibleMonthTx) {
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountTzs)
    }
    const rows = Array.from(totals.entries())
      .map(([categoryId, amountTzs]) => ({
        categoryId,
        name: state.categories.find((c) => c.id === categoryId)?.name ?? categoryId,
        amountTzs,
      }))
      .sort((a, b) => b.amountTzs - a.amountTzs)
    const total = rows.reduce((acc, r) => acc + r.amountTzs, 0)
    return { rows, total }
  }, [visibleMonthTx, state.categories])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-text">Tier 3 — Essential lifestyle</div>
          <div className="mt-1 text-sm text-muted">
            Weekly budget + shopping mode + spend book. Essentials first while you clear Tier 1.
          </div>
        </div>
        {!status.tier1.isCompleteForCycle ? <Badge tone="warning">Essentials</Badge> : <Badge tone="warning">Active</Badge>}
      </div>

      {!status.tier1.isCompleteForCycle ? (
        <Card className="border-t3/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Tier 1 pending</Badge>
              <div className="text-sm font-semibold text-text">Keep Tier 3 to essentials</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Use this mode for food/utilities while you work to clear Tier 1.</span>
              <Button size="sm" variant="secondary" onClick={() => navigate('/tier-1')}>
                Review Tier 1
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="warning">Weekly budget</Badge>
                <div className="text-sm font-semibold text-text">
                  {format(new Date(weekStart), 'MMM d')}–{format(weekEnd, 'MMM d, yyyy')}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted">Alerts: 80% warning, 100% stop.</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Limit</div>
              <div className="text-lg font-semibold text-text">{formatTzs(weekBudget)}</div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Spent</div>
                <div className="text-lg font-semibold text-text">{formatTzs(spent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Remaining</div>
                <div className="text-lg font-semibold text-text">{formatTzs(Math.max(0, weekBudget - spent))}</div>
              </div>
            </div>
            <Progress value={weekBudget > 0 ? (100 * spent) / weekBudget : 0} tone={tone} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="text-xs text-muted">Set weekly limit (TZS)</div>
                <Input value={budgetInput} onChange={(e) => setBudgetDraft({ weekStart, value: e.target.value })} inputMode="numeric" />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const limit = Math.max(0, Math.trunc(Number(budgetInput)))
                    dispatch({ type: 'set_week_budget', weekStart, limitTzs: limit })
                    setBudgetDraft({ weekStart, value: String(limit) })
                  }}
                >
                  Save limit
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text">Entry point</div>
                  <div className="mt-1 text-xs text-muted">Use the spend book below to log Tier 3 expenses (single entry place).</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    document.getElementById('spend-book')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Open spend book
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-text">This week’s Tier 3 transactions</div>
              <div className="mt-2 space-y-2">
                {tier3Tx.length === 0 ? (
                  <div className="text-sm text-muted">No Tier 3 expenses logged this week.</div>
                ) : (
                  tier3Tx.slice(0, 8).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-text">{t.payee}</div>
                        <div className="text-xs text-muted">{format(new Date(t.date), 'MMM d, HH:mm')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-text">{formatTzs(t.amountTzs)}</div>
                        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'delete_transaction', id: t.id })}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="warning">Shopping mode</Badge>
              </div>
              <div className="mt-1 text-xs text-muted">Reusable checklist + estimated vs actual costs.</div>
            </div>
            <div className="flex flex-wrap items-start justify-end gap-3">
              <div className="text-right">
                <div className="text-xs text-muted">Actual</div>
                <div className="text-sm font-semibold text-text">{formatTzs(shoppingSpent)}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowTemplate((s) => !s)}>
                {showTemplate ? 'Close list' : 'Edit list'}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {showTemplate ? <TemplateEditor weekStart={weekStart} template={state.shoppingTemplate} dispatch={dispatch} /> : null}

            {!shopping ? (
              <div className="text-sm text-muted">No shopping list for this week.</div>
            ) : (
              <ShoppingWeekList weekStart={weekStart} items={shopping.items} onDispatch={dispatch} />
            )}
          </CardBody>
        </Card>
      </div>

      <GoalsPanel tier={3} nowIso={status.nowIso} />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Spend book (month)</div>
            <div className="mt-1 text-xs text-muted">Household-style ledger for Tier 3. Log everything; review later.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setHideGoalLinked((s) => !s)}>
              {hideGoalLinked ? 'Show goal entries' : 'Hide goal entries'}
            </Button>
            <Badge tone="neutral">{format(now, 'MMMM yyyy')}</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4" id="spend-book">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
            <CategoryDonut title="By category" totalTzs={spendByCategory.total} rows={spendByCategory.rows} />
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="text-sm font-semibold text-text">Top categories</div>
              {spendByCategory.total <= 0 ? (
                <div className="mt-2 text-sm text-muted">No spend book entries yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {spendByCategory.rows.slice(0, 6).map((r) => (
                    <div key={r.categoryId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-xs text-muted">{r.name}</div>
                      <div className="text-xs font-semibold text-text">{formatTzs(r.amountTzs)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-[11px] text-muted">Note: this chart is for Tier 3 only (monthly).</div>
            </div>
          </div>

          <SpendBookAddForm
            categories={tier3Categories}
            goals={tier3GoalOptions}
            disabled={state.settings.readOnlyMode}
            onAdd={(input) => {
              const res = actions.addQuickExpense({
                tier: 3,
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

          {visibleMonthTx.length === 0 ? (
            <div className="text-sm text-muted">No Tier 3 entries yet this month.</div>
          ) : (
            <div className="space-y-2">
              {visibleMonthTx.slice(0, 50).map((t) => (
                <SpendBookRow
                  key={t.id}
                  tx={t}
                  categoryName={state.categories.find((c) => c.id === t.categoryId)?.name ?? t.categoryId}
                  categories={tier3Categories}
                  goals={tier3Goals.map((g) => ({ id: g.id, name: g.name }))}
                  goalName={t.goalId ? tier3GoalNameById.get(t.goalId) : undefined}
                  readOnly={state.settings.readOnlyMode}
                  onDelete={() => dispatch({ type: 'delete_transaction', id: t.id })}
                  onUpdate={(next) => dispatch({ type: 'update_transaction', tx: next })}
                />
              ))}
              {visibleMonthTx.length > 50 ? <div className="text-[11px] text-muted">Showing latest 50 entries.</div> : null}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function ShoppingWeekList({
  weekStart,
  items,
  onDispatch,
}: {
  weekStart: string
  items: Array<{
    id: string
    group: string
    name: string
    qty?: number
    unit?: string
    estimatedTzs: number
    actualTzs?: number
    purchased: boolean
  notes?: string
  }>
  onDispatch: ShoppingDispatch
}) {
  const sorted = useMemo(() => {
    return items
      .slice()
      .sort(
        (a, b) =>
          Number(a.purchased) - Number(b.purchased) ||
          a.group.localeCompare(b.group) ||
          a.name.localeCompare(b.name),
      )
  }, [items])

  const grouped = useMemo(() => {
    return sorted.reduce<Record<string, typeof sorted>>((acc, i) => {
      acc[i.group] = acc[i.group] ? [...acc[i.group], i] : [i]
      return acc
    }, {})
  }, [sorted])

  const groups = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped])

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <div className="text-xs font-semibold text-text">{g}</div>
          <div className="mt-2 space-y-2">
            {grouped[g].filter((i) => !i.purchased).map((i) => (
              <ShoppingRow key={i.id} weekStart={weekStart} item={i} onDispatch={onDispatch} />
            ))}
            {grouped[g].some((i) => i.purchased) ? (
              <div className="pt-1 text-[11px] font-semibold text-muted">Bought</div>
            ) : null}
            {grouped[g].filter((i) => i.purchased).map((i) => (
              <div key={i.id} className="opacity-85">
                <ShoppingRow weekStart={weekStart} item={i} onDispatch={onDispatch} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShoppingRow({
  weekStart,
  item: i,
  onDispatch,
}: {
  weekStart: string
  item: {
    id: string
    group: string
    name: string
    qty?: number
    unit?: string
    estimatedTzs: number
    actualTzs?: number
    purchased: boolean
    notes?: string
  }
  onDispatch: ShoppingDispatch
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text">
            {i.name}
            {i.qty ? (
              <span className="text-muted">
                {' '}
                • {i.qty}
                {i.unit ?? ''}
              </span>
            ) : i.unit ? (
              <span className="text-muted"> • {i.unit}</span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted">
            Est {formatTzs(i.estimatedTzs)}
            {i.notes ? <> • {i.notes}</> : null}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={i.purchased}
            onChange={(e) => onDispatch({ type: 'toggle_shopping_item', weekStart, itemId: i.id, purchased: e.target.checked })}
          />
          Bought
        </label>
      </div>
      {i.purchased ? (
        <div className="mt-2">
          <div className="text-xs text-muted">Actual (optional)</div>
          <Input
            value={i.actualTzs ?? ''}
            inputMode="numeric"
            placeholder={`${i.estimatedTzs}`}
            onChange={(e) => {
              const raw = e.target.value
              if (!raw) onDispatch({ type: 'set_shopping_item_actual', weekStart, itemId: i.id, actualTzs: undefined })
              else
                onDispatch({
                  type: 'set_shopping_item_actual',
                  weekStart,
                  itemId: i.id,
                  actualTzs: Math.max(0, Math.trunc(Number(raw))),
                })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function TemplateEditor({
  weekStart,
  template,
  dispatch,
}: {
  weekStart: string
  template: ShoppingTemplateItem[]
  dispatch: ShoppingDispatch
}) {
  const [group, setGroup] = useState('Groceries')
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [est, setEst] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">Default checklist (reusable)</div>
          <div className="mt-1 text-xs text-muted">Add/edit recurring items once; they appear every week.</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'sync_shopping_week_from_template', weekStart })}>
          Sync now
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs text-muted">Group</div>
          <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g., Proteins" />
        </div>
        <div>
          <div className="text-xs text-muted">Item</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Rice" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[120px] flex-1">
            <div className="text-xs text-muted">Qty</div>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="0" />
          </div>
          <div className="min-w-[120px] flex-1">
            <div className="text-xs text-muted">Unit</div>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, ltrs…" />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Est (TZS)</div>
          <Input value={est} onChange={(e) => setEst(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div>
          <div className="text-xs text-muted">Description (optional)</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="brand, size, store link…" />
        </div>
        <div className="pt-1">
          <Button
            variant="secondary"
            onClick={() => {
              const n = name.trim()
              if (!n) return
              const item: ShoppingTemplateItem = {
                id: newId('si'),
                group: group.trim() || 'Other',
                name: n,
                qty: qty.trim() ? Math.max(0, Number(qty)) : undefined,
                unit: unit.trim() ? unit.trim() : undefined,
                estimatedTzs: Math.max(0, Math.trunc(Number(est || '0'))),
                notes: notes.trim() ? notes.trim() : undefined,
              }
              dispatch({ type: 'add_shopping_template_item', item })
              dispatch({ type: 'sync_shopping_week_from_template', weekStart })
              setName('')
              setQty('')
              setUnit('')
              setEst('')
              setNotes('')
            }}
          >
            Add item
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {template.length === 0 ? (
          <div className="text-sm text-muted">No default items yet.</div>
        ) : (
          template
            .slice()
            .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
            .map((i) => (
              <TemplateItemRow key={i.id} item={i} dispatch={dispatch} weekStart={weekStart} />
            ))
        )}
      </div>
    </div>
  )
}

function TemplateItemRow({
  item,
  dispatch,
  weekStart,
}: {
  item: ShoppingTemplateItem
  dispatch: ShoppingDispatch
  weekStart: string
}) {
  const [editing, setEditing] = useState(false)
  const [group, setGroup] = useState(item.group)
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(item.qty?.toString() ?? '')
  const [unit, setUnit] = useState(item.unit ?? '')
  const [est, setEst] = useState(String(item.estimatedTzs ?? 0))
  const [notes, setNotes] = useState(item.notes ?? '')

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-panel px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text">
            {item.name}{' '}
            {item.qty ? (
              <span className="text-muted">
                • {item.qty}
                {item.unit ?? ''}
              </span>
            ) : item.unit ? (
              <span className="text-muted">• {item.unit}</span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted">
            {item.group} • Est {formatTzs(item.estimatedTzs ?? 0)}
            {item.notes ? <> • {item.notes}</> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const ok = window.confirm('Remove this item from your default checklist?')
              if (!ok) return
              dispatch({ type: 'delete_shopping_template_item', id: item.id })
              dispatch({ type: 'sync_shopping_week_from_template', weekStart })
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="space-y-3">
        <div>
          <div className="text-xs text-muted">Group</div>
          <Input value={group} onChange={(e) => setGroup(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted">Item</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[120px] flex-1">
            <div className="text-xs text-muted">Qty</div>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          </div>
          <div className="min-w-[120px] flex-1">
            <div className="text-xs text-muted">Unit</div>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Est (TZS)</div>
          <Input value={est} onChange={(e) => setEst(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <div className="text-xs text-muted">Description</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const next: ShoppingTemplateItem = {
                id: item.id,
                group: group.trim() || 'Other',
                name: name.trim() || item.name,
                qty: qty.trim() ? Math.max(0, Number(qty)) : undefined,
                unit: unit.trim() ? unit.trim() : undefined,
                estimatedTzs: Math.max(0, Math.trunc(Number(est || '0'))),
                notes: notes.trim() ? notes.trim() : undefined,
              }
              dispatch({ type: 'update_shopping_template_item', item: next })
              dispatch({ type: 'sync_shopping_week_from_template', weekStart })
              setEditing(false)
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setGroup(item.group)
              setName(item.name)
              setQty(item.qty?.toString() ?? '')
              setUnit(item.unit ?? '')
              setEst(String(item.estimatedTzs ?? 0))
              setNotes(item.notes ?? '')
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function CategoryDonut({
  title,
  totalTzs,
  rows,
}: {
  title: string
  totalTzs: number
  rows: Array<{ categoryId: string; name: string; amountTzs: number }>
}) {
  const palette = ['#22c55e', '#eab308', '#06b6d4', '#a855f7', '#f97316', '#ef4444', '#14b8a6', '#64748b', '#3b82f6']
  const total = Math.max(0, totalTzs)

  const slices = (() => {
    if (total <= 0) return []
    const top = rows.slice(0, 6)
    const rest = rows.slice(6)
    const restTotal = rest.reduce((acc, r) => acc + r.amountTzs, 0)
    const all = restTotal > 0 ? [...top, { categoryId: 'other', name: 'Other', amountTzs: restTotal }] : top
    return all.map((r, idx) => ({ ...r, color: palette[idx % palette.length] }))
  })()

  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 70
  const stroke = 14
  const circumference = 2 * Math.PI * r
  const lens = total > 0 ? slices.map((s) => (circumference * s.amountTzs) / total) : []
  const starts = lens.map((_, idx) => lens.slice(0, idx).reduce((acc, x) => acc + x, 0))

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="text-sm font-semibold text-text">{title}</div>
      {total <= 0 ? (
        <div className="mt-2 text-sm text-muted">No Tier 3 spending yet.</div>
      ) : (
        <div className="mt-3 flex items-center justify-center">
	          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
	            <g transform={`rotate(-90 ${cx} ${cy})`}>
	              <circle cx={cx} cy={cy} r={r} stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} fill="transparent" />
	              {slices.map((s, idx) => {
	                const len = lens[idx] ?? 0
	                const dash = `${len} ${circumference - len}`
	                const offset = starts[idx] ?? 0
	                return (
	                  <circle
	                    key={s.categoryId}
	                    cx={cx}
	                    cy={cy}
	                    r={r}
	                    stroke={s.color}
	                    strokeWidth={stroke}
	                    strokeDasharray={dash}
	                    strokeDashoffset={-offset}
	                    strokeLinecap="butt"
	                    fill="transparent"
	                  />
	                )
	              })}
	            </g>
            <text x={cx} y={cy - 4} textAnchor="middle" className="fill-text text-xs font-semibold">
              {formatTzs(total)}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted text-[11px]">
              Total (month)
            </text>
          </svg>
        </div>
      )}
    </div>
  )
}
