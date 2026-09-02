/**
 * The crew engine — pure functions only. No React, no network.
 * Every function takes data and returns data; crewQueries.ts wires it to the app.
 *
 * Phase 2: the starting three (Luffy, Zoro, Nami) with moods and bonds.
 * Walkouts, comeback quests, recruits, and level forms arrive in Phase 4 —
 * the state shape already leaves room for them (normalizeCrew fills defaults).
 */
import { shiftDay, weekdayOf } from "./day";
import { anchorsForDay, type AreaId, type Season } from "./anchors";

export type CharId =
  | "luffy"
  | "zoro"
  | "nami"
  | "usopp"
  | "sanji"
  | "chopper"
  | "robin"
  | "naruto"
  | "sasuke"
  | "sakura"
  | "kakashi"
  | "hinata";

export type Mood = "happy" | "neutral" | "worried" | "sad" | "packing" | "gone";

export const ALL_CHARS: CharId[] = [
  "luffy",
  "zoro",
  "nami",
  "usopp",
  "sanji",
  "chopper",
  "robin",
  "naruto",
  "sasuke",
  "sakura",
  "kakashi",
  "hinata",
];

export const STARTING_CREW: CharId[] = ["luffy", "zoro", "nami"];

/** Which slice of Favour's real life each character owns. null = special role. */
export const CHAR_AREA: Record<CharId, AreaId | null> = {
  luffy: "overall",
  zoro: "body",
  nami: "plan",
  usopp: "skills",
  hinata: "faith",
  chopper: "calm",
  sanji: "provision",
  robin: "mind",
  naruto: null, // the streak itself (Phase 4)
  sakura: null, // weekly goals (Phase 5)
  kakashi: null, // mentor (Phase 4)
  sasuke: null, // comeback-quest guide (Phase 4)
};

export const CHAR_META: Record<CharId, { name: string; role: string }> = {
  luffy: { name: "Luffy", role: "Captain — your whole day" },
  zoro: { name: "Zoro", role: "Body — exercise" },
  nami: { name: "Nami", role: "Navigator — plans & closing your day" },
  usopp: { name: "Usopp", role: "Skills" },
  sanji: { name: "Sanji", role: "Provision — job prep" },
  chopper: { name: "Chopper", role: "Calm — quiet time" },
  robin: { name: "Robin", role: "Mind — books & learning" },
  naruto: { name: "Naruto", role: "Consistency — the streak" },
  sasuke: { name: "Sasuke", role: "Redemption" },
  sakura: { name: "Sakura", role: "Weekly goals" },
  kakashi: { name: "Kakashi", role: "Mentor" },
  hinata: { name: "Hinata", role: "Faith" },
};

export interface CharState {
  recruited: boolean;
  recruitedOn: string | null;
  /** Bond earned outside the log (puzzle sessions etc. in later phases). */
  bondBonus: number;
  /** History before this day is ignored by the bond formula (reunion fresh start). */
  bondSince: string | null;
  level: number;
  gone: boolean;
  goneSince: string | null;
  prevBond: number;
}

export interface ComebackQuest {
  charId: CharId;
  startedOn: string;
  daysDone: number; // 0..3
  lastDayDone: string | null;
}

export interface CrewState {
  version: 1;
  startedOn: string;
  spentXp: number;
  characters: Record<CharId, CharState>;
  comeback: ComebackQuest | null;
  comebackDone: boolean;
  pendingRecruit: CharId | null;
  pendingReunion: CharId | null;
  /** Grace tokens: 2 per ISO week, spent with a typed reason. */
  grace: { weekKey: string; used: number };
  /** This week's self-picked goals (settled the following week). */
  weekly: { weekKey: string; picks: string[]; settled: boolean } | null;
  settledGoalWeeks: number;
  skillPointer: number;
  /** The village: each character's home, built and furnished with XP. */
  village: Record<CharId, HomeState>;
  /** Furniture owned but not yet placed (shop buys + puzzle drops). */
  furnitureInv: string[];
  /** Play tickets spent (earned side is derived from the XP ledger). */
  ticketsSpent: number;
  /** Today's character request, if one came. */
  request: CharRequest | null;
  /** Today's dilemma (alternates with requests), null = none today. */
  dilemma: { day: string; id: string; choice: "a" | "b" | null } | null;
  /** Active level contract: XP paid the tuition, life passes the exam. */
  exam: {
    charId: CharId;
    targetLevel: number;
    startedOn: string;
    needed: number;
    startStreak: number;
  } | null;
  /** The island voyage. */
  voyage: {
    islandIndex: number;
    lastLandfallWeek: string | null;
    pendingLandfall: { weekKey: string; weekXp: number; tier: number } | null;
  };
  /** Storm damage on one home, until repaired. */
  storm: { day: string; charId: CharId } | null;
  /** A just-passed exam waiting for its celebration scene. */
  pendingLevelUp: CharId | null;
  log: { day: string; text: string }[];
}

export interface HomeState {
  built: boolean;
  themed: boolean;
  furniture: string[]; // item ids in slots, max HOME_SLOTS
}

export interface CharRequest {
  day: string;
  charId: CharId;
  kind: "anchor" | "furnish" | "zero_overdue";
  targetSlug: string | null;
  text: string;
  done: boolean;
}

function defaultChar(id: CharId, startedOn: string): CharState {
  const starter = STARTING_CREW.includes(id);
  return {
    recruited: starter,
    recruitedOn: starter ? startedOn : null,
    bondBonus: 0,
    bondSince: null,
    level: 1,
    gone: false,
    goneSince: null,
    prevBond: 0,
  };
}

/** Migration-on-load: every field gets a default, old blobs upgrade silently.
 *  NEVER rename a stored field — add new ones with ?? defaults instead. */
