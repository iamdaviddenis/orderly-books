# Tier Enforcement Engine — Rules (MVP)

## Inputs
The engine evaluates the current `AppState` at a given `now` timestamp.

Primary inputs:
- Tier 1 obligations (due dates, paidAt)
- Tier 2 planned transfers (due dates, paidAt, skips)
- Tier 3 weekly budget + Tier 3 transactions
- Tier 4 transactions
- Cash starting balance + income transactions

## Outputs (single derived object)
`DisciplineStatus` (computed every render):
- `tier1`
  - `dueTotalTzs`, `paidTotalTzs`, `remainingTzs`
  - `overdue[]`, `dueSoon[]`, `nextDue?`
  - `isCompleteForCycle` (no due/overdue items remain unpaid)
- `locks`
  - `tier3SpendingLocked` (boolean)
  - `tier4Locked` (boolean)
  - `reasons[]` (human-readable strings used in UI)
- `safeToSpend`
  - `cashOnHandTzs`
  - `reservedTier1Tzs` (unpaid due/overdue)
  - `reservedTier2Tzs` (planned transfers not yet paid and due this cycle)
  - `reservedTier3Tzs` (remaining weekly budget)
  - `safeToSpendTzs` (never below 0)
- `alerts[]`
  - severity (`critical` | `warning` | `growth` | `info`)
  - message + optional CTA target (screen)
- `forecast`
  - next 30-day “cash runway” projection using upcoming obligations/transfers

## Enforcement rules (non-negotiable)
### R1 — Tier 1 gates everything
- If any Tier 1 item is **overdue** OR **due within the current cycle and unpaid**:
  - Tier 3 expense entry is blocked
  - Tier 4 is locked
  - UI shows persistent red state + “Critical obligations first”

### R2 — Tier 4 requires Tiers 1–3 satisfied
- Tier 4 unlocks only when:
  - Tier 1 is complete for the current cycle, AND
  - Tier 3 week is within budget (not over), AND
  - user has assigned zero-based budget for the month (MVP: “no unassigned income” indicator)

### R3 — Tier 2 happens after Tier 1 and before lifestyle
- Tier 2 isn’t a hard lock on Tier 3, but it is a behavioral priority:
  - “Ready” when Tier 1 complete
  - If a Tier 2 transfer is skipped or late: require a reason (audit log)

### R4 — Overdue escalation
- Tier 1 overdue triggers:
  - red banner on every screen
  - “spending disabled” on Tier 3/Tier 4 actions

## “Safe-to-spend” calculation (MVP)
```
cashOnHand =
  startingCash
  + sum(income transactions)
  - sum(expense transactions)

reservedTier1 = sum(unpaid Tier1 due/overdue)
reservedTier2 = sum(unpaid Tier2 planned transfers in current month)
reservedTier3 = max(weeklyBudgetLimit - tier3SpentThisWeek, 0)

safeToSpend = max(cashOnHand - reservedTier1 - reservedTier2 - reservedTier3, 0)
```

## Faithfulness score (0–100, MVP)
Weights (tunable):
- 50 pts: Tier 1 on-time (overdue = heavy penalty)
- 20 pts: Tier 2 consistency (paid vs planned; skips require reasons)
- 20 pts: Tier 3 budget adherence (weekly)
- 10 pts: reflections completed (weekly + monthly check-ins)

Score is intended for behavior feedback, not judgment.

