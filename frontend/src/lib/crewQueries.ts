import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { appDay, shiftDay } from "./day";
import {
  ALL_CHARS,
  bondOf,
  bondTier,
  buildAreaDays,
  CHAR_AREA,
  CHAR_META,
  MOOD_EMOJI,
  MOOD_LINES,
  normalizeCrew,
  areaMood,
  type CharId,
  type CrewState,
  type LogRow,
  type Mood,
} from "./crew";
import type { Season } from "./anchors";

const SEASON: Season = "gap";

/** ds_anchor_log rows for the last `span` app-days (crew mood window). */
export function useAnchorRange(span = 14) {
  const { session } = useAuth();
  const from = shiftDay(appDay(), -span);
  return useQuery({
    queryKey: ["ds_anchor_range", session?.user.id, from],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase!
        .from("ds_anchor_log")
        .select("day, anchor_slug, status")
        .gte("day", from);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });
}

export function useCrewState() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const ensured = useRef(false);
  const q = useQuery({
    queryKey: ["ds_game_state", session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<{ state: CrewState; existed: boolean }> => {
      const { data, error } = await supabase!.from("ds_game_state").select("state").maybeSingle();
      if (error) throw error;
      return { state: normalizeCrew(data?.state ?? {}, appDay()), existed: !!data };
    },
  });

  // First boot: persist the normalized blob once so later phases mutate a real row.
  useEffect(() => {
    if (!q.isSuccess || q.data.existed || ensured.current || !supabase || !session) return;
    ensured.current = true;
    void supabase
      .from("ds_game_state")
      .upsert({ user_id: session.user.id, state: q.data.state }, { onConflict: "user_id" })
      .then(() => qc.invalidateQueries({ queryKey: ["ds_game_state", session.user.id] }));
  }, [q.isSuccess, q.data, session, qc]);

  return q;
}

export interface CrewMember {
  id: CharId;
  name: string;
  role: string;
  mood: Mood;
  moodEmoji: string;
  bond: number;
  tier: string;
  line: string | null;
  recruited: boolean;
}

/** The living crew: moods and bonds computed from the anchor log. */
export function useCrew() {
  const stateQ = useCrewState();
  const rowsQ = useAnchorRange();
  const today = appDay();

  const loading = stateQ.isLoading || rowsQ.isLoading;
  const state = stateQ.data?.state ?? null;
  const rows = rowsQ.data ?? [];

  let crew: CrewMember[] = [];
  if (state) {
    const areaDays = buildAreaDays(rows);
    crew = ALL_CHARS.map((id) => {
      const c = state.characters[id];
      const area = CHAR_AREA[id];
      const mood: Mood =
        c.recruited && area ? areaMood(area, today, state.startedOn, SEASON, areaDays) : "neutral";
      const bond = c.recruited ? bondOf(id, today, state, SEASON, areaDays, rows) : 0;
      return {
        id,
        name: CHAR_META[id].name,
        role: CHAR_META[id].role,
        mood,
        moodEmoji: MOOD_EMOJI[mood],
        bond,
        tier: bondTier(bond),
        line: MOOD_LINES[id]?.[mood] ?? null,
        recruited: c.recruited,
      };
    });
  }

  return { loading, state, crew, aboard: crew.filter((c) => c.recruited) };
}

/** Nightly ceremony: store tomorrow's approved plan. */
export function useApprovePlan() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, plan }: { day: string; plan: unknown }) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase.from("ds_day_plans").upsert(
        {
          user_id: session?.user.id,
          day,
          plan,
          approved_at: new Date().toISOString(),
        },
        { onConflict: "user_id,day" }
      );
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ds_day_plans"] }),
  });
}
