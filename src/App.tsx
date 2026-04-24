import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './ui/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { Tier1Page } from './pages/Tier1Page'
import { Tier2Page } from './pages/Tier2Page'
import { Tier3Page } from './pages/Tier3Page'
import { Tier4Page } from './pages/Tier4Page'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAuth } from './app/auth'
import { isSupabaseEnabled } from './data/supabaseClient'
import { AuthPage } from './pages/AuthPage'

export default function App() {
  const auth = useAuth()

  if (isSupabaseEnabled) {
    if (auth.loading) {
      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
          <div className="rounded-2xl border border-border bg-panel p-6 shadow-soft">
            <div className="text-sm font-semibold">Loading session…</div>
            <div className="mt-1 text-xs text-muted">Connecting to Supabase.</div>
          </div>
        </div>
      )
    }
    if (!auth.user) return <AuthPage />
  }

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tier-1" element={<Tier1Page />} />
          <Route path="/tier-2" element={<Tier2Page />} />
          <Route path="/tier-3" element={<Tier3Page />} />
          <Route path="/tier-4" element={<Tier4Page />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
