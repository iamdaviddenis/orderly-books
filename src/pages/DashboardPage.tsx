import { format } from 'date-fns'
import { useMemo } from 'react'
import { useApp } from '../app/store'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Badge } from '../ui/components/Badge'
import { Progress } from '../ui/components/Progress'
import { formatSignedTzs, formatTzs } from '../domain/money'
import { Button } from '../ui/components/Button'
import { forecastNextDays } from '../domain/engine/forecast'
import { startOfWeekIso, toIsoDay } from '../domain/dates'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const { state, status } = useApp()
  const navigate = useNavigate()

  const tier1Pct = useMemo(() => {
    const total = status.tier1.dueTotalTzs + status.tier1.paidTotalTzs
    if (total <= 0) return 100
    return Math.round((100 * status.tier1.paidTotalTzs) / total)
  }, [status.tier1.dueTotalTzs, status.tier1.paidTotalTzs])

  const forecast = useMemo(() => forecastNextDays(state, status.nowIso, 30), [state, status.nowIso])

  const spendingTrend = useMemo(() => {
    const now = new Date(status.nowIso)
    const currentWeekStartIso = startOfWeekIso(now, state.settings.weekStartsOn)
    const currentWeekStart = new Date(currentWeekStartIso)

    const weeks: Array<{ weekStart: string; label: string; t1: number; t2: number; t3: number; t4: number; total: number }> = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(currentWeekStart)
      start.setDate(start.getDate() - i * 7)
      const startIso = toIsoDay(start)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const startMs = start.getTime()
      const endMs = end.getTime()

      let t1 = 0
      let t2 = 0
      let t3 = 0
      let t4 = 0
      for (const tx of state.transactions) {
        if (tx.kind !== 'expense') continue
        const ms = new Date(tx.date).getTime()
        if (ms < startMs || ms >= endMs) continue
        if (tx.tier === 1) t1 += tx.amountTzs
        else if (tx.tier === 2) t2 += tx.amountTzs
        else if (tx.tier === 3) t3 += tx.amountTzs
        else if (tx.tier === 4) t4 += tx.amountTzs
      }
      const total = t1 + t2 + t3 + t4
      weeks.push({ weekStart: startIso, label: format(start, 'MMM d'), t1, t2, t3, t4, total })
    }

    const maxTotal = weeks.reduce((acc, w) => Math.max(acc, w.total), 0)
    return { weeks, maxTotal }
  }, [state.settings.weekStartsOn, state.transactions, status.nowIso])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-text">Dashboard</div>
        <div className="mt-1 text-sm text-muted">Discipline-first: critical obligations → growth → lifestyle → discretionary.</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
	          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="critical">Tier 1</Badge>
                <div className="text-sm font-semibold text-text">Critical obligations</div>
              </div>
              <div className="mt-1 text-xs text-muted">
                {state.settings.strictTier1Gate
                  ? 'Tier 1 stays the first focus. The app will remind you before discretionary spending while Tier 1 is pending.'
                  : 'Tier 1 stays the first focus. Reminders are softer when strict gate is off.'}
              </div>
            </div>
            {status.tier1.overdue.length > 0 ? <Badge tone="critical">Overdue</Badge> : status.tier1.isCompleteForCycle ? <Badge tone="growth">Cleared</Badge> : <Badge tone="warning">Pending</Badge>}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Remaining</div>
                <div className="text-lg font-semibold text-text">{formatTzs(status.tier1.remainingTzs)}</div>
              </div>
              <div className="text-xs text-muted">
                {status.tier1.nextDue ? (
                  <>
                    Next due: <span className="text-text">{status.tier1.nextDue.name}</span>
                  </>
                ) : (
                  <>No pending items</>
                )}
              </div>
            </div>
            <Progress value={tier1Pct} tone={status.tier1.overdue.length > 0 ? 'critical' : status.tier1.isCompleteForCycle ? 'growth' : 'warning'} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {status.tier1.overdue.slice(0, 2).map((o) => (
                <div key={o.id} className="rounded-xl border border-t1/30 bg-t1/10 p-3">
                  <div className="text-sm font-medium text-text">{o.name}</div>
                  <div className="mt-1 text-xs text-muted">Overdue • {formatTzs(o.amountTzs)}</div>
                </div>
              ))}
              {status.tier1.dueSoon.slice(0, 2).map((o) => (
                <div key={o.id} className="rounded-xl border border-t3/30 bg-t3/10 p-3">
                  <div className="text-sm font-medium text-text">{o.name}</div>
                  <div className="mt-1 text-xs text-muted">Due soon • {formatTzs(o.amountTzs)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text">Safe-to-spend</div>
              <Badge tone={status.safeToSpend.safeToSpendTzs > 0 ? 'growth' : 'locked'}>{status.safeToSpend.safeToSpendTzs > 0 ? 'Available' : 'Reserved'}</Badge>
            </div>
            <div className="mt-2 text-2xl font-semibold text-text">{formatTzs(status.safeToSpend.safeToSpendTzs)}</div>
            <div className="mt-1 text-xs text-muted">After Tier 1, planned Tier 2, and your weekly Tier 3 budget reserve.</div>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Cash on hand" value={formatTzs(status.safeToSpend.cashOnHandTzs)} />
            <Row label="Reserved Tier 1" value={formatTzs(status.safeToSpend.reservedTier1Tzs)} tone="critical" />
            <Row label="Reserved Tier 2" value={formatTzs(status.safeToSpend.reservedTier2Tzs)} tone="growth" />
            <Row label="Remaining Tier 3 week" value={formatTzs(status.safeToSpend.reservedTier3Tzs)} tone="warning" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text">Net worth</div>
              <Badge tone="neutral">Simple</Badge>
            </div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {formatTzs(state.netWorth.cashTzs + state.netWorth.savingsTzs + state.netWorth.investmentsTzs - state.netWorth.debtsTzs)}
            </div>
            <div className="mt-1 text-xs text-muted">Manual inputs (Settings → Net worth).</div>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Cash" value={formatTzs(state.netWorth.cashTzs)} />
            <Row label="Savings" value={formatTzs(state.netWorth.savingsTzs)} />
            <Row label="Investments" value={formatTzs(state.netWorth.investmentsTzs)} />
            <Row label="Debts" value={formatTzs(state.netWorth.debtsTzs)} tone="critical" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Spending trend</div>
            <div className="mt-1 text-xs text-muted">Weekly spending (last 8 weeks), stacked by tier.</div>
          </div>
          <Badge tone="neutral">Last 8 weeks</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <SpendingStackedBars weeks={spendingTrend.weeks} maxTotal={spendingTrend.maxTotal} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="critical">Tier 1</Badge>
            <Badge tone="growth">Tier 2</Badge>
            <Badge tone="warning">Tier 3</Badge>
            <Badge tone="locked">Tier 4</Badge>
            <div className="ml-auto">
              This week:{' '}
              <span className="font-semibold text-text">{formatTzs(spendingTrend.weeks[spendingTrend.weeks.length - 1]?.total ?? 0)}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Cash flow forecast (30 days)</div>
            <div className="mt-1 text-xs text-muted">Based on upcoming unpaid Tier 1 + Tier 2 due dates (no bank sync in MVP).</div>
          </div>
          {forecast.firstNegativeDateIso ? <Badge tone="critical">Shortfall risk</Badge> : <Badge tone="growth">Stable</Badge>}
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted">Min projected cash</div>
            <div className={forecast.minProjectedCashTzs < 0 ? 'text-sm font-semibold text-t1' : 'text-sm font-semibold text-text'}>
              {formatSignedTzs(forecast.minProjectedCashTzs)}
            </div>
          </div>
          {forecast.firstNegativeDateIso ? (
            <div className="text-xs text-muted">First projected negative date: {forecast.firstNegativeDateIso}</div>
          ) : (
            <div className="text-xs text-muted">No projected negative balance from upcoming Tier 1/2 events.</div>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            {forecast.events.slice(0, 6).map((e) => (
              <div key={`${e.dateIso}-${e.label}`} className="rounded-xl border border-border bg-bg p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={e.tier === 1 ? 'critical' : 'growth'}>T{e.tier}</Badge>
                  <div className="truncate text-sm text-text">{e.label}</div>
                </div>
                <div className="mt-1 text-xs text-muted">{e.dateIso}</div>
                <div className="mt-1 text-sm font-semibold text-text">{formatTzs(Math.abs(e.deltaTzs))}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="growth">Tier 2</Badge>
                <div className="text-sm font-semibold text-text">Investments & savings</div>
              </div>
	              <div className="mt-1 text-xs text-muted">{status.tier1.isCompleteForCycle ? 'Ready after Tier 1.' : 'Plan now; execute after Tier 1.'}</div>
	            </div>
	            <Badge tone={status.tier1.isCompleteForCycle ? 'growth' : 'locked'}>{status.tier1.isCompleteForCycle ? 'Ready' : 'Waiting'}</Badge>
	          </CardHeader>
	          <CardBody className="text-sm text-muted">
	            Keep Tier 2 consistent. If you must skip a transfer, the app will require a reason.
	          </CardBody>
	        </Card>

	        <Card>
	          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
	            <div className="min-w-0">
	              <div className="flex items-center gap-2">
	                <Badge tone="warning">Tier 3</Badge>
	                <div className="text-sm font-semibold text-text">Lifestyle (weekly)</div>
	              </div>
	              <div className="mt-1 text-xs text-muted">Controlled spending with 80%/100% alerts.</div>
	            </div>
	            {!status.tier1.isCompleteForCycle ? <Badge tone="warning">Essentials</Badge> : <Badge tone="warning">Active</Badge>}
	          </CardHeader>
	          <CardBody className="space-y-3">
	            <div className="text-sm text-muted">
	              Use the Tier 3 spend book to log household expenses. Shopping mode keeps a reusable checklist.
	            </div>
	            <div className="flex flex-wrap items-center gap-2">
	              <Button variant="secondary" onClick={() => navigate('/tier-3')}>
	                Open Tier 3
	              </Button>
	              {!status.tier1.isCompleteForCycle ? (
	                <Button variant="ghost" onClick={() => navigate('/tier-1')}>
	                  Review Tier 1
	                </Button>
	              ) : null}
	            </div>
	            {!status.tier1.isCompleteForCycle ? (
	              <div className="text-xs text-muted">Tier 1 is still pending — keep Tier 3 to essentials and clear Tier 1.</div>
	            ) : null}
	          </CardBody>
	        </Card>

	        <Card>
	          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
	            <div className="min-w-0">
	              <div className="flex items-center gap-2">
	                <Badge tone="locked">Tier 4</Badge>
	                <div className="text-sm font-semibold text-text">Discretionary</div>
	              </div>
	              <div className="mt-1 text-xs text-muted">Tier 4 is last. Use after Tier 1–3 (guardrails shown below).</div>
	            </div>
	            <Badge tone={status.locks.reasons.length > 0 ? 'warning' : 'growth'}>{status.locks.reasons.length > 0 ? 'Caution' : 'Ready'}</Badge>
	          </CardHeader>
	          <CardBody className="space-y-3 text-sm text-muted">
	            {status.locks.reasons.length > 0 ? (
	              <ul className="list-disc space-y-1 pl-5">
	                {status.locks.reasons.slice(0, 3).map((r) => (
	                  <li key={r}>{r}</li>
	                ))}
	              </ul>
	            ) : (
	              <div>All clear. Spend with freedom and zero guilt.</div>
	            )}
	            <div className="flex flex-wrap items-center gap-2">
	              <Button variant="secondary" onClick={() => navigate('/tier-4')}>
	                Open Tier 4
	              </Button>
	              {!status.tier1.isCompleteForCycle ? (
	                <Button variant="ghost" onClick={() => navigate('/tier-1')}>
	                  Review Tier 1
	                </Button>
	              ) : null}
	            </div>
	          </CardBody>
	        </Card>
	      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-text">Faithfulness score</div>
            <div className="mt-1 text-xs text-muted">Behavior feedback (0–100), based on tiers + reflections.</div>
          </div>
          <div className="text-2xl font-semibold text-text">{status.faithfulness.score}</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Progress value={status.faithfulness.score} tone={status.faithfulness.score >= 90 ? 'growth' : status.faithfulness.score >= 70 ? 'warning' : 'critical'} />
          <div className="text-sm text-muted">{status.faithfulness.note}</div>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'critical' | 'growth' | 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={tone === 'critical' ? 'text-xs text-t1' : tone === 'growth' ? 'text-xs text-t2' : tone === 'warning' ? 'text-xs text-t3' : 'text-xs text-text'}>
        {value}
      </div>
    </div>
  )
}

function SpendingStackedBars({
  weeks,
  maxTotal,
}: {
  weeks: Array<{ weekStart: string; label: string; t1: number; t2: number; t3: number; t4: number; total: number }>
  maxTotal: number
}) {
  if (maxTotal <= 0) {
    return <div className="text-sm text-muted">No expenses logged yet.</div>
  }

  const height = 120
  const barWidth = 18
  const gap = 12
  const width = weeks.length * (barWidth + gap) - gap

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none">
        {weeks.map((w, idx) => {
          const x = idx * (barWidth + gap)
          let y = height

          const segments: Array<{ value: number; className: string; label: string }> = [
            { value: w.t1, className: 'fill-t1/85', label: 'Tier 1' },
            { value: w.t2, className: 'fill-t2/85', label: 'Tier 2' },
            { value: w.t3, className: 'fill-t3/85', label: 'Tier 3' },
            { value: w.t4, className: 'fill-t4/85', label: 'Tier 4' },
          ]

          return (
            <g key={w.weekStart}>
              <title>
                {w.label}: {formatTzs(w.total)} (T1 {formatTzs(w.t1)}, T2 {formatTzs(w.t2)}, T3 {formatTzs(w.t3)}, T4 {formatTzs(w.t4)})
              </title>
              <rect x={x} y={0} width={barWidth} height={height} className="fill-border/15" rx={6} />
              {segments.map((s) => {
                if (s.value <= 0) return null
                const segHeight = Math.max(1, (height * s.value) / maxTotal)
                y -= segHeight
                return <rect key={`${w.weekStart}-${s.label}`} x={x} y={y} width={barWidth} height={segHeight} className={s.className} />
              })}
              {idx === weeks.length - 1 ? <rect x={x - 2} y={0} width={barWidth + 4} height={height} className="fill-none stroke-border" rx={8} /> : null}
            </g>
          )
        })}
      </svg>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <div>{weeks[0]?.label}</div>
        <div>{weeks[weeks.length - 1]?.label}</div>
      </div>
    </div>
  )
}
