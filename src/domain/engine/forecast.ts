import { addDays, endOfDay, isWithinInterval, startOfDay } from 'date-fns'
import type { AppState, IsoDate, MoneyTzs } from '../schema'
import { computeCashOnHandTzs } from './disciplineEngine'
import { remainingForObligation } from './obligationPayments'

export type ForecastResult = {
  horizonDays: number
  startCashTzs: MoneyTzs
  minProjectedCashTzs: MoneyTzs
  firstNegativeDateIso?: IsoDate
  events: Array<{ dateIso: IsoDate; label: string; deltaTzs: MoneyTzs; tier: 1 | 2 }>
}

export function forecastNextDays(state: AppState, nowIso: IsoDate, horizonDays = 30): ForecastResult {
  const now = new Date(nowIso)
  const startCashTzs = computeCashOnHandTzs(state)

  const end = addDays(now, horizonDays)
  const interval = { start: startOfDay(now), end: endOfDay(end) }

  const events: ForecastResult['events'] = []
  for (const o of state.obligations) {
    const d = new Date(o.dueDate)
    if (!isWithinInterval(d, interval)) continue
    const remaining = remainingForObligation(state.transactions, o)
    if (remaining <= 0) continue
    events.push({ dateIso: o.dueDate, label: o.name, deltaTzs: (0 - remaining) as MoneyTzs, tier: 1 })
  }
  for (const t of state.plannedTransfers) {
    if (t.paidAt) continue
    const d = new Date(t.dueDate)
    if (!isWithinInterval(d, interval)) continue
    events.push({ dateIso: t.dueDate, label: t.name, deltaTzs: (0 - t.amountTzs) as MoneyTzs, tier: 2 })
  }

  events.sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime())

  let cash = startCashTzs
  let minProjectedCashTzs = cash
  let firstNegativeDateIso: IsoDate | undefined
  for (const e of events) {
    cash = (cash + e.deltaTzs) as MoneyTzs
    if (cash < minProjectedCashTzs) minProjectedCashTzs = cash
    if (!firstNegativeDateIso && cash < 0) firstNegativeDateIso = e.dateIso
  }

  return { horizonDays, startCashTzs, minProjectedCashTzs, firstNegativeDateIso, events }
}