export function normalizeCrew(raw: unknown, today: string): CrewState {
  const r = (raw ?? {}) as Partial<CrewState>;
  const startedOn = r.startedOn ?? today;
  const chars = {} as Record<CharId, CharState>;
  for (const id of ALL_CHARS) {
    const c = (r.characters?.[id] ?? {}) as Partial<CharState>;
    const base = defaultChar(id, startedOn);
    chars[id] = {
      recruited: c.recruited ?? base.recruited,
      recruitedOn: c.recruitedOn ?? base.recruitedOn,
      bondBonus: c.bondBonus ?? 0,
      bondSince: c.bondSince ?? null,
      level: c.level ?? 1,
      gone: c.gone ?? false,
      goneSince: c.goneSince ?? null,
      prevBond: c.prevBond ?? 0,
    };
  }
  return {
    version: 1,
    startedOn,
    spentXp: r.spentXp ?? 0,
    characters: chars,
    comeback: r.comeback ?? null,
    comebackDone: r.comebackDone ?? false,
    pendingRecruit: r.pendingRecruit ?? null,
    pendingReunion: r.pendingReunion ?? null,
    grace: r.grace ?? { weekKey: "", used: 0 },
    weekly: r.weekly ?? null,
    settledGoalWeeks: r.settledGoalWeeks ?? 0,
    skillPointer: r.skillPointer ?? 0,
    village: (() => {
      const v = {} as Record<CharId, HomeState>;
      for (const id of ALL_CHARS) {
        const h = (r.village?.[id] ?? {}) as Partial<HomeState>;
        v[id] = {
          built: h.built ?? false,
          themed: h.themed ?? false,
          furniture: (h.furniture ?? []).slice(0, HOME_SLOTS),
        };
      }
      return v;
    })(),
    furnitureInv: r.furnitureInv ?? [],
    ticketsSpent: r.ticketsSpent ?? 0,
    request: r.request ?? null,
    dilemma: r.dilemma ?? null,
    exam: r.exam ?? null,
    voyage: r.voyage ?? { islandIndex: 0, lastLandfallWeek: null, pendingLandfall: null },
    storm: r.storm ?? null,
    pendingLevelUp: r.pendingLevelUp ?? null,
    log: (r.log ?? []).slice(0, 60),
  };
}

/* ------------------------------------------------------------------ */
/* Playtime (Phase 7)                                                  */
/* ------------------------------------------------------------------ */

export const TICKET_STASH_CAP = 5;
export const TICKETS_PER_DAY_FROM_TASKS = 2;

/** Prize pools — puzzle sessions pay furniture and bond, NEVER XP. */
export const DROP_COMMON = ["goldfish", "shell", "vase"];
export const DROP_RARE = ["telescope", "trophy", "chest"];
export const PUZZLE_COMMON_SCORE = 300;
export const PUZZLE_RARE_SCORE = 1200;

/* ------------------------------------------------------------------ */
/* Grace tokens                                                        */
/* ------------------------------------------------------------------ */

export const GRACE_PER_WEEK = 2;

/* ------------------------------------------------------------------ */
/* Skill deck (rotates via skillPointer)                               */
/* ------------------------------------------------------------------ */

export interface SkillCard {
  id: string;
  title: string;
  emoji: string;
}

/** Personalized from Favour's 20-questions interview (2026-08-27):
 *  chart-design joy, defend-without-AI September prep, storyteller-explainer
 *  gifts, childhood reading love, and small tests of the YouTube dream. */
export const SKILL_DECK: SkillCard[] = [
  { id: "defend_sql", title: "Answer one SQL question out loud — no AI, no notes. Defend it.", emoji: "🛡️" },
  { id: "chart_design", title: "Design one beautiful chart from any dataset (your favorite part!)", emoji: "📊" },
  { id: "explain_chart", title: "Explain a chart out loud like you're clarifying it for a classmate", emoji: "🎙️" },
  { id: "novel_joy", title: "Read one chapter of any novel — pure joy, like age 10", emoji: "📖" },
  { id: "bible_recap", title: "Script a 3-min Bible story told like a manga recap", emoji: "✝️" },
  { id: "yt_study", title: "Watch one faceless channel at 2x — note WHY it works", emoji: "📹" },
  { id: "ai_new", title: "Try one new AI thing — then explain it without the AI", emoji: "🤖" },
  { id: "defend_stats", title: "Explain one data concept (join, average vs median…) from memory", emoji: "🧠" },
  { id: "organize_detail", title: "Plan any upcoming thing to the detail for 10 min — your gift", emoji: "🗂️" },
  { id: "sing_song", title: "Learn one new song verse by heart — and sing it", emoji: "🎵" },
];

/* ------------------------------------------------------------------ */
/* Weekly goals (pick 2, settled next week)                            */
/* ------------------------------------------------------------------ */

export interface GoalDef {
  id: string;
  title: string;
  emoji: string;
}

export const GOALS_DECK: GoalDef[] = [
  { id: "dev6", title: "Devotional every weekday (6/6)", emoji: "📖" },
  { id: "workouts3", title: "3 workouts with your sister", emoji: "💪" },
  { id: "quiet5", title: "5 quiet times", emoji: "🌊" },
  { id: "apps2", title: "2 job applications sent", emoji: "📨" },
  { id: "zero_overdue", title: "Zero overdue tasks at week's end", emoji: "🗺️" },
  { id: "book5", title: "Book reading on 5 days", emoji: "📗" },
  { id: "church4", title: "4+ church events attended", emoji: "⛪" },
  { id: "perfect2", title: "2 perfect days", emoji: "🏴‍☠️" },
];

/* ------------------------------------------------------------------ */
/* Mapping log rows → areas                                            */
/* ------------------------------------------------------------------ */

export interface LogRow {
  day: string;
  anchor_slug: string;
  status: "done" | "grace";
}

/** Which area a logged slug feeds. Church events feed faith.
 *  The confession/ceremony feeds "plan" too — closing the day IS Nami's ritual. */
export function areasOfSlug(slug: string): AreaId[] {
  if (slug.startsWith("church_")) return ["faith"];
  switch (slug) {
    case "devotional":
    case "noon_prayer":
    case "bible":
    case "family_prayers":
      return ["faith"];
    case "exercise":
      return ["body"];
    case "book":
    case "money_tree":
      return ["mind"];
    case "quiet_time":
      return ["calm"];
    case "skill_block":
      return ["skills"];
    case "confession":
      return ["faith", "plan"];
    default:
      return [];
  }
}

/** Areas that have at least one required anchor on this day.
 *  Sundays are rest: NO area counts as expected (mood math skips them). */
export function expectedAreas(day: string, season: Season): Set<AreaId> {
  if (weekdayOf(day) === 0) return new Set();
  const out = new Set<AreaId>();
  for (const a of anchorsForDay(day, season)) {
    if (a.required) out.add(a.area);
  }
  out.add("plan"); // closing the day with the ceremony is always expected
  return out;
}

export interface AreaDay {
  done: Set<AreaId>;
  excused: Set<AreaId>;
}

