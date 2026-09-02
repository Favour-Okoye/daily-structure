import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { appDay, isoWeekKey, mondayOfWeekKey, shiftDay, weekdayOf } from "./day";
import { requiredSlugs } from "./anchors";
import {
  AREA_VERB,
  DILEMMAS,
  dilemmaForDay,
  EXAMS,
  examArea,
  islandAt,
  landfallTier,
  sceneForDay,
  stormTarget,
  STORM_REPAIR_COST,
  TIER_LINES,
  areaMoodDetail,
  type DilemmaDef,
  type SceneLine,
  type YesterdayFacts,
} from "./crew";
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
  GRACE_PER_WEEK,
  HOUSE_COST,
  THEME_COST,
  HOME_SLOTS,
  furnitureById,
  requestForDay,
  walkoutThresholds,
  type CharId,
  type CrewState,
  type LogRow,
  type Mood,
} from "./crew";
import { useOpenTasks } from "./tasksQueries";
import { computeStreak, useXpDays } from "./stats";
import { awardCustom, DS_XP } from "./xp";
import { useSeason } from "./queries";

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

/** Days on which the day-complete bonus fired (tickets + perfect-day facts). */
export function useDayCompletes() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_day_completes", session?.user.id],
    enabled: !!supabase && !!session,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase!
        .from("ds_xp_events")
        .select("happened_on")
        .eq("action", "day_complete");
      if (error) throw error;
      return ((data ?? []) as { happened_on: string }[]).map((r) => r.happened_on);
    },
  });
}

/** Distinct days with completed tasks since a given day (level contracts). */
export function useTaskDaysSince(since: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_task_days", session?.user.id, since],
    enabled: !!supabase && !!session && !!since,
    queryFn: async (): Promise<{ day: string; kind: string }[]> => {
      const { data, error } = await supabase!
        .from("ds_tasks")
        .select("completed_on, kind")
        .eq("status", "done")
        .gte("completed_on", since!);
      if (error) throw error;
      return ((data ?? []) as { completed_on: string; kind: string }[]).map((r) => ({
        day: r.completed_on,
        kind: r.kind,
      }));
    },
  });
}

