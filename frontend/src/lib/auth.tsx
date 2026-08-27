import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, ready: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Make sure the ds_profiles row exists (holds streak caches and the season).
  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from("ds_profiles")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.warn("ds_profiles upsert:", error.message);
      });
  }, [userId]);

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