export function buildAreaDays(rows: LogRow[] = []): Map<string, AreaDay> {
  const map = new Map<string, AreaDay>();
  for (const row of rows) {
    let entry = map.get(row.day);
    if (!entry) {
      entry = { done: new Set(), excused: new Set() };
      map.set(row.day, entry);
    }
    for (const area of areasOfSlug(row.anchor_slug)) {
      (row.status === "grace" ? entry.excused : entry.done).add(area);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Moods                                                               */
/* ------------------------------------------------------------------ */

/** Last N days (ending yesterday) on which `area` was expected and not excused. */
function recentExpectedDays(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season,
  areaDays: Map<string, AreaDay>,
  n = 3
): string[] {
  const out: string[] = [];
  let cursor = shiftDay(today, -1);
  // look back at most 14 calendar days for 3 expected ones
  for (let i = 0; i < 14 && out.length < n; i++) {
    if (cursor < startedOn) break;
    const expected =
      area === "overall" ? expectedAreas(cursor, season).size > 0 : expectedAreas(cursor, season).has(area);
    const excused = areaDays.get(cursor)?.excused.has(area) ?? false;
    if (expected && !excused) out.push(cursor);
    cursor = shiftDay(cursor, -1);
  }
  return out;
}

function areaDoneOn(area: AreaId, day: string, areaDays: Map<string, AreaDay>): boolean {
  const entry = areaDays.get(day);
  if (!entry) return false;
  if (area === "overall") {
    // Luffy is satisfied by any real activity; a perfect day makes him beam elsewhere
    return entry.done.size > 0;
  }
  return entry.done.has(area);
}

/**
 * Mood over the last 3 expected days ending yesterday, with a live bump for
 * anything done today. New sailors (<2 expected days of history) start happy.
 */
export function areaMoodDetail(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season,
  areaDays: Map<string, AreaDay>
): { mood: Mood; done: number; of: number; doneToday: boolean } {
  const days = recentExpectedDays(area, today, startedOn, season, areaDays);
  const doneToday = areaDoneOn(area, today, areaDays);
  if (days.length < 2) return { mood: "happy", done: days.length, of: days.length, doneToday };
  const done = days.filter((d) => areaDoneOn(area, d, areaDays)).length;
  const ratio = done / days.length;
  let mood: Mood;
  if (ratio >= 2 / 3) mood = "happy";
  else if (ratio >= 1 / 3) mood = "neutral";
  else if (ratio > 0) mood = "worried";
  else mood = "sad";
  if (doneToday) mood = bumpMood(mood);
  return { mood, done, of: days.length, doneToday };
}

export function areaMood(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season,
  areaDays: Map<string, AreaDay>
): Mood {
  return areaMoodDetail(area, today, startedOn, season, areaDays).mood;
}

/** Human words for each area, for the "why" lines. */
export const AREA_VERB: Record<AreaId, string> = {
  body: "trained",
  faith: "kept the faith",
  mind: "fed the mind",
  calm: "sat quietly",
  plan: "closed the day",
  skills: "practiced",
  provision: "prepared the future",
  overall: "showed up",
};

const MOOD_ORDER: Mood[] = ["sad", "worried", "neutral", "happy"];
function bumpMood(m: Mood): Mood {
  const i = MOOD_ORDER.indexOf(m);
  return i >= 0 && i < MOOD_ORDER.length - 1 ? MOOD_ORDER[i + 1] : m;
}

/* ------------------------------------------------------------------ */
/* Bonds                                                               */
/* ------------------------------------------------------------------ */

/**
 * Bond 0-100, recomputed from history (idempotent, no drift):
 * +2 per relevant completion (capped at +6/day), −3 per neglected expected day,
 * plus the stored bondBonus (puzzle sessions etc., later phases).
 */
export function bondOf(
  char: CharId,
  today: string,
  state: CrewState,
  season: Season,
  areaDays: Map<string, AreaDay>,
  rows: LogRow[]
): number {
  const area = CHAR_AREA[char];
  if (!area) return clampBond(state.characters[char].bondBonus);
  const from = state.characters[char].bondSince ?? state.startedOn;
  let bond = 0;
  // completions: count per day, capped
  const perDay = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "done" || row.day < from) continue;
    const areas = areasOfSlug(row.anchor_slug);
    const relevant = area === "overall" ? areas.length > 0 : areas.includes(area);
    if (relevant) perDay.set(row.day, (perDay.get(row.day) ?? 0) + 1);
  }
  for (const count of perDay.values()) bond += Math.min(6, count * 2);
  // neglect: expected days (excluding today) with nothing done
  let cursor = from;
  while (cursor < today) {
    const expected =
      area === "overall" ? expectedAreas(cursor, season).size > 0 : expectedAreas(cursor, season).has(area);
    const excused = areaDays.get(cursor)?.excused.has(area) ?? false;
    if (expected && !excused && !areaDoneOn(area, cursor, areaDays)) bond -= 3;
    cursor = shiftDay(cursor, 1);
  }
  return clampBond(bond + state.characters[char].bondBonus);
}

function clampBond(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function bondTier(bond: number): string {
  if (bond >= 75) return "Nakama";
  if (bond >= 50) return "Trusted";
  if (bond >= 25) return "Friend";
  return "Acquaintance";
}

/* ------------------------------------------------------------------ */
/* Flavor                                                              */
/* ------------------------------------------------------------------ */

export const MOOD_LINES: Record<CharId, Partial<Record<Mood, string>>> = {
  luffy: {
    happy: "This crew is the best! Keep the days coming!",
    neutral: "We're sailing… kind of. Let's pick it up!",
    worried: "Oi… the ship feels quiet. Where's my crew's energy?",
    sad: "A captain doesn't leave. But this silence hurts.",
  },
  zoro: {
    happy: "Good. Again tomorrow. That's how strength works.",
    neutral: "Training's slipping. Don't make me say it twice.",
    worried: "Skipped sessions make weak swords.",
    sad: "…I train alone then.",
  },
  nami: {
    happy: "Course plotted, days closed, zero debts. Perfect.",
    neutral: "The map's getting messy. Close your days properly.",
    worried: "You're sailing blind — approve the plan at night!",
    sad: "A navigator nobody listens to…",
  },
  usopp: {
    happy: "Behold! The great Usopp's apprentice learns a new skill daily!",
    neutral: "A story needs new chapters. Learn something!",
    worried: "Even I can't invent stories about skills you didn't practice…",
    sad: "My tales are running dry…",
  },
  sanji: {
    happy: "The future is well provisioned. Magnifique.",
    neutral: "The pantry's fine, but keep stocking it.",
    worried: "An empty application pipeline is an empty pantry.",
    sad: "How can I cook for a future no one is preparing?",
  },
  chopper: {
    happy: "Your quiet times are the best medicine! (I'm not pleased, you jerk~)",
    neutral: "Doctor's note: a little more stillness, please.",
    worried: "Your mind needs its rest, I'm serious!",
    sad: "Patient refuses treatment…",
  },
  robin: {
    happy: "Fufufu. A well-read captain of her own life.",
    neutral: "The books are patient. But not forever.",
    worried: "Knowledge left unopened is knowledge lost.",
    sad: "A library with no reader…",
  },
  naruto: {
    happy: "The streak is real — believe it!",
    neutral: "Keep it going, dattebayo!",
    worried: "The streak is wobbling — one push, come on!",
    sad: "It broke… so we build it again. That's the ninja way.",
  },
  sasuke: {
    neutral: "…I walked out once too. Coming back is the harder path.",
  },
  sakura: {
    happy: "Weekly goals met — shannaro!",
    neutral: "Pick goals you'll actually fight for.",
    worried: "The week is slipping past its promises.",
    sad: "Promises to yourself count double when broken.",
  },
  kakashi: {
    neutral: "Those who abandon their routines are worse than scum. …No pressure.",
  },
  hinata: {
    happy: "Your walk with God is steady… I'm glad.",
    neutral: "A quiet prayer still counts.",
    worried: "The prayers are getting quieter…",
    sad: "Even now… He waits for you.",
  },
};

export const MOOD_EMOJI: Record<Mood, string> = {
  happy: "😄",
  neutral: "🙂",
  worried: "😟",
  sad: "😢",
  packing: "🎒",
  gone: "💨",
};

/* ------------------------------------------------------------------ */
/* Walkouts (Phase 4)                                                  */
/* ------------------------------------------------------------------ */

export const WALKOUT_PACKING = 4; // consecutive neglected days → packing banner
export const WALKOUT_GONE = 5; // one more → they leave (village comfort adds +1 later)

/** Consecutive expected, non-excused days ending yesterday with NOTHING done. */
export function neglectRunOf(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season,
  areaDays: Map<string, AreaDay>
): number {
  let run = 0;
  let cursor = shiftDay(today, -1);
  for (let i = 0; i < 30; i++) {
    if (cursor < startedOn) break;
    const expected =
      area === "overall" ? expectedAreas(cursor, season).size > 0 : expectedAreas(cursor, season).has(area);
    const excused = areaDays.get(cursor)?.excused.has(area) ?? false;
    if (expected && !excused) {
      const entry = areaDays.get(cursor);
      const done =
        area === "overall" ? (entry?.done.size ?? 0) > 0 : (entry?.done.has(area) ?? false);
      if (done) break;
      run++;
    }
    cursor = shiftDay(cursor, -1);
  }
  return run;
}

/** The most recent day BEFORE today on which `area` was expected. */
export function prevExpectedDay(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season
): string | null {
  let cursor = shiftDay(today, -1);
  for (let i = 0; i < 14; i++) {
    if (cursor < startedOn) return null;
    const expected =
      area === "overall" ? expectedAreas(cursor, season).size > 0 : expectedAreas(cursor, season).has(area);
    if (expected) return cursor;
    cursor = shiftDay(cursor, -1);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Comeback quest                                                      */
/* ------------------------------------------------------------------ */

export const QUEST_STEPS = [
  { title: "Show up", detail: "Do at least one thing in their area today." },
  { title: "Prove it", detail: "Complete their area's full expectations today." },
  { title: "The apology", detail: "Full expectations again — and write a short recommitment." },
];

/** All required anchor slugs for `day` that feed `area`. */
export function requiredSlugsOfArea(day: string, season: Season, area: AreaId): string[] {
  return anchorsForDay(day, season)
    .filter((a) => a.required && (area === "overall" || areasOfSlug(a.slug).includes(area)))
    .map((a) => a.slug);
}

export function questRequirementMet(
  step: number,
  area: AreaId,
  day: string,
  season: Season,
  doneSlugs: Set<string>
): boolean {
  if (step === 1) {
    if (area === "overall") return doneSlugs.size > 0;
    for (const s of doneSlugs) if (areasOfSlug(s).includes(area)) return true;
    return false;
  }
  const need = requiredSlugsOfArea(day, season, area);
  if (need.length === 0) {
    // rest day / no expectations: showing up with one item still counts
    return questRequirementMet(1, area, day, season, doneSlugs);
  }
  return need.every((s) => doneSlugs.has(s));
}

/* ------------------------------------------------------------------ */
/* Recruits                                                            */
/* ------------------------------------------------------------------ */

export interface RecruitStats {
  streak: number;
  skillBlocks: number;
  faithCount: number;
  churchCount: number;
  quietCount: number;
  jobPrepCount: number;
  mindCount: number;
  totalXp: number;
  settledGoalWeeks: number;
  comebackDone: boolean;
}

export interface RecruitDef {
  id: CharId;
  hint: string;
  check: (s: RecruitStats) => boolean;
}

export const RECRUITS: RecruitDef[] = [
  { id: "usopp", hint: "3-day streak + 1 skill block", check: (s) => s.streak >= 3 && s.skillBlocks >= 1 },
  { id: "hinata", hint: "10 faith completions + 2 church events", check: (s) => s.faithCount >= 10 && s.churchCount >= 2 },
  { id: "chopper", hint: "7-day streak + 5 quiet times", check: (s) => s.streak >= 7 && s.quietCount >= 5 },
  { id: "sanji", hint: "5 job-prep completions", check: (s) => s.jobPrepCount >= 5 },
  { id: "robin", hint: "1,500 XP + 10 mind completions", check: (s) => s.totalXp >= 1500 && s.mindCount >= 10 },
  { id: "naruto", hint: "14-day streak", check: (s) => s.streak >= 14 },
  { id: "sakura", hint: "2 weeks with a weekly goal met", check: (s) => s.settledGoalWeeks >= 2 },
  { id: "kakashi", hint: "5,000 lifetime XP", check: (s) => s.totalXp >= 5000 },
  { id: "sasuke", hint: "win someone back (or a 45-day streak)", check: (s) => s.comebackDone || s.streak >= 45 },
];

/* ------------------------------------------------------------------ */
/* Level forms                                                         */
/* ------------------------------------------------------------------ */

export const LEVEL_COST = [0, 0, 400, 1200, 2800]; // index = target level
export const LEVEL_BOND_GATE = [0, 0, 25, 50, 75];

export const FORM_NAMES: Record<CharId, string[]> = {
  luffy: ["Straw Hat", "Gear 2", "Gear 3", "Gear 4"],
  zoro: ["Roronoa", "Two Swords", "Santoryu"],
  nami: ["Navigator", "Clima-Tact", "Weather Witch"],
  usopp: ["Sniper", "Kabuto", "God Usopp"],
  sanji: ["Cook", "Diable Jambe", "Stealth Black"],
  chopper: ["Doctor", "Heavy Point", "Monster Point"],
  robin: ["Scholar", "Mil Fleur", "Demonio"],
  naruto: ["Genin", "Sage Mode", "Kurama Mode", "Baryon Mode"],
  sasuke: ["Shinobi", "Sharingan", "Rinnegan"],
  sakura: ["Kunoichi", "Byakugō Seal", "Blossom"],
  kakashi: ["Jonin", "Raikiri", "Hokage"],
  hinata: ["Hyuga", "Byakugan", "Twin Lions"],
};

export function maxLevel(id: CharId): number {
  return FORM_NAMES[id].length;
}

/* ------------------------------------------------------------------ */
/* The village (Phase 6)                                               */
/* ------------------------------------------------------------------ */

export const HOME_SLOTS = 6;
export const HOUSE_COST = 300;
export const THEME_COST = 500;
/** A built home with 4+ pieces of furniture buys one extra day before a walkout. */
export const COMFY_FURNITURE = 4;

export const HOME_THEMES: Record<CharId, { title: string; emoji: string }> = {
  luffy: { title: "Captain's Galley", emoji: "🍖" },
  zoro: { title: "Training Dojo", emoji: "⚔️" },
  nami: { title: "Map Room", emoji: "🗺️" },
  usopp: { title: "Inventor's Workshop", emoji: "🔧" },
  sanji: { title: "Sea Kitchen", emoji: "🍳" },
  chopper: { title: "Little Clinic", emoji: "💊" },
  robin: { title: "Quiet Library", emoji: "📚" },
  naruto: { title: "Ramen Corner", emoji: "🍜" },
  sasuke: { title: "Hawk's Roost", emoji: "🦅" },
  sakura: { title: "Blossom Yard", emoji: "🌸" },
  kakashi: { title: "Reading Nook", emoji: "📖" },
  hinata: { title: "Prayer Garden", emoji: "🌿" },
};

export interface FurnitureDef {
  id: string;
  title: string;
  emoji: string;
  cost: number; // 0 = puzzle-drop only
  rare?: boolean;
}

export const FURNITURE: FurnitureDef[] = [
  { id: "photo", title: "Framed photo", emoji: "🖼️", cost: 50 },
  { id: "plant", title: "Potted plant", emoji: "🪴", cost: 60 },
  { id: "lamp", title: "Oil lamp", emoji: "🪔", cost: 60 },
  { id: "teapot", title: "Tea set", emoji: "🫖", cost: 60 },
  { id: "banner", title: "Crew banner", emoji: "🚩", cost: 70 },
  { id: "rug", title: "Woven rug", emoji: "🧶", cost: 70 },
  { id: "clock", title: "Wall clock", emoji: "🕰️", cost: 80 },
  { id: "lantern", title: "Paper lantern", emoji: "🏮", cost: 80 },
  { id: "cushion", title: "Floor cushions", emoji: "🛋️", cost: 90 },
  { id: "bookshelf", title: "Bookshelf", emoji: "📚", cost: 90 },
  { id: "weights", title: "Training weights", emoji: "🏋️", cost: 100 },
  { id: "maptable", title: "Chart table", emoji: "🧭", cost: 120 },
  // puzzle-drop only:
  { id: "goldfish", title: "Goldfish bowl", emoji: "🐠", cost: 0 },
  { id: "shell", title: "Sea shell", emoji: "🐚", cost: 0 },
  { id: "vase", title: "Flower vase", emoji: "🌼", cost: 0 },
  { id: "telescope", title: "Brass telescope", emoji: "🔭", cost: 0, rare: true },
  { id: "trophy", title: "Golden trophy", emoji: "🏆", cost: 0, rare: true },
  { id: "chest", title: "Treasure chest", emoji: "🧰", cost: 0, rare: true },
];

export function furnitureById(id: string): FurnitureDef | undefined {
  return FURNITURE.find((f) => f.id === id);
}

export function isComfy(home: HomeState): boolean {
  return home.built && home.furniture.length >= COMFY_FURNITURE;
}

/** Walkout thresholds, stretched one day by a comfy home. */
export function walkoutThresholds(home: HomeState): { packing: number; gone: number } {
  const bonus = isComfy(home) ? 1 : 0;
  return { packing: WALKOUT_PACKING + bonus, gone: WALKOUT_GONE + bonus };
}

/* ------------------------------------------------------------------ */
/* Character requests (Phase 6)                                        */
/* ------------------------------------------------------------------ */

/** Tiny deterministic hash for a day string (same day → same request). */
export function seededHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const REQUEST_TEXT: Partial<Record<CharId, { kind: CharRequest["kind"]; targetSlug: string | null; text: string }>> = {
  luffy: { kind: "anchor", targetSlug: "devotional", text: "Oi! Start the day with me — devotional before anything else!" },
  zoro: { kind: "anchor", targetSlug: "exercise", text: "Train with me today. No excuses, no shortcuts." },
  nami: { kind: "zero_overdue", targetSlug: null, text: "Zero overdue tasks by tonight — the map stays clean." },
  usopp: { kind: "anchor", targetSlug: "skill_block", text: "Learn one thing today and I'll turn it into a legend!" },
  sanji: { kind: "anchor", targetSlug: "book", text: "Feed your future — read those chapters today." },
  chopper: { kind: "anchor", targetSlug: "quiet_time", text: "Doctor's orders: real quiet time today. Phone face-down!" },
  robin: { kind: "anchor", targetSlug: "money_tree", text: "Fufufu… the Money Tree videos. Knowledge compounds." },
  naruto: { kind: "anchor", targetSlug: "noon_prayer", text: "Midday check-in — don't skip the noon prayer, dattebayo!" },
  hinata: { kind: "anchor", targetSlug: "bible", text: "Would you… read a chapter with me today?" },
  sakura: { kind: "furnish", targetSlug: null, text: "This place could use a woman's touch — place one furniture today!" },
  kakashi: { kind: "anchor", targetSlug: "quiet_time", text: "Sit still for ten minutes. The best shinobi read the silence." },
  sasuke: { kind: "anchor", targetSlug: "exercise", text: "Hn. Train. Strength isn't given." },
};

/** Odd-hash days bring a request, even-hash days may bring a dilemma. Deterministic. */
export function requestForDay(day: string, recruited: CharId[]): CharRequest | null {
  if (recruited.length === 0) return null;
  const h = seededHash(day);
  if (h % 2 !== 1 || h % 100 >= 80) return null;
  const charId = recruited[h % recruited.length];
  const plan = REQUEST_TEXT[charId];
  if (!plan) return null;
  return { day, charId, kind: plan.kind, targetSlug: plan.targetSlug, text: plan.text, done: false };
}

/* ------------------------------------------------------------------ */
/* Level contracts — XP pays the tuition, LIFE passes the exam.        */
/* IRON RULE: conditions count day-level facts only. The app never     */
/* judges by WHEN something was checked — she checks late, honestly.   */
/* ------------------------------------------------------------------ */

export interface ExamDef {
  /** needed[i] = requirement for level i+2 */
  needed: number[];
  /** What counts as one qualifying day. */
  metric: "area_day" | "perfect_day" | "streak_add" | "quiet_day" | "task_day";
  text: (n: number) => string;
}

export const EXAMS: Record<CharId, ExamDef> = {
  luffy: { needed: [2, 3, 4], metric: "perfect_day", text: (n) => `Complete ${n} full days — every required anchor. A captain's proof.` },
  zoro: { needed: [3, 4, 5], metric: "area_day", text: (n) => `Train on ${n} days. Any hour counts — done is done.` },
  nami: { needed: [3, 4, 5], metric: "area_day", text: (n) => `Close ${n} days properly at the ceremony.` },
  usopp: { needed: [2, 3], metric: "area_day", text: (n) => `Complete ${n} skill blocks. Legends need material.` },
  sanji: { needed: [2, 3], metric: "task_day", text: (n) => `${n} days with job-prep work done. Stock the pantry.` },
  chopper: { needed: [3, 4], metric: "quiet_day", text: (n) => `${n} real quiet times. Doctor's orders.` },
  robin: { needed: [3, 4], metric: "area_day", text: (n) => `Feed your mind on ${n} days — book or videos.` },
  naruto: { needed: [3, 5, 7], metric: "streak_add", text: (n) => `Grow the streak by ${n} more days. Believe it.` },
  sasuke: { needed: [3, 4], metric: "area_day", text: (n) => `Train on ${n} days. Strength isn't given.` },
  sakura: { needed: [2, 3], metric: "task_day", text: (n) => `${n} days with tasks completed. Shannaro.` },
  kakashi: { needed: [4, 5], metric: "quiet_day", text: (n) => `${n} quiet sits. Read the silence.` },
  hinata: { needed: [3, 4], metric: "area_day", text: (n) => `Walk in faith on ${n} days.` },
};

/** Area used when metric is area_day (falls back per character). */
export function examArea(charId: CharId): AreaId {
  const special: Partial<Record<CharId, AreaId>> = {
    nami: "plan",
    usopp: "skills",
    sasuke: "body",
    robin: "mind",
    hinata: "faith",
  };
  return special[charId] ?? CHAR_AREA[charId] ?? "overall";
}

/* ------------------------------------------------------------------ */
/* The morning deck scene — the crew talks about her real yesterday.   */
/* ------------------------------------------------------------------ */

export interface YesterdayFacts {
  day: string;
  perfect: boolean;
  doneSlugs: Set<string>;
  missedRequired: string[];
  tasksDone: number;
  graceUsed: boolean;
  streak: number;
  overdueNow: number;
  isSundayToday: boolean;
}

export interface SceneLine {
  charId: CharId;
  text: string;
}

interface SceneTemplate {
  id: string;
  needs: CharId[];
  when: (y: YesterdayFacts) => boolean;
  lines: (y: YesterdayFacts) => SceneLine[];
}

const SCENES: SceneTemplate[] = [
  {
    id: "perfect_cheer", needs: ["luffy", "nami"],
    when: (y) => y.perfect,
    lines: (y) => [
      { charId: "luffy", text: `A FULL day yesterday! Every anchor! That's my navigator of life!` },
      { charId: "nami", text: `Streak's at ${y.streak}. Keep this up and I'll almost stop worrying.` },
    ],
  },
  {
    id: "task_storm", needs: ["nami", "zoro"],
    when: (y) => y.tasksDone >= 3,
    lines: (y) => [
      { charId: "nami", text: `${y.tasksDone} tasks cleared off the map yesterday. THAT'S how you sail.` },
      { charId: "zoro", text: `Hmph. Decent. Now do it again.` },
    ],
  },
  {
    id: "exercise_missed", needs: ["zoro", "luffy"],
    when: (y) => y.missedRequired.includes("exercise"),
    lines: () => [
      { charId: "zoro", text: `No training yesterday. Swords don't sharpen themselves.` },
      { charId: "luffy", text: `Oi, ease up — today's a new sea. She'll show up.` },
    ],
  },
  {
    id: "book_missed", needs: ["robin"],
    when: (y) => y.missedRequired.includes("book"),
    lines: () => [
      { charId: "robin", text: `The bookmark didn't move yesterday. Fufufu… it's patient. I'm slightly less so.` },
    ],
  },
  {
    id: "quiet_done", needs: ["chopper"],
    when: (y) => y.doneSlugs.has("quiet_time"),
    lines: () => [
      { charId: "chopper", text: `You actually sat still yesterday! Best medicine there is. (Not that I'm pleased, you jerk~)` },
    ],
  },
  {
    id: "grace_day", needs: ["hinata", "luffy"],
    when: (y) => y.graceUsed,
    lines: () => [
      { charId: "hinata", text: `You used grace yesterday… that's not weakness. Honest rest is also faith.` },
      { charId: "luffy", text: `What she said! Today we go again!` },
    ],
  },
  {
    id: "overdue_nag", needs: ["nami"],
    when: (y) => y.overdueNow >= 1,
    lines: (y) => [
      { charId: "nami", text: `${y.overdueNow} overdue task${y.overdueNow > 1 ? "s" : ""} on my map this morning. We don't sail with dead weight — clear it today.` },
    ],
  },
  {
    id: "streak_high", needs: ["naruto", "zoro"],
    when: (y) => y.streak >= 7,
    lines: (y) => [
      { charId: "naruto", text: `${y.streak} days without breaking! That's a real ninja streak, dattebayo!` },
      { charId: "zoro", text: `Streaks are just training you can count.` },
    ],
  },
  {
    id: "sunday_rest", needs: ["luffy", "chopper"],
    when: (y) => y.isSundayToday,
    lines: () => [
      { charId: "luffy", text: `REST DAY! Captain's orders: church, food, nothing else!` },
      { charId: "chopper", text: `Doctor's orders too! Only the confession tonight. Now rest!` },
    ],
  },
  {
    id: "faith_steady", needs: ["hinata"],
    when: (y) => y.doneSlugs.has("devotional") && y.doneSlugs.has("confession"),
    lines: () => [
      { charId: "hinata", text: `Devotional in the morning, confession at night… your day was held at both ends. I noticed.` },
    ],
  },
  {
    id: "rough_day", needs: ["luffy", "nami"],
    when: (y) => y.missedRequired.length >= 3 && !y.graceUsed,
    lines: (y) => [
      { charId: "luffy", text: `Yesterday was rough — ${y.missedRequired.length} anchors slipped. So what! Rough seas make real sailors!` },
      { charId: "nami", text: `Translation: small start, right now. One checkmark and we're moving.` },
    ],
  },
  {
    id: "banter_meat", needs: ["luffy", "sanji"],
    when: () => true,
    lines: () => [
      { charId: "luffy", text: `Sanjiii! What's for breakfast? Something with meat?` },
      { charId: "sanji", text: `For the lady of this voyage, anything. For you — whatever's left.` },
    ],
  },
  {
    id: "banter_maps", needs: ["nami", "usopp"],
    when: () => true,
    lines: () => [
      { charId: "nami", text: `The next island is closer than it looks. Every XP is wind in the sails.` },
      { charId: "usopp", text: `And when we land, I shall tell the story of how I saw it FIRST!` },
    ],
  },
  {
    id: "banter_calm", needs: ["zoro", "robin"],
    when: () => true,
    lines: () => [
      { charId: "zoro", text: `Quiet morning. Good for training.` },
      { charId: "robin", text: `Or a chapter. The sea doesn't mind which.` },
    ],
  },
  {
    id: "banter_solo_luffy", needs: ["luffy"],
    when: () => true,
    lines: () => [
      { charId: "luffy", text: `Ooooi! The deck's ready, the sea's ready, and I'M ready! What are we conquering today?` },
    ],
  },
];

/** Deterministic morning scene from yesterday's real facts. */
export function sceneForDay(day: string, aboard: CharId[], y: YesterdayFacts): SceneLine[] {
  const present = new Set(aboard);
  const eligible = SCENES.filter(
    (s) => s.when(y) && s.needs.every((c) => present.has(c))
  );
  if (eligible.length === 0) return [];
  const pick = eligible[seededHash(day + ":scene") % eligible.length];
  return pick.lines(y);
}

/* ------------------------------------------------------------------ */
/* Daily dilemmas — small choices, real (small) consequences.          */
/* Choices pay bond or furniture. NEVER XP.                            */
/* ------------------------------------------------------------------ */

export interface DilemmaOption {
  label: string;
  bond?: Partial<Record<CharId, number>>;
  furniture?: string;
  result: string;
}

export interface DilemmaDef {
  id: string;
  needs: CharId[];
  text: string;
  a: DilemmaOption;
  b: DilemmaOption;
}

export const DILEMMAS: DilemmaDef[] = [
  {
    id: "leftovers", needs: ["luffy", "sanji"],
    text: "Luffy is caught elbow-deep in tomorrow's food supplies. Sanji is reaching for the wooden spoon.",
    a: { label: "Let him eat — he's the captain", bond: { luffy: 2 }, result: "Luffy beams. Sanji mutters about savages, but cooks more anyway." },
    b: { label: "Side with the cook", bond: { sanji: 2 }, result: "Sanji bows elegantly. Luffy sulks for exactly four minutes." },
  },
  {
    id: "lost_zoro", needs: ["zoro", "nami"],
    text: "Zoro set out for the training spot an hour ago. The training spot is six steps from his house. He is now somehow at the beach.",
    a: { label: "Draw him a map", bond: { zoro: 2 }, result: "He studies it upside down, grunts thanks, and arrives only slightly late." },
    b: { label: "Let him find his way", bond: { nami: 2 }, result: "Nami cackles. Zoro shows up at sunset, insisting the beach WAS the plan." },
  },
  {
    id: "nap_guard", needs: ["chopper"],
    text: "Chopper found your rest-block spot and is guarding it fiercely. 'No tasks allowed past this point!'",
    a: { label: "Honor the guard — rest properly", bond: { chopper: 2 }, result: "You rest. He checks your pulse twice and declares you 'much improved.'" },
    b: { label: "Negotiate ten minutes of reading", bond: { chopper: 1 }, result: "He allows it, but sets a tiny hourglass and watches it the whole time." },
  },
  {
    id: "tall_tale", needs: ["usopp"],
    text: "Usopp is telling the village your streak is 'one hundred days and blessed by sea kings.' It is not.",
    a: { label: "Correct the record", bond: { usopp: 1 }, result: "'FINE. But when it IS a hundred, I get to say I called it.'" },
    b: { label: "Let the legend grow", bond: { usopp: 2 }, result: "By evening the story includes a whirlpool. You come out of it very well." },
  },
  {
    id: "market_find", needs: ["nami"],
    text: "Nami haggled a trader down on a crate of village goods. 'It's a STEAL. We just… have to take it right now.'",
    a: { label: "Trust the navigator", furniture: "lantern", result: "It's a paper lantern, and it's lovely. Nami looks unbearably smug." },
    b: { label: "Walk away calmly", bond: { nami: 1 }, result: "'…Respect. Slow money is real money.' She notes it on the map for later." },
  },
  {
    id: "shy_prayer", needs: ["hinata"],
    text: "Hinata is lingering by your door, pressing her fingers together. She wants to ask something.",
    a: { label: "Invite her in to pray together", bond: { hinata: 3 }, result: "Her whole face lights up. The quiet afterwards feels like a roof over the day." },
    b: { label: "Smile and wave from the desk", bond: { hinata: 1 }, result: "She nods quickly and leaves a folded verse under your door." },
  },
  {
    id: "late_kakashi", needs: ["kakashi"],
    text: "Kakashi arrives three hours late to the village meeting. 'A black cat crossed my path, so I took the long way around the sea.'",
    a: { label: "Call it out", bond: { kakashi: 1 }, result: "One visible eye crinkles. 'Fair.' He is somehow late leaving, too." },
    b: { label: "Let it slide", bond: { kakashi: 2 }, result: "He hands you a book you mentioned once, weeks ago. So THAT'S where he was." },
  },
  {
    id: "roof_brooder", needs: ["sasuke"],
    text: "Sasuke has been sitting on his roof since dawn, watching the horizon dramatically.",
    a: { label: "Bring him tea, say nothing", bond: { sasuke: 3 }, result: "He takes it. Ten minutes later: '…the horizon is acceptable today.' High praise." },
    b: { label: "Yell that dinner's ready", bond: { sasuke: 1 }, result: "He appears at the table without ever visibly climbing down." },
  },
  {
    id: "crate_reorg", needs: ["sakura"],
    text: "Sakura has opinions about how your furniture crate is organized. Loud opinions.",
    a: { label: "Let her reorganize everything", bond: { sakura: 2 }, result: "It's… genuinely better now. Everything is labeled. SHANNARO." },
    b: { label: "Defend your chaos", bond: { sakura: 1 }, result: "'Fine! But when you can't find the lamp, I'm saying nothing.' She says something." },
  },
  {
    id: "found_shell", needs: ["luffy", "robin"],
    text: "Luffy found 'a super rare treasure' on the beach. Robin identifies it as a fairly ordinary — though pretty — shell.",
    a: { label: "Treasure it anyway", furniture: "shell", result: "It goes on display. Luffy tells everyone. Robin smiles and lets him." },
    b: { label: "Return it to the sea", bond: { robin: 2 }, result: "'The sea keeps its libraries too,' Robin says. Luffy salutes the waves." },
  },
  {
    id: "storm_prep", needs: ["zoro", "robin"],
    text: "Clouds are stacking on the horizon. Zoro wants to board up windows; Robin wants to move the books first.",
    a: { label: "Windows first", bond: { zoro: 2 }, result: "The village stands ready. Zoro nods once, which is a speech, from him." },
    b: { label: "Books first", bond: { robin: 2 }, result: "The library survives anything now. Robin shelves them by candlelight, content." },
  },
  {
    id: "ramen_night", needs: ["naruto", "sanji"],
    text: "Naruto is campaigning loudly for a village ramen night. Sanji has Opinions about instant noodles.",
    a: { label: "Ramen night!", bond: { naruto: 2 }, result: "Sanji makes it from scratch out of spite. It's the best ramen anyone's had, dattebayo." },
    b: { label: "Chef's choice", bond: { sanji: 2 }, result: "A five-course meal appears. Naruto forgives everything by course two." },
  },
];

/** Even-hash days may bring a dilemma (requests take odd days). */
export function dilemmaForDay(day: string, aboard: CharId[]): DilemmaDef | null {
  const h = seededHash(day);
  if (h % 2 !== 0 || h % 100 >= 70) return null;
  const present = new Set(aboard);
  const eligible = DILEMMAS.filter((d) => d.needs.every((c) => present.has(c)));
  if (eligible.length === 0) return null;
  return eligible[seededHash(day + ":dilemma") % eligible.length];
}

/* ------------------------------------------------------------------ */
/* The island voyage — the week's XP sails the ship; Sunday = landfall.*/
/* ------------------------------------------------------------------ */

export interface IslandDef {
  id: string;
  name: string;
  emoji: string;
  hue: number; // island art hue
  blurb: string;
}

export const ISLANDS: IslandDef[] = [
  { id: "dawn", name: "Dawn Shore", emoji: "🌅", hue: 28, blurb: "Where every voyage begins — the first sand your new life stands on." },
  { id: "tangerine", name: "Tangerine Cove", emoji: "🍊", hue: 24, blurb: "Groves heavy with fruit. Nami won't say why she's smiling." },
  { id: "sword", name: "Sword Rock", emoji: "⚔️", hue: 150, blurb: "A cliff shaped like a blade. Zoro calls it 'home decor.'" },
  { id: "compass", name: "Compass Cay", emoji: "🧭", hue: 210, blurb: "Every path here somehow points forward." },
  { id: "sleepy", name: "Sleepy Lagoon", emoji: "😴", hue: 250, blurb: "Water so calm it naps. Rest blocks were invented here." },
  { id: "ramen", name: "Ramen Rock", emoji: "🍜", hue: 35, blurb: "Steam rises from the caves. Naruto refuses to leave." },
  { id: "library", name: "Library Atoll", emoji: "📚", hue: 270, blurb: "Shelves carved into coral. Robin has gone very quiet." },
  { id: "blossom", name: "Blossom Bay", emoji: "🌸", hue: 330, blurb: "Petals on every wave. Sakura pretends not to be moved." },
  { id: "lantern", name: "Lantern Reef", emoji: "🏮", hue: 15, blurb: "At night the whole reef glows like a promise kept." },
  { id: "byakugan", name: "Moonveil Bluff", emoji: "🌙", hue: 240, blurb: "From here, Hinata says, you can see everything gently." },
  { id: "storm", name: "Storm's Rest", emoji: "⛈️", hue: 220, blurb: "Where storms come to retire. Respect them and pass." },
  { id: "quiet", name: "Quiet Hollow", emoji: "🌊", hue: 190, blurb: "Ten minutes here feels like a whole sabbath." },
  { id: "feast", name: "Feast Haven", emoji: "🍖", hue: 20, blurb: "Tables already set. Sanji is judging the kitchen. It passes." },
  { id: "starlight", name: "Starlight Sandbar", emoji: "✨", hue: 45, blurb: "The sand keeps yesterday's light. Walk slowly." },
  { id: "glasshouse", name: "Glasshouse Isle", emoji: "🪟", hue: 160, blurb: "A garden under glass, sky in every pane. It feels… familiar." },
  { id: "anchorage", name: "Grand Anchorage", emoji: "⚓", hue: 205, blurb: "Where great voyages pause — never end." },
];

export function islandAt(index: number): IslandDef {
  return ISLANDS[index % ISLANDS.length];
}

/** Landfall tier from the week's XP — richness of the feast + the chest. */
export function landfallTier(weekXp: number): number {
  if (weekXp >= 1100) return 4;
  if (weekXp >= 700) return 3;
  if (weekXp >= 300) return 2;
  return 1;
}

export const TIER_LINES: Record<number, string> = {
  1: "A quiet cove landing — the ship limped in, but it LANDED. Next week we feast bigger.",
  2: "A good landing! The crew unloads with songs.",
  3: "A grand landfall — flags up, village cheering from the rails!",
  4: "A LEGENDARY landing. Even the sea claps.",
};

/* ------------------------------------------------------------------ */
/* Storms — a bare house risks damage; a furnished home shrugs it off. */
/* ------------------------------------------------------------------ */

export const STORM_CHANCE_PCT = 12;
export const STORM_REPAIR_COST = 100;
export const STORM_SAFE_FURNITURE = 2;

/** Deterministic per-day storm check; returns the damaged char or null. */
export function stormTarget(
  day: string,
  state: Pick<CrewState, "village" | "storm" | "characters">
): CharId | null {
  if (state.storm) return null; // one damage at a time
  if (seededHash(day + ":storm") % 100 >= STORM_CHANCE_PCT) return null;
  const bare = ALL_CHARS.filter(
    (id) =>
      state.characters[id].recruited &&
      !state.characters[id].gone &&
      state.village[id].built &&
      state.village[id].furniture.length < STORM_SAFE_FURNITURE
  );
  if (bare.length === 0) return null;
  return bare[seededHash(day + ":stormpick") % bare.length];
}
