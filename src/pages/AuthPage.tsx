import { useState } from 'react'
import { useAuth } from '../app/auth'
import { Badge } from '../ui/components/Badge'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input } from '../ui/components/Input'

type Mode = 'sign_in' | 'sign_up'

export function AuthPage() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isSignUp = mode === 'sign_up'

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold text-text">{isSignUp ? 'Create your account' : 'Sign in'}</div>
              <div className="mt-1 text-sm text-muted">
                {isSignUp
                  ? 'Create an Orderly Books account to save your data securely in the cloud.'
                  : 'Sign in to load and sync your Orderly Books data with Supabase.'}
              </div>
            </div>
            <Badge tone="neutral">Orderly Books</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-bg/70 p-1">
            <Button size="sm" variant={isSignUp ? 'ghost' : 'primary'} onClick={() => setMode('sign_in')}>
              Sign in
            </Button>
            <Button size="sm" variant={isSignUp ? 'primary' : 'ghost'} onClick={() => setMode('sign_up')}>
              Create account
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-bg/70 px-3 py-2 text-sm text-muted">
            {isSignUp
              ? 'Every account gets its own private finance data. Your records stay isolated by Supabase access rules.'
              : 'Use your existing account email and password. If you just created an account, confirm your email first if required.'}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted">Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@email.com" />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted">Password</div>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} />
          </div>
          {isSignUp ? (
            <div className="space-y-2">
              <div className="text-xs text-muted">Confirm password</div>
              <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" />
            </div>
          ) : null}

          {error ? <div className="rounded-xl border border-t1/30 bg-t1/10 px-3 py-2 text-sm text-t1">{error}</div> : null}
          {success ? <div className="rounded-xl border border-t2/30 bg-t2/10 px-3 py-2 text-sm text-t2">{success}</div> : null}

          <Button
            onClick={async () => {
              setError(null)
              setSuccess(null)

              const e = email.trim()
              const p = password
              if (!e || p.length < 6) return setError('Enter a valid email and a password with at least 6 characters.')

              if (isSignUp) {
                if (p !== confirmPassword) return setError('Passwords do not match.')
                const res = await auth.signUpWithPassword(e, p)
                if (!res.ok) return setError(res.error)
                setSuccess(res.message ?? 'Account created successfully.')
                if (res.needsEmailConfirmation) {
                  setMode('sign_in')
                  setPassword('')
                  setConfirmPassword('')
                }
                return
              }

              const res = await auth.signInWithPassword(e, p)
              if (!res.ok) return setError(res.error)
            }}
          >
            {isSignUp ? 'Create account' : 'Sign in'}
          </Button>

          <div className="text-xs text-muted">
            This is now multi-user ready for normal email/password access. Password reset, MFA, and stronger recovery flows can be added next.
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