/** Tell the UI a bond changed (BondToast listens). */
export function announceBond(name: string, delta: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ds:bond", { detail: { name, delta } }));
  }
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
  moodWhy: string;
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
  const dayCompletesQ = useDayCompletes();
  const save = useSaveCrew();
  const SEASON = useSeason();
  const maintained = useRef<string | null>(null);
  const today = appDay();
  const taskDaysQ = useTaskDaysSince(stateQ.data?.state?.exam?.startedOn ?? null);

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
      let moodWhy = "steady as she goes";
      if (c.recruited) {
        if (c.gone) {
          mood = "gone";
          moodWhy = `walked out on ${c.goneSince} — go after them`;
        } else if (area) {
          const detail = areaMoodDetail(area, today, state.startedOn, SEASON, areaDays);
          mood = detail.mood;
          moodWhy =
            detail.of < 2
              ? "fresh aboard — the honeymoon"
              : `${AREA_VERB[area]} ${detail.done} of the last ${detail.of} days${detail.doneToday ? " (+today!)" : ""}`;
          const run = neglectRunOf(area, today, state.startedOn, SEASON, areaDays);
          if (run >= walkoutThresholds(state.village[id]).packing) {
            mood = "packing";
            moodWhy = `${run} neglected days — one real day in their area keeps them`;
          }
          if (id === "nami" && overdue >= 1 && mood !== "packing") {
            mood = capMood(mood, overdue >= 3 ? "sad" : "worried");
            moodWhy = `${overdue} overdue task${overdue > 1 ? "s" : ""} on the map`;
          }
        } else if (id === "naruto") {
          mood = streak.current >= 3 ? "happy" : streak.current >= 1 ? "neutral" : "worried";
          moodWhy = `the streak is ${streak.current} day${streak.current === 1 ? "" : "s"}`;
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
        moodWhy,
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

  const aboardIds = crew.filter((c) => c.recruited && !c.gone).map((c) => c.id);

  // ---- Yesterday's facts → this morning's deck scene ----
  const yesterday = shiftDay(today, -1);
  const yRows = rows.filter((r) => r.day === yesterday);
  const yDone = new Set(yRows.filter((r) => r.status === "done").map((r) => r.anchor_slug));
  const yExcused = new Set(yRows.filter((r) => r.status === "grace").map((r) => r.anchor_slug));
  const facts: YesterdayFacts = {
    day: yesterday,
    perfect: (dayCompletesQ.data ?? []).includes(yesterday),
    doneSlugs: yDone,
    missedRequired: requiredSlugs(yesterday, SEASON).filter(
      (s) => !yDone.has(s) && !yExcused.has(s)
    ),
    tasksDone: 0, // enriched below when task data is loaded
    graceUsed: yExcused.size > 0,
    streak: streak.current,
    overdueNow: overdue,
    isSundayToday: weekdayOf(today) === 0,
  };
  const scene: SceneLine[] =
    state && rowsQ.isSuccess && dayCompletesQ.isSuccess ? sceneForDay(today, aboardIds, facts) : [];

  // ---- Level contract progress ----
  let examInfo: {
    charId: CharId;
    targetLevel: number;
    needed: number;
    have: number;
    desc: string;
  } | null = null;
  if (state?.exam) {
    const ex = state.exam;
    const def = EXAMS[ex.charId];
    let have = 0;
    if (def.metric === "streak_add") {
      have = Math.max(0, streak.current - ex.startStreak);
    } else if (def.metric === "perfect_day") {
      have = (dayCompletesQ.data ?? []).filter((d) => d >= ex.startedOn).length;
    } else if (def.metric === "quiet_day") {
      have = new Set(
        rows.filter((r) => r.status === "done" && r.anchor_slug === "quiet_time" && r.day >= ex.startedOn).map((r) => r.day)
      ).size;
    } else if (def.metric === "task_day") {
      const rowsT = taskDaysQ.data ?? [];
      const relevant =
        ex.charId === "sanji"
          ? rowsT.filter((t) => ["job_application", "job_followup", "bi_practice"].includes(t.kind))
          : rowsT;
      have = new Set(relevant.map((t) => t.day)).size;
    } else {
      const area = examArea(ex.charId);
      let cursor = ex.startedOn;
      while (cursor <= today) {
        const entry = areaDays.get(cursor);
        const done =
          area === "overall" ? (entry?.done.size ?? 0) > 0 : (entry?.done.has(area) ?? false);
        if (done) have++;
        cursor = shiftDay(cursor, 1);
      }
    }
    examInfo = {
      charId: ex.charId,
      targetLevel: ex.targetLevel,
      needed: ex.needed,
      have: Math.min(have, ex.needed),
      desc: def.text(ex.needed),
    };
  }

  // ---- Today's dilemma, resolved to its definition ----
  const dilemmaDef: DilemmaDef | null =
    state?.dilemma && state.dilemma.day === today
      ? (DILEMMAS.find((d) => d.id === state.dilemma!.id) ?? null)
      : null;

  // ---- Maintenance pass: once per (day, data snapshot) ----
  const ready =
    !!session &&
    stateQ.isSuccess &&
    rowsQ.isSuccess &&
    countsQ.isSuccess &&
    xpDaysQ.isSuccess &&
    dayCompletesQ.isSuccess;
  const snapshotKey = ready
    ? `${today}:${rows.length}:${(xpDaysQ.data ?? []).length}:${(dayCompletesQ.data ?? []).length}:${(taskDaysQ.data ?? []).length}`
    : null;

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

    // 2. Walkouts at rollover (a comfy home buys one extra day).
    for (const id of ALL_CHARS) {
      const c = next.characters[id];
      const area = CHAR_AREA[id];
      if (!c.recruited || c.gone || !area) continue;
      const run = neglectRunOf(area, today, next.startedOn, SEASON, areaDays);
      if (run >= walkoutThresholds(next.village[id]).gone) {
        const raw = bondOf(id, today, next, SEASON, areaDays, rows);
        c.gone = true;
        c.goneSince = today;
        c.prevBond = Math.max(0, Math.min(100, raw));
        logIt(`${CHAR_META[id].name} walked out after ${run} neglected days. 💔`);
        changed = true;
      }
    }

    // 2b. Today's character request (odd days) or dilemma (even days) — deterministic.
    const recruitedIds = ALL_CHARS.filter(
      (id) => next.characters[id].recruited && !next.characters[id].gone
    );
    if (next.request?.day !== today) {
      next.request = requestForDay(today, recruitedIds);
      changed = true;
    }
    if (next.dilemma?.day !== today) {
      const d = dilemmaForDay(today, recruitedIds);
      next.dilemma = d ? { day: today, id: d.id, choice: null } : null;
      changed = true;
    }

    // 2c. Storms: a bare built house may take damage (furnished homes shrug it off).
    const target = stormTarget(today, next);
    if (target) {
      next.storm = { day: today, charId: target };
      logIt(`⛈️ A storm damaged ${CHAR_META[target].name}'s home! Repair it (${STORM_REPAIR_COST} XP) — furnished homes would have held.`);
      changed = true;
    }

    // 2d. Level contract passed? (day-level facts only — never check-times)
    if (next.exam && examInfo && examInfo.have >= examInfo.needed) {
      const ch = next.characters[next.exam.charId];
      ch.level = next.exam.targetLevel;
      next.pendingLevelUp = next.exam.charId;
      logIt(`⚡ ${CHAR_META[next.exam.charId].name} passed their trial — ${FORM_NAMES[next.exam.charId][next.exam.targetLevel - 1]} unlocked!`);
      next.exam = null;
      changed = true;
    }

    // 2e. Landfall becomes due: Sundays land this week; later days land a missed week.
    {
      const wd = weekdayOf(today);
      const candidate = wd === 0 ? isoWeekKey(today) : isoWeekKey(shiftDay(mondayOfWeekKey(isoWeekKey(today)), -1));
      if (
        next.voyage.lastLandfallWeek !== candidate &&
        next.voyage.pendingLandfall?.weekKey !== candidate
      ) {
        const monday = mondayOfWeekKey(candidate);
        const sunday = shiftDay(monday, 6);
        const weekXp = (xpDaysQ.data ?? [])
          .filter((d) => d.happened_on >= monday && d.happened_on <= sunday)
          .reduce((s, d) => s + d.points, 0);
        // never celebrate a week from before the voyage began
        if (weekXp > 0 || next.voyage.lastLandfallWeek !== null) {
          next.voyage.pendingLandfall = { weekKey: candidate, weekXp, tier: landfallTier(weekXp) };
          changed = true;
        }
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
        settledGoalWeeks: next.settledGoalWeeks,
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
    scene,
    dilemmaDef,
    examInfo,
    voyage: state?.voyage ?? null,
    storm: state?.storm ?? null,
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
  const SEASON = useSeason();
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

/** Start a level contract: XP pays the tuition, life passes the exam. */
export function useStartExam() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { wallet, streak } = useCrew();
  const today = appDay();
  return (charId: CharId, bond: number): { ok: boolean; message: string } => {
    const state = data?.state;
    if (!state) return { ok: false, message: "Not loaded." };
    if (state.exam) return { ok: false, message: `Finish ${CHAR_META[state.exam.charId].name}'s trial first — one contract at a time.` };
    const c = state.characters[charId];
    const target = c.level + 1;
    if (target > maxLevel(charId)) return { ok: false, message: "Already at their final form." };
    const cost = LEVEL_COST[target] ?? Infinity;
    const gate = LEVEL_BOND_GATE[target] ?? 100;
    if (bond < gate) return { ok: false, message: `Bond too low — reach ${gate} first. Show up for them.` };
    if (wallet < cost) return { ok: false, message: `Tuition is ${cost} XP — you have ${wallet}.` };
    const def = EXAMS[charId];
    const needed = def.needed[target - 2] ?? def.needed[def.needed.length - 1];
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp += cost;
    next.exam = { charId, targetLevel: target, startedOn: today, needed, startStreak: streak.current };
    next.log = [
      { day: today, text: `📜 ${CHAR_META[charId].name}'s trial begun: ${def.text(needed)}` },
      ...next.log,
    ].slice(0, 60);
    save.mutate(next);
    return { ok: true, message: `Trial begun! ${def.text(needed)} (Days count — clock times never do.)` };
  };
}

/** Walk away from a contract — full tuition refund, no hard feelings. */
export function useCancelExam() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  return (): void => {
    const state = data?.state;
    if (!state?.exam) return;
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp = Math.max(0, next.spentXp - (LEVEL_COST[state.exam.targetLevel] ?? 0));
    next.log = [
      { day: appDay(), text: `${CHAR_META[state.exam.charId].name}'s trial set aside — tuition returned.` },
      ...next.log,
    ].slice(0, 60);
    next.exam = null;
    save.mutate(next);
  };
}

/** Answer today's dilemma — bonds and trinkets, never XP. */
export function useAnswerDilemma() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const today = appDay();
  return (def: DilemmaDef, choice: "a" | "b"): string => {
    const state = data?.state;
    if (!state?.dilemma || state.dilemma.day !== today || state.dilemma.choice) {
      return "Already settled.";
    }
    const opt = def[choice];
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.dilemma = { ...state.dilemma, choice };
    for (const [id, delta] of Object.entries(opt.bond ?? {})) {
      next.characters[id as CharId].bondBonus += delta ?? 0;
      announceBond(CHAR_META[id as CharId].name, delta ?? 0);
    }
    if (opt.furniture) next.furnitureInv.push(opt.furniture);
    next.log = [{ day: today, text: `🎭 ${opt.result}` }, ...next.log].slice(0, 60);
    save.mutate(next);
    return opt.result;
  };
}

/** Make landfall: reveal the island, feast, open the chest. */
export function useLandfall() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const today = appDay();
  return (): { name: string; emoji: string; blurb: string; hue: number; tier: number; drops: string[] } | null => {
    const state = data?.state;
    const pending = state?.voyage.pendingLandfall;
    if (!state || !pending) return null;
    const island = islandAt(state.voyage.islandIndex);
    const drops: string[] = [];
    if (pending.tier >= 2) drops.push(DROP_COMMON[seededHashLocal(pending.weekKey + ":c1") % DROP_COMMON.length]);
    if (pending.tier >= 3) drops.push(DROP_COMMON[seededHashLocal(pending.weekKey + ":c2") % DROP_COMMON.length]);
    if (pending.tier >= 4) drops.push(DROP_RARE[seededHashLocal(pending.weekKey + ":r") % DROP_RARE.length]);
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.voyage.islandIndex += 1;
    next.voyage.lastLandfallWeek = pending.weekKey;
    next.voyage.pendingLandfall = null;
    next.furnitureInv.push(...drops);
    next.log = [
      { day: today, text: `${island.emoji} Landfall at ${island.name}! ${TIER_LINES[pending.tier]}` },
      ...next.log,
    ].slice(0, 60);
    save.mutate(next);
    return { name: island.name, emoji: island.emoji, blurb: island.blurb, hue: island.hue, tier: pending.tier, drops };
  };
}

