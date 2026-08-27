# Daily Structure ⚓

A personal daily-routine game: real-life anchors (devotional, exercise, prayer, reading,
quiet time, confession) and deadline tasks earn XP, and a hand-drawn chibi crew reacts —
happy when the day is honored, worried when it slips, and eventually walking out if an
area of life is neglected (won back through a comeback quest).

**Iron rule:** real life is the ONLY XP source. Games and the crew pay bond and
furniture — never XP.

Sister app of [money-tree-tracker](https://github.com/Favour-Okoye/money-tree-tracker),
built from the same recipe:

- React 19 + Vite 6 + TypeScript + Tailwind v4 + TanStack Query 5
- HashRouter + vite-plugin-pwa → installable from GitHub Pages
- Supabase (email OTP + row-level security) — **same project as MoneyTree**, all
  tables prefixed `ds_`, migrations additive-only
- €0/month

## Key design facts

- **The app-day flips at 04:00 Brussels**, not midnight — family prayers (12-2am) and
  the ~2am confession belong to the *previous* day. All day math lives in
  `frontend/src/lib/day.ts` and nowhere else.
- Sundays are rest days: only the confession is required.
- Seasons: `gap` (now) vs `work` (from ~September) retune anchors without losing history.

## Develop

```
cd frontend
npm install
npm run dev        # http://localhost:5174
npm test           # vitest — day-boundary + game math
npm run build
```

`frontend/.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(same values as money-tree-tracker). See SETUP.md for the one-time setup.

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages
(repo variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` must be set).

## Roadmap

1. ✅ Walk the deck — anchors, timeline, XP, streaks, quiet-time gate
2. The crew boards — Luffy/Zoro/Nami, moods, nightly confession ceremony
3. Chart the course — tasks, urgency, the time-slot planner
4. Nakama — all 12 characters, walkouts, comeback quests, level forms
5. Steady seas — grace tokens, skill deck, voyage log, MoneyTree auto-detect
6. The village — build and furnish each character's home
7. Playtime — play tickets + block puzzle with the crew
8. Work season — September-ready retuning
