import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import { exportState, importState, resetState, STORAGE_KEY } from '../data/storage'
import { Button } from '../ui/components/Button'
import { Card, CardBody, CardHeader } from '../ui/components/Card'
import { Input, TextArea } from '../ui/components/Input'
import { formatTzs } from '../domain/money'
import { isSupabaseEnabled } from '../data/supabaseClient'
import { useAuth } from '../app/auth'
import { deleteRemoteUserState } from '../data/supabaseState'

export function SettingsPage() {
  const { state, dispatch, status, cloud } = useApp()
  const auth = useAuth()
  const [startingCash, setStartingCash] = useState(String(state.startingCashTzs))
  const [nwCash, setNwCash] = useState(String(state.netWorth.cashTzs))
  const [nwSavings, setNwSavings] = useState(String(state.netWorth.savingsTzs))
  const [nwInvest, setNwInvest] = useState(String(state.netWorth.investmentsTzs))
  const [nwDebts, setNwDebts] = useState(String(state.netWorth.debtsTzs))
  const exported = useMemo(() => exportState(state), [state])

  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-text">Settings</div>
        <div className="mt-1 text-sm text-muted">
          {isSupabaseEnabled ? 'Cloud sync enabled (Supabase).' : 'Local-only MVP. Export/import enables backup + accountability sharing.'}
        </div>
      </div>

      {isSupabaseEnabled ? (
        <Card>
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text">Cloud sync</div>
              <div className="mt-1 text-xs text-muted">
                Status: <span className="text-text">{cloud.status}</span>
                {cloud.lastSyncedAt ? <> • Last sync: {new Date(cloud.lastSyncedAt).toLocaleString()}</> : null}
              </div>
            </div>
            {auth.user ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  await auth.signOut()
                }}
              >
                Sign out
              </Button>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-muted">
            {cloud.userEmail ? <div>Signed in as: {cloud.userEmail}</div> : <div>Not signed in.</div>}
            {cloud.lastError ? <div className="text-t1">Sync error: {cloud.lastError}</div> : null}
            <div className="text-xs text-muted">LocalStorage remains as an offline cache; Supabase is the source of truth across devices.</div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-text">Discipline mode</div>
          <div className="mt-1 text-xs text-muted">
            Strict Tier 1 gate adds extra friction (reminders/confirmations) before discretionary spending while Tier 1 is pending.
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2">
            <div>
              <div className="text-sm font-medium text-text">Strict Tier 1 gate</div>
              <div className="text-xs text-muted">Recommended. Adds a confirmation step for Tier 4 until Tier 1 is cleared.</div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.settings.strictTier1Gate}
              onChange={(e) => {
                const next = e.target.checked
                if (!next) {
                  const ok = window.confirm(
                    'Turn off strict Tier 1 gate? This will reduce reminders/confirmations before Tier 4 spending while Tier 1 is pending.',
                  )
                  if (!ok) return
                }
                dispatch({ type: 'set_strict_tier1_gate', enabled: next })
              }}
            />
          </label>
          {!state.settings.strictTier1Gate && !status.tier1.isCompleteForCycle ? (
            <div className="text-xs text-t3">
              Tier 1 is still pending. Keep Tier 4 minimal, and clear Tier 1 as soon as possible.
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-semibold text-text">Starting cash</div>
            <div className="mt-1 text-xs text-muted">Used for safe-to-spend and cash-on-hand calculations.</div>
          </CardHeader>
          <CardBody className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <div className="text-xs text-muted">TZS</div>
              <Input value={startingCash} onChange={(e) => setStartingCash(e.target.value)} inputMode="numeric" />
            </div>
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: 'set_starting_cash', amountTzs: Math.max(0, Math.trunc(Number(startingCash))) })}
            >
              Save
            </Button>
            <div className="w-full text-xs text-muted">
              Current safe-to-spend: <span className="text-text">{formatTzs(status.safeToSpend.safeToSpendTzs)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-text">Accountability mode</div>
            <div className="mt-1 text-xs text-muted">Read-only for finance edits; comments still allowed.</div>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2">
              <div>
                <div className="text-sm font-medium text-text">Read-only mode</div>
                <div className="text-xs text-muted">Use for shared accountability sessions.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.settings.readOnlyMode}
                onChange={(e) => dispatch({ type: 'set_read_only_mode', enabled: e.target.checked })}
              />
            </label>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = window.confirm('Reset all app data? This cannot be undone.')
                if (!ok) return
                try {
                  if (isSupabaseEnabled && auth.user) {
                    await deleteRemoteUserState(auth.user.id)
                  }
                } finally {
                  resetState()
                  window.location.reload()
                }
              }}
            >
              Reset app data
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-text">Net worth (simple)</div>
          <div className="mt-1 text-xs text-muted">Manual totals (quick). For snapshots + graph, use Tier 2 → Worth tracker.</div>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted">Cash</div>
            <Input value={nwCash} onChange={(e) => setNwCash(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <div className="text-xs text-muted">Savings</div>
            <Input value={nwSavings} onChange={(e) => setNwSavings(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <div className="text-xs text-muted">Investments</div>
            <Input value={nwInvest} onChange={(e) => setNwInvest(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <div className="text-xs text-muted">Debts</div>
            <Input value={nwDebts} onChange={(e) => setNwDebts(e.target.value)} inputMode="numeric" />
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Net worth:{' '}
              <span className="font-semibold text-text">
                {formatTzs(
                  Math.max(0, Math.trunc(Number(nwCash))) +
                    Math.max(0, Math.trunc(Number(nwSavings))) +
                    Math.max(0, Math.trunc(Number(nwInvest))) -
                    Math.max(0, Math.trunc(Number(nwDebts))),
                )}
              </span>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                dispatch({
                  type: 'set_net_worth',
                  netWorth: {
                    cashTzs: Math.max(0, Math.trunc(Number(nwCash))),
                    savingsTzs: Math.max(0, Math.trunc(Number(nwSavings))),
                    investmentsTzs: Math.max(0, Math.trunc(Number(nwInvest))),
                    debtsTzs: Math.max(0, Math.trunc(Number(nwDebts))),
                  },
                })
              }
            >
              Save net worth
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Export (backup / share)</div>
            <div className="mt-1 text-xs text-muted">Copy JSON to store securely or send to an accountability partner.</div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(exported)
            }}
          >
            Copy
          </Button>
        </CardHeader>
        <CardBody>
          <TextArea value={exported} readOnly rows={10} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-text">Import</div>
          <div className="mt-1 text-xs text-muted">Paste a previously exported JSON backup.</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <TextArea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder="Paste JSON here…" />
          {importError ? <div className="text-sm text-t1">{importError}</div> : null}
          <Button
            onClick={() => {
              setImportError(null)
              const res = importState(importText)
              if (!res.ok) return setImportError(res.error)
              localStorage.setItem(STORAGE_KEY, JSON.stringify(res.state))
              window.location.reload()
            }}
          >
            Import and reload
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
