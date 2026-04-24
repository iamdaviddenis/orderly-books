# Discipline‑First Personal Finance App (MVP) — Architecture

## Goals (MVP)
- Enforce a strict tier hierarchy (T1 → T2 → T3 → T4), not just track.
- Single-user, offline-first, local-only storage (LocalStorage) with export/import.
- Clean domain layer so a future backend can replace LocalStorage without rewriting business logic.

## Tech stack
- React + TypeScript + Vite
- Tailwind CSS
- `zod` for persisted-state validation + migrations
- `date-fns` for date math (weeks, due windows, recurrences)

## High-level structure
```
src/
  domain/                 # Pure logic (no React, no browser APIs)
    schema.ts             # Zod schemas + types for persisted state
    engine/               # Rule engine, reports, insights, forecasts
    services/             # Categorization learning, recurring detection
  data/
    storage.ts            # LocalStorage repository + migrations
    seed.ts               # Initial seed from David’s plan
  app/
    store.tsx             # AppProvider, reducer/actions, derived selectors
  ui/
    components/           # Design system (Card, Badge, Button, Modal...)
  pages/                  # Dashboard + tier pages + report + settings
```

## Data model (persisted)
All money is stored as integer `tzs` (e.g., `186835`), not floats.

### Core entities
- `Obligation` (Tier 1)
  - `name`, `amountTzs`, `dueDate`, `recurrence`, `paidAt?`, `notes?`
- `PlannedTransfer` (Tier 2)
  - `name`, `amountTzs`, `dueDate`, `recurrence`, `paidAt?`, `skipLog[]`
- `Transaction`
  - `kind` (`expense` | `income`), `tier` (3 or 4 normally), `categoryId`, `amountTzs`, `date`, `payee`, `notes?`
  - Optional `linked` reference to `obligationId` / `transferId` when created by “Mark as paid”.
- `WeeklyBudget`
  - `weekStart` (ISO date), `limitTzs`
- `ShoppingWeek`
  - `weekStart`, `items[]` (estimated vs actual, purchased)
- `NetWorthSnapshot` (simple)
  - `cashTzs`, `savingsTzs`, `investmentsTzs`, `debtsTzs` (manual inputs)

### Behavioral / accountability layer
- `AuditLogEntry`
  - Required reasons when skipping Tier 2 items, changing categories, etc.
- `Reflection`
  - Weekly + monthly prompts completion markers (used in score).

## Routing & UI
- Dashboard: “Command Center” with tier progress, urgency, safe-to-spend, forecast.
- Tier 1: Obligations list + mark paid + alerts.
- Tier 3: Weekly budget + spending meter + transactions entry (locked if Tier 1 incomplete).
- Shopping: weekly shopping list mode (estimated vs actual).
- Reports: month summary + insights + “Faithfulness Score”.
- Settings: currency, week start, seed/reset, export/import, sharing-lite.

## Storage
- `LocalStorageRepo` loads/saves `AppState` under a single key with:
  - `schemaVersion`
  - `lastSavedAt`
  - migrations from older versions (MVP starts at v1)

## Future backend integration (planned)
- Replace `data/storage.ts` with a repository backed by:
  - SQLite / Postgres / Supabase
  - auth + multi-device sync
- Keep `domain/engine/*` unchanged; UI consumes derived selectors.

