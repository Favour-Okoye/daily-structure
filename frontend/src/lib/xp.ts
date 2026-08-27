import { supabase } from "./supabase";
import { appDay } from "./day";

/**
 * Real life is the ONLY XP source in this app. The crew, the village, and the
 * puzzle pay bond and furniture — never XP. If you are about to add an XP
 * award to a mini-game: don't. That rule is the app's soul.
 */
export const DS_XP = {
  day_complete: 30,
  daily_streak_tick: 5,
  streak_bonus_7: 50,
  streak_bonus_30: 200,
  streak_bonus_100: 500,
  task_small: 10,
  task_medium: 20,
  task_large: 30,
  task_on_time: 5,
  job_application: 25,
  job_followup: 10,
  skill_block: 15,
  voyage_log: 20,
  weekly_goal_met: 40,
  comeback_reunion: 25,
  char_request: 10,
} as const;

/**
 * Append to the XP ledger. The DB's partial unique index on
 * (user_id, action, ref_type, ref_id) makes this idempotent — a 23505
 * conflict just means "already earned for this item".
 */
export async function awardCustom(
  action: string,
  refType: string,
  refId: string,
  points: number,
  silent = false
): Promise<boolean> {
  if (!supabase) return false;
  const day = appDay();
  const { error } = await supabase.from("ds_xp_events").insert({
    action,
    points,
    ref_type: refType,
    ref_id: refId,
    happened_on: day,
  });
  if (error && error.code !== "23505") {
    console.warn("ds xp award failed:", error.message);
    return false;
  }
  if (!error && !silent) announce(points);
  if (action !== "daily_streak_tick") {
    // one activity tick per app-day — fuels the streak
    await supabase.from("ds_xp_events").insert({
      action: "daily_streak_tick",
      points: DS_XP.daily_streak_tick,
      ref_type: "day",
      ref_id: day,
      happened_on: day,
    });
  }
  return !error;
}

/** Tell the UI a fresh award landed (XpToast listens). */
function announce(points: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ds:xp", { detail: { points } }));
  }
}
