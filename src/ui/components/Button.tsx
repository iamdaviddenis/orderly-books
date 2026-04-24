import type React from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-sm',
        variant === 'primary' && 'border border-text bg-text text-bg shadow-sm hover:-translate-y-0.5 hover:bg-text/92 hover:shadow-md',
        variant === 'secondary' && 'border border-border bg-panel/90 text-text shadow-sm hover:-translate-y-0.5 hover:bg-panel hover:shadow-md',
        variant === 'danger' && 'border border-t1 bg-t1 text-white shadow-sm hover:-translate-y-0.5 hover:bg-t1/92 hover:shadow-md',
        variant === 'ghost' && 'bg-transparent text-text hover:bg-panel/75',
        className,
      )}
      {...props}
    />
  )
}
