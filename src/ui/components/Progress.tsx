import clsx from 'clsx'

export function Progress({
  value,
  tone = 'neutral',
  className,
}: {
  value: number
  tone?: 'critical' | 'growth' | 'warning' | 'neutral'
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const bar =
    tone === 'critical' ? 'bg-t1' : tone === 'growth' ? 'bg-t2' : tone === 'warning' ? 'bg-t3' : 'bg-text'
  return (
    <div className={clsx('h-2 w-full rounded-full bg-border/60 overflow-hidden', className)}>
      <div className={clsx('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}
