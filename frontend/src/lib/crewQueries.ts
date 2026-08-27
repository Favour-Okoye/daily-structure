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
  FORM_NAMES,
  LEVEL_BOND_GATE,
  LEVEL_COST,
  maxLevel,
  MOOD_EMOJI,
  MOOD_LINES,
  neglectRunOf,
  normalizeCrew,
  prevExpectedDay,
  questRequirementMet,
  RECRUITS,
  WALKOUT_GONE,
  WALKOUT_PACKING,
  areaMood,
  type CharId,
  type CrewState,
  type LogRow,
  type Mood,
} from "./crew";
import type { Season } from "./anchors";
import { useOpenTasks } from "./tasksQueries";
import { computeStreak, useXpDays } from "./stats";
import { awardCustom, DS_XP } from "./xp";

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

/** Lifetime completion counts that gate recruits. */
export function useLifetimeCounts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_lifetime_counts", session?.user.id],
    enabled: !!supabase && !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = supabase!;
      const faithSlugs = ["devotional", "noon_prayer", "bible", "family_prayers", "confession"];
      const [faith, church, quiet, skill, mind, jobPrep] = await Promise.all([
        sb.from("ds_anchor_log").select("day", { count: "exact", head: true }).eq("status", "done").in("anchor_slug", faithSlugs),
        sb.from("ds_anchor_log").select("day", { count: "exact", head: true }).eq("status", "done").like("anchor_slug", "church_%"),
        sb.from("ds_anchor_log").select("day", { count: "exact", head: true }).eq("status", "done").eq("anchor_slug", "quiet_time"),
        sb.from("ds_anchor_log").select("day", { count: "exact", head: true }).eq("status", "done").eq("anchor_slug", "skill_block"),
        sb.from("ds_anchor_log").select("day", { count: "exact", head: true }).eq("status", "done").in("anchor_slug", ["book", "money_tree"]),
        sb.from("ds_tasks").select("id", { count: "exact", head: true }).eq("status", "done").in("kind", ["job_application", "job_followup", "bi_practice"]),
      ]);
      return {
        faithCount: (faith.count ?? 0) + (church.count ?? 0),
        churchCount: church.count ?? 0,
        quietCount: quiet.count ?? 0,
        skillBlocks: skill.count ?? 0,
        mindCount: mind.count ?? 0,
        jobPrepCount: jobPrep.count ?? 0,
      };
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

export function useSaveCrew() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (state: CrewState) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase
        .from("ds_game_state")
        .upsert({ user_id: session?.user.id, state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      return state;
    },
    onMutate: async (state) => {
      qc.setQueryData(["ds_game_state", session?.user.id], { state, existed: true });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["ds_game_state", session?.user.id] }),
  });
}

export interface CrewMember {
  id: CharId;
  name: string;
  role: string;
  mood: Mood;
  moodEmoji: string;
  bond: number;
  rawBond: number;
  tier: string;
  line: string | null;
  recruited: boolean;
  level: number;
  formName: string;
  gone: boolean;
  hint: string | null;
}

const MOOD_RANK: Mood[] = ["sad", "worried", "neutral", "happy"];
function capMood(mood: Mood, cap: Mood): Mood {
  const m = MOOD_RANK.indexOf(mood);
  const c = MOOD_RANK.indexOf(cap);
  if (m === -1 || c === -1) return mood;
  return MOOD_RANK[Math.min(m, c)];
}

