import { format } from 'date-fns'
import { useState } from 'react'
import { formatTzs } from '../domain/money'
import { Badge } from './components/Badge'
import { Button } from './components/Button'
import { Input, TextArea } from './components/Input'

export type SpendBookTx = {
  id: string
  date: string
  payee: string
  amountTzs: number
  categoryId: string
  notes?: string
  goalId?: string
  kind: 'expense'
  tier: 3 | 4
  linked?: { type: 'obligation' | 'transfer'; id: string }
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(v: string) {
  if (!v) return new Date().toISOString()
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function SpendBookAddForm({
  categories,
  goals,
  disabled,
  onAdd,
}: {
  categories: Array<{ id: string; name: string }>
  goals?: Array<{ id: string; name: string }>
  disabled: boolean
  onAdd: (input: { payee: string; amountTzs: number; categoryId: string; dateIso: string; notes?: string; goalId?: string }) => void
}) {
  const now = new Date()
  const [dateIso, setDateIso] = useState(now.toISOString())
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [goalId, setGoalId] = useState('')

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="text-sm font-semibold text-text">Add spend book entry</div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Date</div>
          <Input
            type="datetime-local"
            value={toDatetimeLocalValue(dateIso)}
            onChange={(e) => setDateIso(fromDatetimeLocalValue(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">What / Payee</div>
          <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g., Groceries" disabled={disabled} />
        </div>
        <div>
          <div className="text-xs text-muted">TZS</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" disabled={disabled} />
        </div>
        <div>
          <div className="text-xs text-muted">Category</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={disabled}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {goals && goals.length > 0 ? (
          <div className="md:col-span-3">
            <div className="text-xs text-muted">Goal (optional)</div>
            <select
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              disabled={disabled}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="md:col-span-6">
          <div className="text-xs text-muted">Notes (optional)</div>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="who spent, details, receipt…"
            disabled={disabled}
          />
        </div>
        <div className="md:col-span-6">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              const amt = Math.max(0, Math.trunc(Number(amount)))
              const p = payee.trim()
              if (!p || amt <= 0) return
              if (!categoryId) return
              onAdd({
                payee: p,
                amountTzs: amt,
                categoryId,
                dateIso,
                notes: notes.trim() ? notes.trim() : undefined,
                goalId: goalId || undefined,
              })
              setPayee('')
              setAmount('')
              setNotes('')
              setGoalId('')
            }}
          >
            Add entry
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SpendBookRow({
  tx,
  categoryName,
  categories,
  goals,
  goalName,
  readOnly,
  onDelete,
  onUpdate,
}: {
  tx: SpendBookTx
  categoryName: string
  categories: Array<{ id: string; name: string }>
  goals?: Array<{ id: string; name: string }>
  goalName?: string
  readOnly: boolean
  onDelete: () => void
  onUpdate: (next: SpendBookTx) => void
}) {
  const [editing, setEditing] = useState(false)
  const [dateIso, setDateIso] = useState(tx.date)
  const [payee, setPayee] = useState(tx.payee)
  const [amount, setAmount] = useState(String(tx.amountTzs))
  const [categoryId, setCategoryId] = useState(tx.categoryId)
  const [notes, setNotes] = useState(tx.notes ?? '')
  const [goalId, setGoalId] = useState(tx.goalId ?? '')

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted">{format(new Date(tx.date), 'MMM d, HH:mm')}</div>
            <Badge tone="neutral">{categoryName}</Badge>
            {goalName ? <Badge tone="neutral">{goalName}</Badge> : null}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-text">{tx.payee}</div>
          {tx.notes ? <div className="mt-1 text-xs text-muted">{tx.notes}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-text">{formatTzs(tx.amountTzs)}</div>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Date</div>
          <Input
            type="datetime-local"
            value={toDatetimeLocalValue(dateIso)}
            onChange={(e) => setDateIso(fromDatetimeLocalValue(e.target.value))}
            disabled={readOnly}
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">What / Payee</div>
          <Input value={payee} onChange={(e) => setPayee(e.target.value)} disabled={readOnly} />
        </div>
        <div>
          <div className="text-xs text-muted">TZS</div>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" disabled={readOnly} />
        </div>
        <div>
          <div className="text-xs text-muted">Category</div>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={readOnly}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {goals && goals.length > 0 ? (
          <div className="md:col-span-2">
            <div className="text-xs text-muted">Goal (optional)</div>
            <select
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              disabled={readOnly}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="md:col-span-6">
          <div className="text-xs text-muted">Notes</div>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={readOnly} />
        </div>
        <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => {
              const amt = Math.max(0, Math.trunc(Number(amount)))
              const p = payee.trim()
              if (!p || amt <= 0) return
              if (!categoryId) return
              onUpdate({
                ...tx,
                date: dateIso,
                payee: p,
                amountTzs: amt,
                categoryId,
                notes: notes.trim() ? notes.trim() : undefined,
                goalId: goalId || undefined,
              })
              setEditing(false)
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDateIso(tx.date)
            setPayee(tx.payee)
            setAmount(String(tx.amountTzs))
            setCategoryId(tx.categoryId)
            setNotes(tx.notes ?? '')
            setGoalId(tx.goalId ?? '')
            setEditing(false)
          }}
        >
          Cancel
        </Button>
        </div>
      </div>
    </div>
  )
}
