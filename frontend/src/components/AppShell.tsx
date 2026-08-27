import { Link, Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";
import { XpToast } from "./XpToast";
import { useAuth } from "../lib/auth";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function AppShell() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-sky-900 text-white shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="text-xl">⚓</span> Daily Structure
          </Link>
          {supabaseConfigured &&
            (session ? (
              <button
                onClick={() => void supabase!.auth.signOut()}
                className="rounded-full bg-sky-800 px-3 py-1 text-xs font-bold hover:bg-sky-700"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-sky-950 hover:bg-amber-300"
              >
                Sign in
              </Link>
            ))}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>
      <TabBar />
      <XpToast />
    </div>
  );
}