/** The living crew: moods, bonds, walkouts, recruits — plus the maintenance pass. */
export function useCrew() {
  const { session } = useAuth();
  const stateQ = useCrewState();
  const rowsQ = useAnchorRange();
  const tasksQ = useOpenTasks();
  const countsQ = useLifetimeCounts();
  const xpDaysQ = useXpDays();
  const save = useSaveCrew();
  const maintained = useRef<string | null>(null);
  const today = appDay();

  const loading = stateQ.isLoading || rowsQ.isLoading;
  const state = stateQ.data?.state ?? null;
  const rows = rowsQ.data ?? [];
  const overdue = (tasksQ.data ?? []).filter((t) => t.due_on && t.due_on < today).length;
  const totalXp = (xpDaysQ.data ?? []).reduce((s, d) => s + d.points, 0);
  const streak = computeStreak((xpDaysQ.data ?? []).map((d) => d.happened_on), today);

  const areaDays = buildAreaDays(rows);

  let crew: CrewMember[] = [];
  if (state) {
    crew = ALL_CHARS.map((id) => {
      const c = state.characters[id];
      const area = CHAR_AREA[id];
      const rawBond = c.gone
        ? c.prevBond
        : c.recruited && area
          ? bondOf(id, today, state, SEASON, areaDays, rows)
          : c.bondBonus;
      const bond = Math.max(0, Math.min(100, rawBond));
      let mood: Mood = "neutral";
      if (c.recruited) {
        if (c.gone) mood = "gone";
        else if (area) {
          mood = areaMood(area, today, state.startedOn, SEASON, areaDays);
          const run = neglectRunOf(area, today, state.startedOn, SEASON, areaDays);
          if (run >= WALKOUT_PACKING) mood = "packing";
          if (id === "nami" && overdue >= 1 && mood !== "packing") {
            mood = capMood(mood, overdue >= 3 ? "sad" : "worried");
          }
        } else if (id === "naruto") {
          mood = streak.current >= 3 ? "happy" : streak.current >= 1 ? "neutral" : "worried";
        }
      }
      const line =
        id === "nami" && overdue >= 1 && c.recruited && !c.gone
          ? `${overdue} overdue task${overdue > 1 ? "s" : ""}?! Clear the map — we don't sail with dead weight.`
          : mood === "packing"
            ? "…I'm packing my things. One real day in my area and I'll stay."
            : (MOOD_LINES[id]?.[mood] ?? null);
      return {
        id,
        name: CHAR_META[id].name,
        role: CHAR_META[id].role,
        mood,
        moodEmoji: MOOD_EMOJI[mood],
        bond,
        rawBond,
        tier: bondTier(bond),
        line,
        recruited: c.recruited,
        level: c.level,
        formName: FORM_NAMES[id][Math.min(c.level, maxLevel(id)) - 1],
        gone: c.gone,
        hint: RECRUITS.find((r) => r.id === id)?.hint ?? null,
      };
    });
  }

  // ---- Maintenance pass: once per (day, data snapshot) ----
  const ready =
    !!session && stateQ.isSuccess && rowsQ.isSuccess && countsQ.isSuccess && xpDaysQ.isSuccess;
  const snapshotKey = ready ? `${today}:${rows.length}:${(xpDaysQ.data ?? []).length}` : null;

  useEffect(() => {
    if (!ready || !state || !snapshotKey || maintained.current === snapshotKey || save.isPending) return;
    maintained.current = snapshotKey;

    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    let changed = false;
    const logIt = (text: string) => {
      next.log = [{ day: today, text }, ...next.log].slice(0, 60);
    };

    // 1. Broken comeback quest resets to day 0 (missed an expected day).
    if (next.comeback && next.comeback.daysDone > 0) {
      const area = CHAR_AREA[next.comeback.charId] ?? "overall";
      const prevDay = prevExpectedDay(area, today, next.startedOn, SEASON);
      if (prevDay && next.comeback.lastDayDone && next.comeback.lastDayDone < prevDay) {
        next.comeback.daysDone = 0;
        next.comeback.lastDayDone = null;
        logIt(`${CHAR_META[next.comeback.charId].name}'s comeback quest reset — a day was missed.`);
        changed = true;
      }
    }

    // 2. Walkouts at rollover.
    for (const id of ALL_CHARS) {
      const c = next.characters[id];
      const area = CHAR_AREA[id];
      if (!c.recruited || c.gone || !area) continue;
      const run = neglectRunOf(area, today, next.startedOn, SEASON, areaDays);
      if (run >= WALKOUT_GONE) {
        const raw = bondOf(id, today, next, SEASON, areaDays, rows);
        c.gone = true;
        c.goneSince = today;
        c.prevBond = Math.max(0, Math.min(100, raw));
        logIt(`${CHAR_META[id].name} walked out after ${run} neglected days. 💔`);
        changed = true;
      }
    }

    // 3. Recruits (one per pass, so each gets their moment).
    if (!next.pendingRecruit) {
      const stats = {
        streak: streak.current,
        skillBlocks: countsQ.data!.skillBlocks,
        faithCount: countsQ.data!.faithCount,
        churchCount: countsQ.data!.churchCount,
        quietCount: countsQ.data!.quietCount,
        jobPrepCount: countsQ.data!.jobPrepCount,
        mindCount: countsQ.data!.mindCount,
        totalXp,
        settledGoalWeeks: 0, // weekly goals arrive in Phase 5
        comebackDone: next.comebackDone,
      };
      for (const r of RECRUITS) {
        if (next.characters[r.id].recruited) continue;
        if (r.check(stats)) {
          next.characters[r.id].recruited = true;
          next.characters[r.id].recruitedOn = today;
          next.pendingRecruit = r.id;
          logIt(`${CHAR_META[r.id].name} joined the crew! 🎉`);
          changed = true;
          break;
        }
      }
    }

    if (changed) save.mutate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, snapshotKey]);

  return {
    loading,
    state,
    crew,
    aboard: crew.filter((c) => c.recruited),
    wallet: Math.max(0, totalXp - (state?.spentXp ?? 0)),
    totalXp,
    streak,
    overdue,
  };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function useStartComeback() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  return (charId: CharId) => {
    const state = data?.state;
    if (!state || state.comeback) return;
    save.mutate({
      ...state,
      comeback: { charId, startedOn: appDay(), daysDone: 0, lastDayDone: null },
      log: [{ day: appDay(), text: `You set out after ${CHAR_META[charId].name}. 3 days to win them back.` }, ...state.log].slice(0, 60),
    });
  };
}

