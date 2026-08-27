import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { appDay, shiftDay } from "./day";
import { awardCustom, DS_XP } from "./xp";

export interface XpDay {
  happened_on: string;
  points: number;
}

export function useXpDays() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_xp_days", session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<XpDay[]> => {
      const { data, error } = await supabase!
        .from("ds_v_xp_by_day")
        .select("happened_on, points")
        .order("happened_on");
      if (error) throw error;
      return (data ?? []) as XpDay[];
    },
  });
}

/** Streak over app-days, with the MoneyTree mercy rule:
 *  yesterday still anchors the run, so mornings don't scare you. */
export function computeStreak(days: string[], today = appDay()) {
  const set = new Set(days);
  let anchor = set.has(today) ? today : set.has(shiftDay(today, -1)) ? shiftDay(today, -1) : null;
  let current = 0;
  while (anchor && set.has(anchor)) {
    current++;
    anchor = shiftDay(anchor, -1);
  }
  let longest = 0;
  for (const day of set) {
    if (set.has(shiftDay(day, -1))) continue; // not a run start
    let len = 0;
    let cursor = day;
    while (set.has(cursor)) {
      len++;
      cursor = shiftDay(cursor, 1);
    }
    if (len > longest) longest = len;
  }
  return { current, longest };
}

/** Totals + streaks, plus one idempotent maintenance pass per load
 *  (profile cache, streak bonuses). Grows a crew brain in Phase 2. */
export function useGrowth() {
  const { session } = useAuth();
  const xpDaysQ = useXpDays();
  const maintained = useRef(false);

  const totalXp = (xpDaysQ.data ?? []).reduce((sum, d) => sum + d.points, 0);
  const streak = computeStreak((xpDaysQ.data ?? []).map((d) => d.happened_on));
  const ready = !!session && xpDaysQ.isSuccess;

  useEffect(() => {
    if (!ready || maintained.current || !supabase || !session) return;
    maintained.current = true;
    const run = async () => {
      await supabase!
        .from("ds_profiles")
        .update({
          xp_total: totalXp,
          current_streak: streak.current,
          longest_streak: streak.longest,
          last_activity_on: appDay(),
        })
        .eq("user_id", session.user.id);

      const runStart = shiftDay(appDay(), -(streak.current - 1));
      if (streak.current >= 7) {
        await awardCustom("streak_bonus_7", "streak", `7-${runStart}`, DS_XP.streak_bonus_7);
      }
      if (streak.current >= 30) {
        await awardCustom("streak_bonus_30", "streak", `30-${runStart}`, DS_XP.streak_bonus_30);
      }
      if (streak.current >= 100) {
        await awardCustom("streak_bonus_100", "streak", `100-${runStart}`, DS_XP.streak_bonus_100);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return {
    loading: !!session && !ready,
    totalXp,
    streak,
    xpDays: xpDaysQ.data ?? [],
  };
}
