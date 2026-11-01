# Workouts

Personal workout app (PWA) for NEVER QUIT Burleigh BUILD / SHRED programs. Vite + React + TypeScript, Supabase (auth + Postgres), hosted on Vercel.

## Stage 1

- Login (single user, sign-ups disabled in Supabase)
- Today: workout of the day, BUILD / SHRED toggle, previous / next workout, calendar
- Settings: import workout JSON files (deduped by `uid`), sign out

## Stage 2 (current)

- PRs tab: lifts with 1RM / 3RM / 5RM (tested, or estimated in blue from the best result), result history, names and aliases per lift
- "Find lifts in my workouts" scans the imported workouts for movements no lift matches yet
- Today: next to each known lift, `5RM 80kg`; for `@75%` or `70-80% of 3RM`, the kg (rounded to 2.5)
- New tables `lifts` and `records`: run `supabase/schema.sql` again (safe to re-run)
- `npm test` checks the RM maths and the text matching (`scripts/test-lifts.ts`)
- Calculator tab is still a placeholder

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
