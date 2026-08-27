# One-time setup ✅

Daily Structure reuses everything MoneyTree already has — no new Supabase project,
no new account, no new costs. Four steps:

## 1. Database (2 minutes)

Open [Supabase Studio](https://supabase.com/dashboard) → your MoneyTree project →
**SQL Editor** → paste the whole of `supabase/migrations/0001_ds_core.sql` → **Run**.

It only CREATEs new `ds_*` tables — it cannot touch MoneyTree's data.

## 2. GitHub repository

1. Create a **public** repo named `daily-structure` on github.com/Favour-Okoye.
2. Push this folder to it (branch `main`).
3. Repo **Settings → Pages** → Source: **GitHub Actions**.
4. Repo **Settings → Secrets and variables → Actions → Variables** → add:
   - `VITE_SUPABASE_URL` — same value as in money-tree-tracker
   - `VITE_SUPABASE_ANON_KEY` — same value as in money-tree-tracker

The push triggers the deploy; after ~2 minutes the app is live at
**https://favour-okoye.github.io/daily-structure/**

## 3. Phone install

Open the URL on your phone → sign in with your usual email code (same login as
MoneyTree) → browser menu → **Install app** / **Add to Home Screen**.

## 4. Confession

In the app: **More → Your confession** → paste your confession, one line per row →
Save. It is stored only in your database — never in this repository.

---

### Local development

Copy `frontend/.env.local` from the money-tree-tracker frontend (same two values),
then `npm install && npm run dev` inside `frontend/`.