function seededHashLocal(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Repair a storm-damaged home. */
export function useRepairStorm() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { wallet } = useCrew();
  return (): { ok: boolean; message: string } => {
    const state = data?.state;
    if (!state?.storm) return { ok: false, message: "Nothing to repair." };
    if (wallet < STORM_REPAIR_COST) return { ok: false, message: `Repairs cost ${STORM_REPAIR_COST} XP — you have ${wallet}.` };
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp += STORM_REPAIR_COST;
    next.log = [
      { day: appDay(), text: `🔨 ${CHAR_META[state.storm.charId].name}'s home repaired. Furnish it — furnished homes hold in storms.` },
      ...next.log,
    ].slice(0, 60);
    next.storm = null;
    save.mutate(next);
    return { ok: true, message: "Repaired! Now furnish it against the next one." };
  };
}

/** Grace tokens: 2/week, typed reason, never for the confession, no XP. */
export function useGrace() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { session } = useAuth();
  const qc = useQueryClient();
  const today = appDay();
  const weekKey = isoWeekKey(today);
  const state = data?.state ?? null;
  const used = state ? (state.grace.weekKey === weekKey ? state.grace.used : 0) : 0;
  const left = Math.max(0, GRACE_PER_WEEK - used);

  const grace = useMutation({
    mutationFn: async ({ slug, reason }: { slug: string; reason: string }) => {
      if (!supabase || !state) throw new Error("Not ready.");
      if (slug === "confession") throw new Error("The confession has no substitute.");
      if (left <= 0) throw new Error("No grace tokens left this week.");
      if (reason.trim().length < 10) throw new Error("Write the real reason (10+ characters).");
      const { error } = await supabase.from("ds_anchor_log").upsert(
        { day: today, anchor_slug: slug, status: "grace", meta: { graceReason: reason.trim() } },
        { onConflict: "user_id,day,anchor_slug", ignoreDuplicates: true }
      );
      if (error) throw error;
      save.mutate({
        ...state,
        grace: { weekKey, used: used + 1 },
        log: [
          { day: today, text: `🕊️ Grace used for ${slug}: "${reason.trim().slice(0, 80)}"` },
          ...state.log,
        ].slice(0, 60),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ds_anchor_log", session?.user.id, today] });
      void qc.invalidateQueries({ queryKey: ["ds_anchor_range", session?.user.id] });
    },
  });

  return { left, grace };
}

/** Rotate the skill deck after a completed skill block. */
export function useAdvanceSkill() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  return () => {
    const state = data?.state;
    if (!state) return;
    save.mutate({ ...state, skillPointer: state.skillPointer + 1 });
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

/* ------------------------------------------------------------------ */
/* Village actions                                                     */
/* ------------------------------------------------------------------ */

async function awardRequest(state: CrewState, today: string): Promise<CrewState> {
  const req = state.request!;
  await awardCustom("char_request", "request", today, DS_XP.char_request);
  const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
  next.request = { ...req, done: true };
  next.characters[req.charId].bondBonus += 2;
  announceBond(CHAR_META[req.charId].name, 2);
  next.log = [
    { day: today, text: `${CHAR_META[req.charId].name}'s request fulfilled. +2 bond 💛` },
    ...next.log,
  ].slice(0, 60);
  return next;
}

export function useVillage() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { wallet } = useCrew();
  const today = appDay();

  const buildOrTheme = (charId: CharId): { ok: boolean; message: string } => {
    const state = data?.state;
    if (!state) return { ok: false, message: "Not loaded." };
    const home = state.village[charId];
    const cost = home.built ? THEME_COST : HOUSE_COST;
    if (home.built && home.themed) return { ok: false, message: "Their home is complete." };
    if (wallet < cost) return { ok: false, message: `Need ${cost} XP — you have ${wallet}.` };
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp += cost;
    const h = next.village[charId];
    if (!h.built) h.built = true;
    else h.themed = true;
    next.log = [
      {
        day: today,
        text: h.themed
          ? `${CHAR_META[charId].name}'s home became their dream space! 🏡✨`
          : `You built ${CHAR_META[charId].name} a home. 🏠`,
      },
      ...next.log,
    ].slice(0, 60);
    save.mutate(next);
    return { ok: true, message: h.themed ? "Upgraded! They love it." : "Home built! Now furnish it." };
  };

  const buyFurniture = (itemId: string): { ok: boolean; message: string } => {
    const state = data?.state;
    const def = furnitureById(itemId);
    if (!state || !def) return { ok: false, message: "Unknown item." };
    if (def.cost <= 0) return { ok: false, message: "That one only comes from playtime prizes." };
    if (wallet < def.cost) return { ok: false, message: `Need ${def.cost} XP — you have ${wallet}.` };
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.spentXp += def.cost;
    next.furnitureInv.push(itemId);
    save.mutate(next);
    return { ok: true, message: `${def.emoji} ${def.title} bought — place it in a home.` };
  };

  const placeFurniture = async (charId: CharId, itemId: string): Promise<{ ok: boolean; message: string }> => {
    const state = data?.state;
    if (!state) return { ok: false, message: "Not loaded." };
    const home = state.village[charId];
    if (!home.built) return { ok: false, message: "Build their home first." };
    if (home.furniture.length >= HOME_SLOTS) return { ok: false, message: "Their home is full." };
    const invIdx = state.furnitureInv.indexOf(itemId);
    if (invIdx === -1) return { ok: false, message: "Not in your inventory." };
    let next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    next.furnitureInv.splice(invIdx, 1);
    next.village[charId].furniture.push(itemId);
    // Sakura-style "furnish" requests complete on placement.
    if (next.request && !next.request.done && next.request.day === today && next.request.kind === "furnish") {
      next = await awardRequest(next, today);
    }
    save.mutate(next);
    return { ok: true, message: "Placed. The home feels warmer." };
  };

  const removeFurniture = (charId: CharId, slotIdx: number) => {
    const state = data?.state;
    if (!state) return;
    const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
    const [item] = next.village[charId].furniture.splice(slotIdx, 1);
    if (item) next.furnitureInv.push(item);
    save.mutate(next);
  };

  return { buildOrTheme, buyFurniture, placeFurniture, removeFurniture };
}

/** Claim today's character request once its condition is truly met. */
export function useClaimRequest() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const { session } = useAuth();
  const qc = useQueryClient();
  const tasksQ = useOpenTasks();
  const today = appDay();

  return async (): Promise<{ ok: boolean; message: string }> => {
    const state = data?.state;
    const req = state?.request;
    if (!state || !req || req.done || req.day !== today) return { ok: false, message: "No open request." };
    if (req.kind === "anchor" && req.targetSlug) {
      const cached = qc.getQueryData(["ds_anchor_log", session?.user.id, today]) as
        | Record<string, { status: string }>
        | undefined;
      if (cached?.[req.targetSlug]?.status !== "done") {
        return { ok: false, message: "Not done yet — do it for real first." };
      }
    } else if (req.kind === "zero_overdue") {
      const overdue = (tasksQ.data ?? []).filter((t) => t.due_on && t.due_on < today).length;
      if (overdue > 0) return { ok: false, message: `${overdue} still overdue — clear the map first.` };
    } else if (req.kind === "furnish") {
      return { ok: false, message: "Place a furniture piece in any home — it claims itself." };
    }
    const next = await awardRequest(state, today);
    save.mutate(next);
    return { ok: true, message: "Request fulfilled! +10 XP, +2 bond 💛" };
  };
}

