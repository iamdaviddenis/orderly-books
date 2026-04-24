import clsx from 'clsx'
import type React from 'react'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-[28px] border border-border/80 bg-panel/95 shadow-soft backdrop-blur-sm', className)} {...props} />
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('p-4 pb-3 sm:p-5 sm:pb-3', className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />
}
