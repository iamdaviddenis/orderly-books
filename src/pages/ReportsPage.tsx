import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import { formatSignedTzs, formatTzs } from '../domain/money'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { TextArea } from '../ui/components/Input'
import { detectRecurringCandidates } from '../domain/engine/recurring'
import { Input } from '../ui/components/Input'
import { newId } from '../domain/ids'
import { Progress } from '../ui/components/Progress'
import { printMonthlyReportToPdf } from '../domain/services/reportPrint'

export function ReportsPage() {
  const { state, status, dispatch } = useApp()
  const now = new Date(status.nowIso)
  const monthKey = format(now, 'yyyy-MM')
  const monthStartMs = startOfMonth(now).getTime()
  const monthEndMs = endOfMonth(now).getTime()
  const [statementSort, setStatementSort] = useState<'amount_desc' | 'date_desc'>('amount_desc')

  const monthTx = state.transactions.filter((t) => {
    const ms = new Date(t.date).getTime()
    return ms >= monthStartMs && ms <= monthEndMs
  })

  const income = monthTx.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amountTzs, 0)
  const spend = (tier: number) => monthTx.filter((t) => t.kind === 'expense' && t.tier === tier).reduce((a, t) => a + t.amountTzs, 0)
  const byTier = { t1: spend(1), t2: spend(2), t3: spend(3), t4: spend(4) }

  const totalSpend = byTier.t1 + byTier.t2 + byTier.t3 + byTier.t4
  const remainingCash = income - totalSpend

  const [reflectionText, setReflectionText] = useState('')

  const [incomePayee, setIncomePayee] = useState('Salary')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeDate, setIncomeDate] = useState(format(now, 'yyyy-MM-dd'))

  const goalTargets = useMemo(() => {
    const out = { t1: 0, t2: 0, t3: 0, t4: 0 }
    for (const g of state.goals) {
      if (g.status === 'cancelled') continue
      const ms = new Date(g.dueDate).getTime()
      if (ms < monthStartMs || ms > monthEndMs) continue
      if (g.tier === 1) out.t1 += g.targetTzs
      else if (g.tier === 2) out.t2 += g.targetTzs
      else if (g.tier === 3) out.t3 += g.targetTzs
      else out.t4 += g.targetTzs
    }
    return out
  }, [monthEndMs, monthStartMs, state.goals])

  const existingAlloc = state.allocations.find((a) => a.month === monthKey)
  const targetsTotal = goalTargets.t1 + goalTargets.t2 + goalTargets.t3 + goalTargets.t4
  const [allocT1, setAllocT1] = useState(String(existingAlloc?.tier1Tzs ?? 0))
  const [allocT2, setAllocT2] = useState(String(existingAlloc?.tier2Tzs ?? 0))
  const [allocT3, setAllocT3] = useState(String(existingAlloc?.tier3Tzs ?? 0))
  const [allocT4, setAllocT4] = useState(String(existingAlloc?.tier4Tzs ?? 0))
  const allocSum =
    Math.max(0, Math.trunc(Number(allocT1))) +
    Math.max(0, Math.trunc(Number(allocT2))) +
    Math.max(0, Math.trunc(Number(allocT3))) +
    Math.max(0, Math.trunc(Number(allocT4)))
  const allocUnassigned = Math.max(0, income - allocSum)

  const insights = (() => {
    const tips: string[] = []
    if (status.tier1.overdue.length > 0) tips.push('Tier 1 has overdue items. Clear them first to restore freedom.')
    if (byTier.t3 > 0 && byTier.t1 === 0 && !status.tier1.isCompleteForCycle) tips.push('Tier 3 spending exists while Tier 1 is not cleared. Reinforce the gate.')
    if (income > 0 && byTier.t2 / income < 0.15) tips.push('Tier 2 is under 15% of income this month. Consider raising your growth allocation.')
    if (tips.length === 0) tips.push('Solid month. Keep the tiers consistent and build an emergency buffer.')
    return tips
  })()

  const recurring = detectRecurringCandidates(state.transactions)
  const categoryNameById = useMemo(() => new Map(state.categories.map((c) => [c.id, c.name])), [state.categories])
  const goalNameById = useMemo(() => new Map(state.goals.map((g) => [g.id, g.name])), [state.goals])
  const monthExpenses = monthTx.filter((t) => t.kind === 'expense')
  const sortedExpenses = monthExpenses.slice().sort((a, b) => {
    if (statementSort === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime()
    return b.amountTzs - a.amountTzs
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-text">Monthly report</div>
          <div className="mt-1 text-sm text-muted">{format(now, 'MMMM yyyy')} • Tier-based accountability.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const statement = monthTx
                .filter((t) => t.kind === 'expense')
                .map((t) => ({
                  date: t.date,
                  tier: t.tier,
                  payee: t.payee,
                  category: categoryNameById.get(t.categoryId) ?? t.categoryId,
                  amountTzs: t.amountTzs,
                  notes: t.notes,
                }))
              printMonthlyReportToPdf({
                monthLabel: format(now, 'MMMM yyyy'),
                incomeTzs: income,
                targets: goalTargets,
                actuals: byTier,
                transactions: statement,
              })
            }}
          >
            Export PDF
          </Button>
          <Badge tone={status.faithfulness.score >= 90 ? 'growth' : status.faithfulness.score >= 70 ? 'warning' : 'critical'}>
            Faithfulness {status.faithfulness.score}/100
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Income (log it here)</div>
            <div className="mt-1 text-xs text-muted">This unlocks % of income and zero-based budgeting accuracy.</div>
          </div>
          <Badge tone={income > 0 ? 'growth' : 'warning'}>{income > 0 ? `Logged: ${formatTzs(income)}` : 'No income yet'}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <div className="text-xs text-muted">Date</div>
              <Input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-muted">Source</div>
              <Input value={incomePayee} onChange={(e) => setIncomePayee(e.target.value)} placeholder="e.g., Salary, Contract" />
            </div>
            <div>
              <div className="text-xs text-muted">Amount (TZS)</div>
              <Input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
            <div className="md:col-span-6 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const payee = incomePayee.trim()
                  const amountTzs = Math.max(0, Math.trunc(Number(incomeAmount)))
                  if (!payee || amountTzs <= 0 || !incomeDate) return
                  const iso = new Date(`${incomeDate}T12:00`).toISOString()
                  dispatch({
                    type: 'add_transaction',
                    tx: {
                      id: newId('tx'),
                      kind: 'income',
                      tier: 1,
                      date: iso,
                      amountTzs,
                      payee,
                      categoryId: 'cat_income',
                    },
                  })
                  setIncomeAmount('')
                }}
              >
                Add income
              </Button>
              <div className="text-xs text-muted">
                Tip: Income is calculated from your logged income transactions (not from “starting cash”).
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-semibold text-text">Tier performance (goals vs actual)</div>
            <div className="mt-1 text-xs text-muted">Targets come from your goals due this month. Actuals come from logged expenses.</div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <TierTargetRow label="Tier 1 (Critical)" tone="critical" target={goalTargets.t1} actual={byTier.t1} />
            <TierTargetRow label="Tier 2 (Growth)" tone="growth" target={goalTargets.t2} actual={byTier.t2} />
            <TierTargetRow label="Tier 3 (Lifestyle)" tone="warning" target={goalTargets.t3} actual={byTier.t3} />
            <TierTargetRow label="Tier 4 (Discretionary)" tone="locked" target={goalTargets.t4} actual={byTier.t4} />
            <div className="mt-3 rounded-xl border border-border bg-bg p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted">Income (logged)</div>
                <div className="text-sm font-semibold text-text">{formatTzs(income)}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted">Targets total (goals due this month)</div>
                <div className="text-sm font-semibold text-text">{formatTzs(targetsTotal)}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted">Total spent (logged)</div>
                <div className="text-sm font-semibold text-text">{formatTzs(totalSpend)}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted">Variance (targets - actual)</div>
                <div className="text-sm font-semibold text-text">{formatSignedTzs(targetsTotal - totalSpend)}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs text-muted">Remaining cash (income - actual spend)</div>
                <div className="text-sm font-semibold text-text">{formatSignedTzs(remainingCash)}</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-text">Insights</div>
            <div className="mt-1 text-xs text-muted">AI-like nudges (rule-based, MVP).</div>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-muted">
            <ul className="list-disc space-y-1 pl-5">
              {insights.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {recurring.length > 0 ? (
              <div className="mt-4">
                <div className="text-xs font-medium text-text">Recurring detected</div>
                <div className="mt-1 space-y-1 text-xs text-muted">
                  {recurring.map((r) => (
                    <div key={r.key}>
                      {r.payee} — {formatTzs(r.amountTzs)} ({r.cadence}, {r.occurrences}×)
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Statement (what adds up to “Total spent”)</div>
            <div className="mt-1 text-xs text-muted">
              If “Total spent” looks wrong, find the entry here and delete it (or void it if it came from Tier 1/2 “mark as paid”).
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{sortedExpenses.length} entries</Badge>
            <Button
              size="sm"
              variant={statementSort === 'amount_desc' ? 'primary' : 'secondary'}
              onClick={() => setStatementSort('amount_desc')}
            >
              Sort: Amount
            </Button>
            <Button
              size="sm"
              variant={statementSort === 'date_desc' ? 'primary' : 'secondary'}
              onClick={() => setStatementSort('date_desc')}
            >
              Sort: Date
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {sortedExpenses.length === 0 ? (
            <div className="text-sm text-muted">No expense transactions logged for {format(now, 'MMMM yyyy')}.</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-bg">
                  <tr className="text-left text-xs text-muted">
                    <th className="whitespace-nowrap px-3 py-2">Date</th>
                    <th className="whitespace-nowrap px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Payee</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedExpenses.map((t) => {
                    const tone = (t.tier === 1 ? 'critical' : t.tier === 2 ? 'growth' : t.tier === 3 ? 'warning' : 'locked') as
                      | 'critical'
                      | 'growth'
                      | 'warning'
                      | 'locked'
                    const category = categoryNameById.get(t.categoryId) ?? t.categoryId
                    const goal = t.goalId ? goalNameById.get(t.goalId) ?? t.goalId : undefined
                    const source =
                      t.linked?.type === 'obligation'
                        ? 'Tier 1 obligation'
                        : t.linked?.type === 'transfer'
                          ? 'Tier 2 transfer'
                          : goal
                            ? `Goal: ${goal}`
                            : 'Spend book'
                    const actionLabel = t.linked ? 'Void' : 'Delete'
                    return (
                      <tr key={t.id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{format(new Date(t.date), 'yyyy-MM-dd')}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <Badge tone={tone}>T{t.tier}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-text">{t.payee}</div>
                          {t.notes ? <div className="mt-0.5 text-xs text-muted line-clamp-2">{t.notes}</div> : null}
                        </td>
                        <td className="px-3 py-2 text-sm text-muted">{category}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-text">{formatTzs(t.amountTzs)}</td>
                        <td className="px-3 py-2 text-sm text-muted">{source}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant={t.linked ? 'secondary' : 'ghost'}
                            className={t.linked ? undefined : 'text-t1'}
                            disabled={state.settings.readOnlyMode}
                            onClick={() => {
                              const label = `${formatTzs(t.amountTzs)} • ${t.payee}`
                              if (t.linked?.type === 'obligation') {
                                if (!window.confirm(`Void this Tier 1 payment?\n\n${label}`)) return
                                dispatch({ type: 'void_obligation_payment', obligationId: t.linked.id, txId: t.id })
                                return
                              }
                              if (t.linked?.type === 'transfer') {
                                if (!window.confirm(`Void this Tier 2 transfer payment?\n\n${label}`)) return
                                dispatch({ type: 'void_transfer_payment', transferId: t.linked.id, txId: t.id })
                                return
                              }
                              if (!window.confirm(`Delete this entry?\n\n${label}`)) return
                              dispatch({ type: 'delete_transaction', id: t.id })
                            }}
                          >
                            {actionLabel}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {state.settings.readOnlyMode ? (
            <div className="mt-2 text-xs text-muted">Read-only mode is enabled; actions are disabled.</div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Zero-based income assignment (optional)</div>
            <div className="mt-1 text-xs text-muted">
              Assign your logged income across tiers. This is separate from goal targets; it’s for budget completeness + discipline reminders.
            </div>
          </div>
          <Badge tone={income > 0 && allocUnassigned === 0 ? 'growth' : 'warning'}>
            Unassigned: {formatTzs(allocUnassigned)}
          </Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Tier 1" value={allocT1} onChange={setAllocT1} />
            <Field label="Tier 2" value={allocT2} onChange={setAllocT2} />
            <Field label="Tier 3" value={allocT3} onChange={setAllocT3} />
            <Field label="Tier 4" value={allocT4} onChange={setAllocT4} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 text-sm">
            <div className="text-muted">
              Income: <span className="font-semibold text-text">{formatTzs(income)}</span> • Allocated:{' '}
              <span className="font-semibold text-text">{formatTzs(allocSum)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAllocT1(String(byTier.t1))
                  setAllocT2(String(byTier.t2))
                  setAllocT3(String(byTier.t3))
                  setAllocT4(String(Math.max(0, income - (byTier.t1 + byTier.t2 + byTier.t3))))
                }}
              >
                Auto-fill
              </Button>
              <Button
                onClick={() => {
                  dispatch({
                    type: 'set_allocation',
                    allocation: {
                      month: monthKey,
                      incomeTzs: Math.max(0, Math.trunc(income)),
                      tier1Tzs: Math.max(0, Math.trunc(Number(allocT1))),
                      tier2Tzs: Math.max(0, Math.trunc(Number(allocT2))),
                      tier3Tzs: Math.max(0, Math.trunc(Number(allocT3))),
                      tier4Tzs: Math.max(0, Math.trunc(Number(allocT4))),
                    },
                  })
                }}
              >
                Save allocation
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted">
            Tip: Keep Tier 1 and Tier 2 assigned first. Lifestyle fits inside Tier 3. Tier 4 is “what remains”.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Reflection</div>
            <div className="mt-1 text-xs text-muted">Weekly/monthly reflection improves your score and reinforces habits.</div>
          </div>
          <Badge tone="neutral">{state.reflections.length} logged</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <TextArea value={reflectionText} onChange={(e) => setReflectionText(e.target.value)} rows={3} placeholder="What did I learn this month? What will I adjust next week?" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const text = reflectionText.trim()
                if (!text) return
                dispatch({ type: 'add_reflection', cadence: 'weekly', text, at: new Date().toISOString() })
                setReflectionText('')
              }}
            >
              Log weekly reflection
            </Button>
            <Button
              onClick={() => {
                const text = reflectionText.trim()
                if (!text) return
                dispatch({ type: 'add_reflection', cadence: 'monthly', text, at: new Date().toISOString() })
                setReflectionText('')
              }}
            >
              Log monthly reflection
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-muted">{label} (TZS)</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" />
    </div>
  )
}

function TierTargetRow({
  label,
  target,
  actual,
  tone,
}: {
  label: string
  target: number
  actual: number
  tone: 'critical' | 'growth' | 'warning' | 'locked'
}) {
  const pct = target > 0 ? Math.round((100 * actual) / target) : 0
  const progress = target > 0 ? (100 * Math.min(target, actual)) / target : 0
  const barTone = tone === 'critical' ? 'critical' : tone === 'growth' ? 'growth' : tone === 'warning' ? 'warning' : 'neutral'

  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={tone}>{label}</Badge>
            <div className="text-xs text-muted">{target > 0 ? `${pct}% of target` : 'No target set'}</div>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Actual: <span className="text-text">{formatTzs(actual)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-text">{formatTzs(target)}</div>
          <div className="text-[11px] text-muted">Target</div>
        </div>
      </div>
      {target > 0 ? <Progress value={progress} tone={barTone} className="mt-2" /> : null}
    </div>
  )
}