/** Evaluate today's quest step against today's log; advance or explain. */
export function useCompleteQuestDay() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { session } = useAuth();
  const qc = useQueryClient();
  const today = appDay();
  const logQ = useQuery({
    queryKey: ["ds_anchor_log", session?.user.id, today],
    enabled: false, // read from cache; Today keeps it fresh
  });

  return async (note: string): Promise<{ ok: boolean; message: string }> => {
    const state = data?.state;
    if (!state?.comeback) return { ok: false, message: "No active quest." };
    const quest = state.comeback;
    if (quest.lastDayDone === today) {
      return { ok: false, message: "Today's step is done — come back tomorrow. 🌙" };
    }
    const area = CHAR_AREA[quest.charId] ?? "overall";
    const step = quest.daysDone + 1;

    const cached = (logQ.data ?? qc.getQueryData(["ds_anchor_log", session?.user.id, today])) as
      | Record<string, { status: string }>
      | undefined;
    const doneSlugs = new Set(
      Object.entries(cached ?? {})
        .filter(([, v]) => v.status === "done")
        .map(([k]) => k)
    );

    if (!questRequirementMet(step, area, today, SEASON, doneSlugs)) {
      return {
        ok: false,
        message:
          step === 1
            ? "Not yet — do at least one thing in their area first."
            : "Not yet — their area's full expectations aren't done today.",
      };
    }
    if (step === 3 && note.trim().length < 20) {
      return { ok: false, message: "Write them a real recommitment (a couple of sentences)." };
    }

    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.comeback = { ...quest, daysDone: step, lastDayDone: today };
    if (step === 3) {
      // Reunion 🎉 — fresh bond start at max(30, 60% of what they had)
      const c = next.characters[quest.charId];
      const target = Math.max(30, Math.floor(0.6 * c.prevBond));
      c.gone = false;
      c.goneSince = null;
      c.bondSince = today;
      c.bondBonus = target;
      next.comeback = null;
      next.comebackDone = true;
      next.pendingReunion = quest.charId;
      next.log = [
        { day: today, text: `${CHAR_META[quest.charId].name} came back. "${note.trim().slice(0, 120)}"` },
        ...next.log,
      ].slice(0, 60);
      await awardCustom("comeback_reunion", "comeback", `${quest.charId}:${quest.startedOn}`, DS_XP.comeback_reunion);
    }
    save.mutate(next);
    return {
      ok: true,
      message: step === 3 ? "They're back. Welcome home. 🎉" : `Day ${step} of 3 complete. Keep showing up.`,
    };
  };
}

export function useBuyLevel() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { wallet } = useCrew();
  return (charId: CharId, bond: number): { ok: boolean; message: string } => {
    const state = data?.state;
    if (!state) return { ok: false, message: "Not loaded." };
    const c = state.characters[charId];
    const target = c.level + 1;
    if (target > maxLevel(charId)) return { ok: false, message: "Already at their final form." };
    const cost = LEVEL_COST[target] ?? Infinity;
    const gate = LEVEL_BOND_GATE[target] ?? 100;
    if (bond < gate) return { ok: false, message: `Bond too low — reach ${gate} first. Show up for them.` };
    if (wallet < cost) return { ok: false, message: `Not enough XP — need ${cost}, you have ${wallet}.` };
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp += cost;
    next.characters[charId].level = target;
    next.log = [
      { day: appDay(), text: `${CHAR_META[charId].name} unlocked ${FORM_NAMES[charId][target - 1]}! ⚡` },
      ...next.log,
    ].slice(0, 60);
    save.mutate(next);
    return { ok: true, message: `${FORM_NAMES[charId][target - 1]} unlocked!` };
  };
}

export function useDismissScene() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  return () => {
    const state = data?.state;
    if (!state) return;
    if (!state.pendingRecruit && !state.pendingReunion) return;
    save.mutate({ ...state, pendingRecruit: null, pendingReunion: null });
  };
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ds_day_plan"] }),
  });
}
