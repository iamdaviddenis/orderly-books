import { appStateSchema, type AppState } from '../domain/schema'
import { makeSeedState } from './seed'

export const STORAGE_KEY = 'discipline_first_finance_app_state'

export type LoadResult =
  | { ok: true; state: AppState; source: 'storage' | 'seed' }
  | { ok: false; error: string; state: AppState }

function safeParseJson(value: string) {
  try {
    return { ok: true as const, json: JSON.parse(value) }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export function loadState(): LoadResult {
  const seed = makeSeedState()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ok: true, state: seed, source: 'seed' }

  const parsed = safeParseJson(raw)
  if (!parsed.ok) return { ok: false, error: parsed.error, state: seed }

  const validated = appStateSchema.safeParse(parsed.json)
  if (!validated.success) {
    return { ok: false, error: validated.error.message, state: seed }
  }

  return { ok: true, state: validated.data, source: 'storage' }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportState(state: AppState) {
  return JSON.stringify(state, null, 2)
}

export function importState(jsonText: string): { ok: true; state: AppState } | { ok: false; error: string } {
  const parsed = safeParseJson(jsonText)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const validated = appStateSchema.safeParse(parsed.json)
  if (!validated.success) return { ok: false, error: 'Invalid state format.' }
  return { ok: true, state: validated.data }
}