/* ------------------------------------------------------------------ */
/* Playtime: tickets from real life, prizes for the homes              */
/* ------------------------------------------------------------------ */

import { DROP_COMMON, DROP_RARE, TICKET_STASH_CAP } from "./crew";

/** Tickets — ONE simple rule: a completed day earns 1 ticket. */
export function useTickets() {
  const { data } = useCrewState();
  const dayCompletesQ = useDayCompletes();
  const spent = data?.state?.ticketsSpent ?? 0;
  return {
    loading: dayCompletesQ.isLoading,
    available: Math.max(0, Math.min(TICKET_STASH_CAP, (dayCompletesQ.data?.length ?? 0) - spent)),
  };
}

/** One ticket = one Crew Memory session. Pays bond + furniture — NEVER XP. */
export function useMemorySession() {
  const { data } = useCrewState();
  const save = useSaveCrew();
  const today = appDay();

  const start = (): boolean => {
    const state = data?.state;
    if (!state) return false;
    save.mutate({ ...state, ticketsSpent: state.ticketsSpent + 1 });
    return true;
  };

  const finish = (companion: CharId, perfect: boolean): { dropId: string } => {
    const dropId = perfect
      ? DROP_RARE[Math.floor(Math.random() * DROP_RARE.length)]
      : DROP_COMMON[Math.floor(Math.random() * DROP_COMMON.length)];
    const state = data?.state;
    if (state) {
      const next: CrewState = JSON.parse(JSON.stringify(state)) as CrewState;
      next.characters[companion].bondBonus += 3;
      next.furnitureInv.push(dropId);
      next.log = [
        {
          day: today,
          text: `🃏 Crew Memory with ${CHAR_META[companion].name}${perfect ? " — a PERFECT round" : ""}! Won ${furnitureById(dropId)?.emoji} ${furnitureById(dropId)?.title}. +3 bond`,
        },
        ...next.log,
      ].slice(0, 60);
      save.mutate(next);
      announceBond(CHAR_META[companion].name, 3);
    }
    return { dropId };
  };

  return { start, finish };
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
