/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseEnabled, supabase } from '../data/supabaseClient'

type AuthResult = { ok: true } | { ok: false; error: string }
type SignUpResult = { ok: true; needsEmailConfirmation?: boolean; message?: string } | { ok: false; error: string }

type AuthContextValue = {
  enabled: boolean
  loading: boolean
  session: Session | null
  user: User | null
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signUpWithPassword: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<AuthResult>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState<boolean>(isSupabaseEnabled)
  const [session, setSession] = React.useState<Session | null>(null)

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setSession(null)
      return
    }

    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          setSession(null)
        } else {
          setSession(data.session)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null

  const value = React.useMemo<AuthContextValue>(() => {
    return {
      enabled: isSupabaseEnabled,
      loading,
      session,
      user,
      signInWithPassword: async (email, password) => {
        if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: error.message }
        return { ok: true }
      },
      signUpWithPassword: async (email, password) => {
        if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { ok: false, error: error.message }
        const needsEmailConfirmation = !data.session
        return {
          ok: true,
          needsEmailConfirmation,
          message: needsEmailConfirmation
            ? 'Account created. Check your email to confirm your account before signing in.'
            : 'Account created. You are now signed in.',
        }
      },
      signOut: async () => {
        if (!supabase) return { ok: true }
        const { error } = await supabase.auth.signOut()
        if (error) return { ok: false, error: error.message }
        return { ok: true }
      },
    }
  }, [loading, session, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
