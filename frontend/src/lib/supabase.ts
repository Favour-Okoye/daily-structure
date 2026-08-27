import { createClient } from "@supabase/supabase-js";

// Same Supabase project as MoneyTree — the anon key is public by design;
// row-level security on the ds_ tables is what protects the data.
// import.meta.env is undefined outside Vite (e.g. tests under Node).
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null;

/** False until frontend/.env.local (or the repo build variables) are filled in. */
export const supabaseConfigured = supabase !== null;
