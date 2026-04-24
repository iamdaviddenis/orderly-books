import { addMonths, addWeeks, addYears, formatISO, isAfter, isBefore, startOfWeek } from 'date-fns'
import type { IsoDate, Recurrence } from './schema'

export function isoNow(): IsoDate {
  return new Date().toISOString()
}

export function toIsoDate(d: Date): IsoDate {
  return formatISO(d)
}

export function toIsoDay(d: Date): IsoDate {
  return formatISO(d, { representation: 'date' })
}

export function startOfWeekIso(date: Date, weekStartsOn: 0 | 1): IsoDate {
  return toIsoDay(startOfWeek(date, { weekStartsOn }))
}

export function compareIso(a: IsoDate, b: IsoDate) {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return da === db ? 0 : da < db ? -1 : 1
}

export function isIsoBefore(a: IsoDate, b: IsoDate) {
  return isBefore(new Date(a), new Date(b))
}

export function isIsoAfter(a: IsoDate, b: IsoDate) {
  return isAfter(new Date(a), new Date(b))
}

export function nextDueDate(currentDue: IsoDate, recurrence: Recurrence): IsoDate {
  const d = new Date(currentDue)
  switch (recurrence) {
    case 'one_time':
      return currentDue
    case 'weekly':
      return toIsoDay(addWeeks(d, 1))
    case 'monthly':
      return toIsoDay(addMonths(d, 1))
    case 'every_6_months':
      return toIsoDay(addMonths(d, 6))
    case 'yearly':
      return toIsoDay(addYears(d, 1))
  }
}

export function previousDueDate(currentDue: IsoDate, recurrence: Recurrence): IsoDate {
  const d = new Date(currentDue)
  switch (recurrence) {
    case 'one_time':
      return currentDue
    case 'weekly':
      return toIsoDay(addWeeks(d, -1))
    case 'monthly':
      return toIsoDay(addMonths(d, -1))
    case 'every_6_months':
      return toIsoDay(addMonths(d, -6))
    case 'yearly':
      return toIsoDay(addYears(d, -1))
  }
}
