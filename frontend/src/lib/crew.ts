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
  level: number;
  gone: boolean;
  goneSince: string | null;
  prevBond: number;
}

export interface CrewState {
  version: 1;
  startedOn: string;
  spentXp: number;
  characters: Record<CharId, CharState>;
  log: { day: string; text: string }[];
}

function defaultChar(id: CharId, startedOn: string): CharState {
  const starter = STARTING_CREW.includes(id);
  return {
    recruited: starter,
    recruitedOn: starter ? startedOn : null,
    bondBonus: 0,
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
    log: (r.log ?? []).slice(0, 60),
  };
}

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

interface AreaDay {
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
export function areaMood(
  area: AreaId,
  today: string,
  startedOn: string,
  season: Season,
  areaDays: Map<string, AreaDay>
): Mood {
  const days = recentExpectedDays(area, today, startedOn, season, areaDays);
  const doneToday = areaDoneOn(area, today, areaDays);
  if (days.length < 2) return "happy"; // honeymoon — the game just started
  const done = days.filter((d) => areaDoneOn(area, d, areaDays)).length;
  const ratio = done / days.length;
  let mood: Mood;
  if (ratio >= 2 / 3) mood = "happy";
  else if (ratio >= 1 / 3) mood = "neutral";
  else if (ratio > 0) mood = "worried";
  else mood = "sad";
  if (doneToday) mood = bumpMood(mood);
  return mood;
}

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
  let bond = 0;
  // completions: count per day, capped
  const perDay = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "done") continue;
    const areas = areasOfSlug(row.anchor_slug);
    const relevant = area === "overall" ? areas.length > 0 : areas.includes(area);
    if (relevant) perDay.set(row.day, (perDay.get(row.day) ?? 0) + 1);
  }
  for (const count of perDay.values()) bond += Math.min(6, count * 2);
  // neglect: expected days (excluding today) with nothing done
  let cursor = state.startedOn;
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
  usopp: {}, sanji: {}, chopper: {}, robin: {}, naruto: {}, sasuke: {}, sakura: {}, kakashi: {}, hinata: {},
};

export const MOOD_EMOJI: Record<Mood, string> = {
  happy: "😄",
  neutral: "🙂",
  worried: "😟",
  sad: "😢",
  packing: "🎒",
  gone: "💨",
};
