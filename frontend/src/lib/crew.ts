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
  /** Today's character request, if one came. */
  request: CharRequest | null;
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
    request: r.request ?? null,
    log: (r.log ?? []).slice(0, 60),
  };
}

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

export const SKILL_DECK: SkillCard[] = [
  { id: "speak_aloud", title: "Record yourself talking 5 min about today's reading", emoji: "🎙️" },
  { id: "sql_drill", title: "Solve 2 SQL practice exercises", emoji: "🗄️" },
  { id: "ai_new", title: "Try one new AI thing you've never tried", emoji: "🤖" },
  { id: "sell_pitch", title: "Write a 5-line pitch selling anything to anyone", emoji: "🛍️" },
  { id: "powerbi_drill", title: "Recreate one chart in Power BI or Excel", emoji: "📊" },
  { id: "yt_skill", title: "Watch one skill video (speaking, selling, data)", emoji: "🎬" },
  { id: "dataviz_read", title: "Read one article on data storytelling", emoji: "📈" },
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

/** ~55% of days one recruited character asks for something. Deterministic per day. */
export function requestForDay(day: string, recruited: CharId[]): CharRequest | null {
  if (recruited.length === 0) return null;
  const h = seededHash(day);
  if (h % 100 >= 55) return null;
  const charId = recruited[h % recruited.length];
  const plan = REQUEST_TEXT[charId];
  if (!plan) return null;
  return { day, charId, kind: plan.kind, targetSlug: plan.targetSlug, text: plan.text, done: false };
}
