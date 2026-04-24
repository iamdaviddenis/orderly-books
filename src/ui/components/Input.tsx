import clsx from 'clsx'
import type React from 'react'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-11 w-full rounded-xl border border-border/80 bg-bg/70 px-3.5 text-sm text-text shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-text/20',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-xl border border-border/80 bg-bg/70 px-3.5 py-2.5 text-sm text-text shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-text/20',
        className,
      )}
      {...props}
    />
  )
}
