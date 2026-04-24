export function formatTzs(amountTzs: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(Math.trunc(amountTzs))
}

export function formatSignedTzs(amountTzs: number) {
  const sign = amountTzs < 0 ? '-' : ''
  return `${sign}${formatTzs(Math.abs(Math.trunc(amountTzs)))}`
}

export function clampNonNegativeInt(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}
