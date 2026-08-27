import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { appDay, isoWeekKey, mondayOf, shiftDay, weekdayOf } from "./day";
import { awardCustom, DS_XP } from "./xp";
import { GOALS_DECK, type CrewState } from "./crew";
import { useCrewState, useSaveCrew } from "./crewQueries";
import { useOpenTasks } from "./tasksQueries";

export interface WeekData {
  monday: string;
  days: string[];
  slugDays: Record<string, Set<string>>; // slug -> set of days done
  churchCount: number;
  jobAppsDone: number;
  perfectDays: number;
}

/** Everything needed to show progress on / settle a week starting `monday`. */
export function useWeekData(monday: string) {
  const { session } = useAuth();
  const sunday = shiftDay(monday, 6);
  return useQuery({
    queryKey: ["ds_week_data", session?.user.id, monday],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<WeekData> => {
      const sb = supabase!;
      const [logRes, tasksRes, perfectRes] = await Promise.all([
        sb
          .from("ds_anchor_log")
          .select("day, anchor_slug, status")
          .gte("day", monday)
          .lte("day", sunday),
        sb
          .from("ds_tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "done")
          .eq("kind", "job_application")
          .gte("completed_on", monday)
          .lte("completed_on", sunday),
        sb
          .from("ds_xp_events")
          .select("id", { count: "exact", head: true })
          .eq("action", "day_complete")
          .gte("happened_on", monday)
          .lte("happened_on", sunday),
      ]);
      if (logRes.error) throw logRes.error;
      const slugDays: Record<string, Set<string>> = {};
      let churchCount = 0;
      for (const row of (logRes.data ?? []) as { day: string; anchor_slug: string; status: string }[]) {
        if (row.status !== "done") continue;
        if (row.anchor_slug.startsWith("church_")) churchCount++;
        (slugDays[row.anchor_slug] ??= new Set()).add(row.day);
      }
      return {
        monday,
        days: Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)),
        slugDays,
        churchCount,
        jobAppsDone: tasksRes.count ?? 0,
        perfectDays: perfectRes.count ?? 0,
      };
    },
  });
}

export function goalMet(goalId: string, data: WeekData, overdueNow: number): boolean {
  const days = (slug: string) => data.slugDays[slug]?.size ?? 0;
  switch (goalId) {
    case "dev6":
      return days("devotional") >= 6;
    case "workouts3":
      return days("exercise") >= 3;
    case "quiet5":
      return days("quiet_time") >= 5;
    case "apps2":
      return data.jobAppsDone >= 2;
    case "zero_overdue":
      return overdueNow === 0;
    case "book5":
      return days("book") >= 5;
    case "church4":
      return data.churchCount >= 4;
    case "perfect2":
      return data.perfectDays >= 2;
    default:
      return false;
  }
}

export function useSetWeeklyPicks() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  return (picks: string[]) => {
    const state = data?.state;
    if (!state || picks.length !== 2) return;
    // Sunday is the voyage-log ritual: promises made on Sunday are for the
    // week that STARTS tomorrow, never the one dying at midnight.
    const today = appDay();
    const weekKey = weekdayOf(today) === 0 ? isoWeekKey(shiftDay(today, 1)) : isoWeekKey(today);
    const titles = picks
      .map((p) => GOALS_DECK.find((g) => g.id === p)?.title ?? p)
      .join(" · ");
    save.mutate({
      ...state,
      weekly: { weekKey, picks, settled: false },
      log: [{ day: appDay(), text: `Weekly goals set: ${titles}` }, ...state.log].slice(0, 60),
    });
  };
}

/** Settle a past week's picks: award met goals + the voyage log bonus. */
export function useSettleWeek() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const qc = useQueryClient();
  const { session } = useAuth();
  const tasksQ = useOpenTasks();

  return useMutation({
    mutationFn: async ({ weekData }: { weekData: WeekData }) => {
      const state = data?.state;
      if (!state?.weekly || state.weekly.settled) throw new Error("nothing to settle");
      const overdueNow = (tasksQ.data ?? []).filter((t) => t.due_on && t.due_on < appDay()).length;
      const weekKey = state.weekly.weekKey;
      const results = state.weekly.picks.map((p) => ({
        id: p,
        title: GOALS_DECK.find((g) => g.id === p)?.title ?? p,
        met: goalMet(p, weekData, overdueNow),
      }));
      for (const r of results) {
        if (r.met) {
          await awardCustom("weekly_goal_met", "goal", `${weekKey}:${r.id}`, DS_XP.weekly_goal_met);
        }
      }
      await awardCustom("voyage_log", "week", weekKey, DS_XP.voyage_log);
      const metCount = results.filter((r) => r.met).length;
      const next: CrewState = {
        ...state,
        weekly: { ...state.weekly, settled: true },
        settledGoalWeeks: state.settledGoalWeeks + (metCount > 0 ? 1 : 0),
        log: [
          {
            day: appDay(),
            text: `Week ${weekKey} settled: ${metCount}/2 goals met — ${results
              .map((r) => `${r.met ? "✅" : "❌"} ${r.title}`)
              .join(", ")}`,
          },
          ...state.log,
        ].slice(0, 60),
      };
      save.mutate(next);
      return results;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ds_xp_days", session?.user.id] });
    },
  });
}

export function currentWeekMonday(): string {
  return mondayOf(appDay());
}
