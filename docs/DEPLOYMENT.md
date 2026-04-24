# Deployment (GitHub → Vercel) + Supabase

## Prereqs
- Supabase project created
- `supabase/schema.sql` executed (creates `user_states` + RLS)
- Email/password auth enabled in Supabase

## Local setup (recommended first)
1. Create `.env.local` (from `.env.example`) with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable/anon public key)
2. Run:
   - `npm install`
   - `npm run dev`
3. Create account / sign in and confirm **Settings → Cloud sync** shows `ready`.

## GitHub
1. Create a new GitHub repo (empty).
2. In the project folder:
   - `git add -A`
   - `git commit -m "Initial MVP"`
   - `git remote add origin <repo-url>`
   - `git push -u origin main`

## Vercel
1. Create a new Vercel project by importing the GitHub repo.
2. Add env vars in Vercel (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy (Vercel detects Vite; output is `dist`).

## Supabase Auth URL configuration (after deploy)
Supabase → Authentication → URL Configuration:
- Site URL: your Vercel production URL
- Add redirect URLs:
  - `http://localhost:5173`
  - your Vercel production URL

## Notes (MVP)
- Cloud sync uses “single JSON blob per user” with last-write-wins.
- Avoid editing on two devices at the same time.

