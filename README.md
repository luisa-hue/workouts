# Workouts

Personal workout app (PWA) for NEVER QUIT Burleigh BUILD / SHRED programs. Vite + React + TypeScript, Supabase (auth + Postgres), hosted on Vercel.

## Stage 1 (current)

- Login (single user, sign-ups disabled in Supabase)
- Today: workout of the day, BUILD / SHRED toggle, previous / next workout, calendar
- Settings: import workout JSON files (deduped by `uid`), sign out
- PRs and Calculator tabs are placeholders for later stages

## Setup

1. Supabase: run `supabase/schema.sql` in SQL Editor.
2. Environment variables (Vercel, or `.env.local` for local dev), see `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `npm install`, then `npm run dev` or `npm run build`.

The anon key is public by design. Access is enforced by Row Level Security in `schema.sql`.

## Notes

- Workout JSON exports are never committed (`workouts*.json` is gitignored). Import them from the app.
- `python3 scripts/make-icons.py` regenerates the app icons (needs Pillow).
