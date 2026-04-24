# Orderly Books

A behavior-first personal finance app built around one core order:

1. **Tier 1** - Critical obligations
2. **Tier 2** - Investments and fixed savings
3. **Tier 3** - Essential lifestyle spending
4. **Tier 4** - Discretionary spending

This is not a generic expense tracker. The app is designed to keep attention on commitments first, then growth, then lifestyle, then optional spending.

## What The App Does Now

The current app includes:

- **Dashboard** with safe-to-spend, Tier 1 status, spending trend, simple net worth, and 30-day cash flow forecast
- **Tier 1** obligation tracking with partial payments, payment logs, edit support, collapsible due/upcoming/paid sections, and accountability comments
- **Tier 2** planned transfers, worth tracker, dynamic assets/liabilities chart, and auto-hiding paid liabilities
- **Tier 3** weekly budget, shopping mode, reusable shopping template, and spend book
- **Tier 4** discretionary goals plus discretionary spend book
- **Goals across all tiers**, with reports using monthly goal totals as targets
- **Reports** with goal-vs-actual comparison, statement view, reflections, income logging, and PDF export
- **Settings** for starting cash, discipline mode, read-only mode, backup/import, cloud sync status, and reset
- Optional **Supabase auth + cloud sync**

## Current Behavior

The app now uses **reminders and friction**, not hard locks.

- Tier 1 is still treated as the first focus
- Tier 3 and Tier 4 are not fully blocked
- Strict Tier 1 mode adds extra reminders and confirmations before discretionary spending
- Safe-to-spend is calculated after reserving Tier 1, planned Tier 2, and remaining Tier 3 weekly budget
- Reports use **goals due in the selected month** as the monthly targets total
- Local storage works as offline cache; Supabase can act as the cross-device source of truth

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- date-fns
- Zod
- Supabase (optional)

## Quick Start

### Run locally

```bash
cd /Users/pro/Documents/PERSONAL/discipline-first-finance-app
npm install
npm run dev
```

Vite usually runs at:

```text
http://localhost:5173
```

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Mobile Publishing

The app now includes a Capacitor-ready mobile foundation for Android and iOS publishing.

Available scripts:

```bash
npm run mobile:build
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Mobile release guide:

- `docs/MOBILE_RELEASE.md`

## Supabase Setup

Cloud sync is optional. Without Supabase, the app still works locally in the browser.

### 1. Create `.env.local`

In the project root, add:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Run the schema

Run the SQL from:

```text
supabase/schema.sql
```

Use the Supabase SQL Editor.

### 3. Start the app

```bash
npm run dev
```

Then create an account or sign in with an existing one.

### Notes

- New users can create their own email/password account
- Supabase row-level security keeps each user's data private
- Local storage remains available as offline cache
- Sign out is available in **Settings**

## Main Screens

### Dashboard

- Tier 1 progress and due status
- Safe-to-spend summary
- Weekly spending trend
- Simple net worth summary
- 30-day cash flow forecast

### Tier 1

- Add, edit, and delete obligations
- Record full or partial payments
- Edit payment dates
- View payment logs
- Collapse or expand due, upcoming, and paid sections
- Add accountability comments

### Tier 2

- Track planned savings and investment transfers
- Set transfer targets
- Track assets and liabilities over time
- View amount-vs-time chart with dynamic scaling
- Hide liabilities once paid down to zero

### Tier 3

- Set weekly lifestyle budget
- Use shopping mode for recurring essentials
- Maintain reusable shopping checklist items
- Log household-style spend book entries

### Tier 4

- Set discretionary goals
- Track non-essential spending separately
- Use spend book for expenses outside goals

### Reports

- Compare monthly goals vs actual spending
- View the transaction statement behind total spent
- Export printable PDF report
- Log income and reflections

### Settings

- Toggle strict Tier 1 discipline mode
- Toggle read-only accountability mode
- Set starting cash
- Maintain simple net worth inputs
- Export / import full app state
- Reset app data
- Review cloud sync status

## Data Stored By The App

The app persists:

- obligations
- planned transfers
- transactions
- monthly allocations
- goals
- shopping templates
- weekly shopping lists
- week budgets
- worth items
- worth snapshots
- reflections
- accountability comments
- settings and app metadata

## Reports Notes

- **Targets total** comes from goals due in the selected month across Tier 1-4
- **Total spent** comes from logged expense transactions
- The **statement** section helps trace and remove incorrect entries
- PDF export opens a printable report in a new tab and relies on browser print support

## Backup And Restore

From **Settings**, you can:

- export the full app state as JSON
- import a saved JSON backup
- reset local and cloud state

This is useful for:

- backup
- moving to a new device
- accountability sharing

## Project Docs

- `docs/ARCHITECTURE.md`
- `docs/RULE_ENGINE.md`
- `docs/BUILD_PLAN.md`
- `docs/SUPABASE_SETUP.md`
- `docs/DEPLOYMENT.md`

## Current Limits

- No bank sync yet
- Native store assets and signing still need final production setup
- No password reset or MFA flow in the current auth UI
- PDF export still depends on popup/print support in the browser
- Frontend bundle is still larger than ideal and can be optimized

## Project Goal

This repo is meant to stay practical and discipline-first:

- track what matters
- keep the user focused on commitments
- make plans visible
- make actual spending auditable
- support accountability without making daily use heavy
