import clsx from 'clsx'
import type React from 'react'

type Tone = 'critical' | 'growth' | 'warning' | 'locked' | 'neutral'

const toneClass: Record<Tone, string> = {
  critical: 'bg-t1/15 text-t1 border-t1/30',
  growth: 'bg-t2/15 text-t2 border-t2/30',
  warning: 'bg-t3/15 text-t3 border-t3/30',
  locked: 'bg-t4/15 text-t4 border-t4/30',
  neutral: 'bg-panel text-muted border-border',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', toneClass[tone], className)} {...props} />
  )
}

