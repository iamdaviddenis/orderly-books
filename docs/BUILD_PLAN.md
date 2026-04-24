# MVP Build Plan (Step-by-step)

## Phase 1 — Foundation (done)
1. Scaffold `React + TS + Vite`
2. Add Tailwind CSS (PostCSS)
3. Add `zod`, `date-fns`, `react-router-dom`
4. Create LocalStorage repository with schema validation

## Phase 2 — Domain (done)
1. Define persisted models (`src/domain/schema.ts`)
2. Implement Tier Enforcement Engine (`src/domain/engine/disciplineEngine.ts`)
3. Add safe-to-spend calculator + faithfulness score
4. Add auto-categorization + learning rules

## Phase 3 — UI (done)
1. App shell + navigation + alert banner
2. Dashboard (command center)
3. Tier 1 obligations tracker (add/mark paid)
4. Tier 2 transfers (mark paid / skip with reason)
5. Tier 3 weekly budget + shopping mode + expense logging
6. Monthly report + insights + reflections
7. Settings (export/import, net worth, read-only accountability mode)

## Phase 4 — Verification (done)
1. `npm run build` (TypeScript + Vite production build)

## Phase 5 — Next improvements (recommended)
- Add “Transactions” page with filters and category editing
- Stronger recurring/subscription detection (amount ranges, payee normalization, confirmations)
- Scheduled notifications (browser notifications) + calendar export
- Multi-device sync + partner accounts (backend)
- Encryption-at-rest for exports (password-derived key)

