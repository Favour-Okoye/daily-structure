import { weekdayOf } from "./day";

export type Season = "gap" | "work";
export type AreaId =
  | "faith"
  | "body"
  | "mind"
  | "calm"
  | "plan"
  | "skills"
  | "provision"
  | "overall";

export interface AnchorDef {
  slug: string;
  title: string;
  emoji: string;
  xp: number;
  area: AreaId;
  kind: "check" | "quiet" | "ceremony";
  /** Fixed wall-clock slot, when the anchor has one (minutes from midnight). */
  startMin?: number;
  endMin?: number;
  /** Suggested time for flexible anchors (the Phase-3 planner refines this). */
  suggestMin?: number;
  minutes: number;
  /** Which days require it (0=Sun). Sundays are rest: only the confession. */
  requiredOn: (weekday: number, season: Season) => boolean;
  hint?: string;
}

const notSunday = (wd: number) => wd !== 0;

export const ANCHORS: AnchorDef[] = [
  {
    slug: "devotional",
    title: "Devotional",
    emoji: "📖",
    xp: 15,
    area: "faith",
    kind: "check",
    startMin: 7 * 60,
    endMin: 8 * 60,
    minutes: 60,
    requiredOn: notSunday,
  },
  {
    slug: "exercise",
    title: "Exercise with sister",
    emoji: "💪",
    xp: 15,
    area: "body",
    kind: "check",
    startMin: 8 * 60 + 30,
    endMin: 9 * 60,
    minutes: 30,
    requiredOn: notSunday,
    hint: "Zoro will own this one soon. Train like he's watching.",
  },
  {
    slug: "noon_prayer",
    title: "Noon prayer",
    emoji: "🙏",
    xp: 10,
    area: "faith",
    kind: "check",
    startMin: 12 * 60,
    endMin: 13 * 60,
    minutes: 60,
    requiredOn: notSunday,
  },
  {
    slug: "bible",
    title: "Bible — 1 chapter",
    emoji: "📜",
    xp: 20,
    area: "faith",
    kind: "check",
    suggestMin: 9 * 60 + 15,
    minutes: 25,
    requiredOn: notSunday,
  },
  {
    slug: "book",
    title: "“9-5 Is Not a Scam” — 2 chapters",
    emoji: "📗",
    xp: 20,
    area: "mind",
    kind: "check",
    suggestMin: 10 * 60,
    minutes: 40,
    requiredOn: (wd, season) => wd !== 0 && season === "gap",
  },
  {
    slug: "money_tree",
    title: "Money Tree — 3 videos",
    emoji: "🌳",
    xp: 15,
    area: "mind",
    kind: "check",
    suggestMin: 21 * 60 + 15,
    minutes: 45,
    requiredOn: notSunday,
    hint: "Auto-detect arrives in a later phase — until then, check it honestly.",
  },
  {
    slug: "quiet_time",
    title: "Quiet time",
    emoji: "🌊",
    xp: 15,
    area: "calm",
    kind: "quiet",
    suggestMin: 15 * 60 + 30,
    minutes: 15,
    requiredOn: notSunday,
    hint: "10–15 min. Phone face-down. Just you, your thoughts, and the Holy Spirit.",
  },
  {
    slug: "family_prayers",
    title: "Family prayers",
    emoji: "🕯️",
    xp: 10,
    area: "faith",
    kind: "check",
    startMin: 0,
    endMin: 2 * 60,
    minutes: 120,
    requiredOn: notSunday,
  },
  {
    slug: "confession",
    title: "Confession",
    emoji: "✨",
    xp: 25,
    area: "faith",
    kind: "ceremony",
    suggestMin: 2 * 60,
    minutes: 10,
    requiredOn: () => true,
    hint: "Every single day — even Sundays. The full ceremony arrives with the crew.",
  },
];

export interface ChurchEvent {
  slug: string;
  title: string;
  emoji: string;
  weekday: number;
  startMin: number;
  endMin: number;
  xp: number;
  hosting?: boolean;
}

export const CHURCH_WEEK: ChurchEvent[] = [
  { slug: "sun_service", title: "Church service", emoji: "⛪", weekday: 0, startMin: 9 * 60, endMin: 15 * 60, xp: 25 },
  { slug: "mon_program", title: "“Just Before You Go to Bed” — hosting", emoji: "🎙️", weekday: 1, startMin: 21 * 60, endMin: 22 * 60, xp: 20, hosting: true },
  { slug: "tue_bible", title: "Bible study", emoji: "📖", weekday: 2, startMin: 20 * 60, endMin: 21 * 60, xp: 20 },
  { slug: "wed_youth", title: "Youth bible study", emoji: "🔥", weekday: 3, startMin: 19 * 60 + 30, endMin: 20 * 60 + 30, xp: 20 },
  { slug: "thu_evangelism", title: "Evangelism meeting", emoji: "📣", weekday: 4, startMin: 19 * 60, endMin: 20 * 60, xp: 20 },
  { slug: "fri_prayers", title: "Prayers (in church)", emoji: "🙌", weekday: 5, startMin: 19 * 60, endMin: 21 * 60, xp: 20 },
];

export const REST_BLOCK = { startMin: 16 * 60, endMin: 19 * 60, title: "Rest", emoji: "😴" };

export type AnchorForDay = AnchorDef & { required: boolean };

/** Work-season retuning: shorter mornings, evening exercise, lighter learning.
 *  History is untouched — only expectations and times change. */
const WORK_OVERRIDES: Record<string, Partial<AnchorDef>> = {
  devotional: { startMin: 7 * 60, endMin: 7 * 60 + 30, minutes: 30 },
  exercise: { startMin: 18 * 60 + 45, endMin: 19 * 60 + 15, hint: "Evening session — Zoro still counts reps." },
  noon_prayer: { startMin: 12 * 60 + 30, endMin: 13 * 60, minutes: 30, hint: "Lunch-break prayer." },
  money_tree: { title: "Money Tree — 1 video", xp: 10, minutes: 20, hint: "One video keeps the tree alive on work days." },
  quiet_time: { suggestMin: 20 * 60, hint: "10 min after work. Phone face-down." },
  bible: { suggestMin: 21 * 60 + 30 },
};

export function anchorsForDay(day: string, season: Season): AnchorForDay[] {
  const wd = weekdayOf(day);
  return ANCHORS.map((a) => {
    const base = season === "work" ? { ...a, ...(WORK_OVERRIDES[a.slug] ?? {}) } : a;
    return { ...base, required: a.requiredOn(wd, season) };
  });
}

export function churchForDay(day: string): ChurchEvent[] {
  const wd = weekdayOf(day);
  return CHURCH_WEEK.filter((e) => e.weekday === wd);
}

/** Slugs that must all be logged for the day-complete bonus. */
export function requiredSlugs(day: string, season: Season): string[] {
  return anchorsForDay(day, season)
    .filter((a) => a.required)
    .map((a) => a.slug);
}
