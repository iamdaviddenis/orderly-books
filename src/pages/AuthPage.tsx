import { useState } from 'react'
import { useAuth } from '../app/auth'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input } from '../ui/components/Input'

export function AuthPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold text-text">Sign in</div>
              <div className="mt-1 text-sm text-muted">Cloud sync is enabled. Sign in to load and store your data in Supabase.</div>
            </div>
            <Badge tone="neutral">Supabase</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
            Account creation is disabled. Sign in with your existing account.
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted">Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@email.com" />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted">Password</div>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
          </div>

          {error ? <div className="text-sm text-t1">{error}</div> : null}

          <Button
            onClick={async () => {
              setError(null)
              const e = email.trim()
              const p = password
              if (!e || p.length < 6) return setError('Enter a valid email and a password (6+ chars).')
              const res = await auth.signInWithPassword(e, p)
              if (!res.ok) setError(res.error)
            }}
          >
            Sign in
          </Button>

          <div className="text-xs text-muted">
            Note: This is an MVP auth screen. For production, add password reset, MFA, and stronger account recovery.
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
