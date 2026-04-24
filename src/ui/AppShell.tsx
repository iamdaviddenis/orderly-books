import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useApp } from '../app/store'
import { useAuth } from '../app/auth'
import { Badge } from './components/Badge'
import { Button } from './components/Button'
import { formatTzs } from '../domain/money'

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tier-1', label: 'Tier 1' },
  { to: '/tier-2', label: 'Tier 2' },
  { to: '/tier-3', label: 'Tier 3' },
  { to: '/tier-4', label: 'Tier 4' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useApp()
  const auth = useAuth()
  const navigate = useNavigate()
  const top = status.alerts[0]

  return (
    <div className="min-h-screen">
      {top ? (
        <div
          className={clsx(
            'sticky top-0 z-20 border-b px-4 py-3 md:top-[env(safe-area-inset-top)]',
            top.severity === 'critical' && 'bg-t1/10 border-t1/30',
            top.severity === 'warning' && 'bg-t3/10 border-t3/30',
            top.severity === 'growth' && 'bg-t2/10 border-t2/30',
            top.severity === 'info' && 'bg-panel border-border',
          )}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    top.severity === 'critical'
                      ? 'critical'
                      : top.severity === 'warning'
                        ? 'warning'
                        : top.severity === 'growth'
                          ? 'growth'
                          : 'neutral'
                  }
                >
                  {top.title}
                </Badge>
                <div className="truncate text-sm text-text">{top.message}</div>
              </div>
            </div>
            {top.cta ? (
              <Button size="sm" variant={top.severity === 'critical' ? 'danger' : 'secondary'} onClick={() => navigate(top.cta!.to)}>
                {top.cta.label}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 space-y-3 md:hidden">
          <div className="rounded-[28px] border border-border/80 bg-panel/95 p-4 shadow-soft backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-text text-sm font-semibold text-bg shadow-sm">
                    OB
                  </div>
                  <div>
                    <div className="text-base font-semibold text-text">Orderly Books</div>
                    <div className="text-xs text-muted">A finance system for ordered priorities.</div>
                  </div>
                </div>
              </div>
              <Badge tone={status.safeToSpend.safeToSpendTzs > 0 ? 'growth' : 'warning'}>
                {formatTzs(status.safeToSpend.safeToSpendTzs)}
              </Badge>
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto pb-1">
            <nav className="flex min-w-max gap-2 px-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-full border px-3 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'border-text bg-text text-bg shadow-sm'
                        : 'border-border bg-panel/90 text-muted hover:border-border/80 hover:text-text',
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <span>{n.label}</span>
                    {n.to === '/tier-1' && status.tier1.overdue.length > 0 ? <span className="h-2 w-2 rounded-full bg-t1" /> : null}
                  </span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6">
          <aside className="hidden md:block md:sticky md:top-[calc(env(safe-area-inset-top)+1rem)] md:h-[calc(100vh-6rem)]">
            <div className="rounded-[30px] border border-border/80 bg-panel/95 p-5 shadow-soft backdrop-blur">
              <div className="mb-5 border-b border-border/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-text text-sm font-semibold text-bg shadow-sm">
                    OB
                  </div>
                  <div>
                    <div className="text-base font-semibold text-text">Orderly Books</div>
                    <div className="mt-1 text-xs text-muted">Money, arranged by priority.</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-border/80 bg-bg/70 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Safe to spend</div>
                  <div className="mt-1 text-xl font-semibold text-text">{formatTzs(status.safeToSpend.safeToSpendTzs)}</div>
                </div>
              </div>

              <nav className="flex flex-col gap-1.5">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-2xl border px-3 py-3 text-sm transition-all',
                      isActive
                        ? 'border-border bg-bg/90 text-text shadow-sm'
                        : 'border-transparent text-muted hover:border-border/70 hover:bg-bg/55 hover:text-text',
                    )
                  }
                >
                  <span className="flex items-center justify-between">
                    <span>{n.label}</span>
                    {n.to === '/tier-1' && status.tier1.overdue.length > 0 ? <Badge tone="critical">Overdue</Badge> : null}
                  </span>
                </NavLink>
              ))}
            </nav>

              {auth.enabled && auth.user ? (
                <div className="mt-5 border-t border-border/80 pt-4">
                  <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-xs text-muted truncate">{auth.user.email}</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await auth.signOut()
                    }}
                  >
                    Sign out
                  </Button>
                </div>
                </div>
              ) : null}
            </div>
          </aside>
          <main className="min-w-0 pb-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
