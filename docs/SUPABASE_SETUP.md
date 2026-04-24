# Supabase Cloud Storage Setup (MVP)

This MVP stores your full `AppState` as a single JSON row per user in Supabase. LocalStorage remains as an offline cache.

## 1) Create a Supabase project
- Create a new project in Supabase.
- Save your **Project URL** and **Anon public key** (Settings → API).

## 2) Create the database table + RLS policies
- In Supabase SQL Editor, run:
  - `supabase/schema.sql`

This enables Row Level Security so each user can only read/write their own row.

## 3) Enable Email/Password auth
- Supabase Dashboard → Authentication → Providers
- Enable **Email** (password).

## 3b) Choose your access mode

### Public multi-user app
If you want anyone to create their own Orderly Books account:
- Leave new user signups **enabled**
- Keep email/password auth enabled
- Optionally require email confirmation in Supabase Auth settings

### Private or invite-only app
If you want only selected people to access the app:
- Supabase Dashboard → Authentication → Settings (or Providers)
- Turn **off** new user signups / enable **Disable signups** (wording varies)

You can still add users later via **Invite user** in the Supabase Auth users screen.

## 4) Configure env vars
Create `/discipline-first-finance-app/.env.local`:
```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_ANON_PUBLIC_KEY"
```

Do **not** use the service role key in the browser.

## 5) Run the app
```bash
cd discipline-first-finance-app
npm install
npm run dev
```

## 6) Sign in or create an account
- The app will show an auth screen when Supabase is configured.
- Users can:
  - create an account with email/password, or
  - sign in with an existing account
- After sign-in, the app will:
  - load cloud state if present, or
  - create a new cloud row from local/seed data as the user starts saving

## Notes / limitations (MVP)
- Sync is “last write wins” (single JSON blob). Avoid editing on two devices at the same time.
- Future versions should normalize transactions/obligations into tables for better querying and conflict-free sync.
