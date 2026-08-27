/**
 * The day planner — pure, deterministic, greedy. Same inputs → same plan.
 * Lays fixed anchors, church, events and the protected rest block first,
 * then flexible anchors, then tasks by urgency, then a skill block on light days.
 */
import { shiftDay, weekdayOf } from "./day";
import {
  anchorsForDay,
  churchForDay,
  REST_BLOCK,
  type Season,
} from "./anchors";

export interface PlanTask {
  id: string;
  title: string;
  kind: string;
  due_on: string | null;
  est_minutes: number;
}

export interface PlanEvent {
  id: string;
  title: string;
  day: string;
  start_min: number;
  end_min: number;
}

export interface PlanSlot {
  kind: "anchor" | "church" | "event" | "task" | "skill" | "rest";
  refId: string;
  title: string;
  emoji: string;
  startMin: number;
  endMin: number;
  locked: boolean;
}

export interface DayPlan {
  version: 1;
  day: string;
  season: Season;
  slots: PlanSlot[];
  unplaced: { taskId: string; title: string; reason: string }[];
}

export type Urgency = "overdue" | "today" | "urgent" | "soon" | "calm";

export function urgencyOf(dueOn: string | null, day: string): Urgency {
  if (!dueOn) return "calm";
  if (dueOn < day) return "overdue";
  if (dueOn === day) return "today";
  const gap = daysBetween(day, dueOn);
  if (gap <= 2) return "urgent";
  if (gap <= 5) return "soon";
  return "calm";
}

function daysBetween(a: string, b: string): number {
  let d = a;
  let n = 0;
  while (d < b && n < 3650) {
    d = shiftDay(d, 1);
    n++;
  }
  return n;
}

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  today: 1,
  urgent: 2,
  soon: 3,
  calm: 4,
};

/* Free-interval bookkeeping ---------------------------------------- */

interface Gap {
  start: number;
  end: number;
}

function subtract(gaps: Gap[], start: number, end: number): Gap[] {
  const out: Gap[] = [];
  for (const g of gaps) {
    if (end <= g.start || start >= g.end) {
      out.push(g);
      continue;
    }
    if (start > g.start) out.push({ start: g.start, end: Math.min(start, g.end) });
    if (end < g.end) out.push({ start: Math.max(end, g.start), end: g.end });
  }
  return out.filter((g) => g.end - g.start >= 10);
}

/** Take `dur` minutes from the first gap that fits, preferring starts ≥ prefer. */
function allocate(gaps: Gap[], dur: number, prefer = 0): { start: number; gaps: Gap[] } | null {
  const usable = (g: Gap) => g.end - Math.max(g.start, prefer) >= dur;
  let target = gaps.find(usable);
  let from: number;
  if (target) {
    from = Math.max(target.start, prefer);
  } else {
    target = gaps.find((g) => g.end - g.start >= dur);
    if (!target) return null;
    from = target.start;
  }
  return { start: from, gaps: subtract(gaps, from, from + dur) };
}

/* The planner ------------------------------------------------------- */

export function buildPlan(
  day: string,
  season: Season,
  tasks: PlanTask[],
  events: PlanEvent[],
  opts: { fridayOnline?: boolean } = {}
): DayPlan {
  const wd = weekdayOf(day);
  const slots: PlanSlot[] = [];
  const unplaced: DayPlan["unplaced"] = [];
  const anchors = anchorsForDay(day, season);

  // ---- Sunday: church, rest, confession. Nothing else is scheduled. ----
  if (wd === 0) {
    for (const e of churchForDay(day)) {
      slots.push({
        kind: "church", refId: e.slug, title: e.title, emoji: e.emoji,
        startMin: e.startMin, endMin: e.endMin, locked: true,
      });
    }
    slots.push({
      kind: "rest", refId: "rest", title: "Rest — it's Sunday", emoji: REST_BLOCK.emoji,
      startMin: REST_BLOCK.startMin, endMin: REST_BLOCK.endMin, locked: true,
    });
    const confession = anchors.find((a) => a.slug === "confession")!;
    slots.push({
      kind: "anchor", refId: "confession", title: confession.title, emoji: confession.emoji,
      startMin: confession.suggestMin ?? 120, endMin: (confession.suggestMin ?? 120) + 10, locked: false,
    });
    for (const t of tasks) {
      unplaced.push({ taskId: t.id, title: t.title, reason: "Sunday is rest — it sails on Monday" });
    }
    return { version: 1, day, season, slots, unplaced };
  }

  // ---- Locked layer ----
  let gaps: Gap[] = [{ start: 8 * 60, end: 23 * 60 + 45 }]; // the plannable day

  const lock = (kind: PlanSlot["kind"], refId: string, title: string, emoji: string, s: number, e: number) => {
    slots.push({ kind, refId, title, emoji, startMin: s, endMin: e, locked: true });
    gaps = subtract(gaps, s, e);
  };

  for (const a of anchors) {
    if (a.required && a.startMin !== undefined && a.endMin !== undefined) {
      // family prayers (00:00-02:00) sits outside the plannable window; still a slot
      slots.push({
        kind: "anchor", refId: a.slug, title: a.title, emoji: a.emoji,
        startMin: a.startMin, endMin: a.endMin, locked: true,
      });
      gaps = subtract(gaps, a.startMin, a.endMin);
    }
  }

  for (const e of churchForDay(day)) {
    if (e.slug === "fri_prayers") {
      if (opts.fridayOnline) {
        lock("church", e.slug, "Prayers (online)", e.emoji, 20 * 60, 21 * 60);
      } else {
        // in church 19:00-21:00, home around 22:00 — the whole stretch is spoken for
        lock("church", e.slug, e.title, e.emoji, e.startMin, e.endMin);
        gaps = subtract(gaps, e.endMin, 22 * 60); // travel home
      }
    } else {
      lock("church", e.slug, e.title, e.emoji, e.startMin, e.endMin);
    }
  }

  for (const ev of events) {
    lock("event", ev.id, ev.title, "📌", ev.start_min, ev.end_min);
  }

  lock("rest", "rest", "Rest — protected", REST_BLOCK.emoji, REST_BLOCK.startMin, REST_BLOCK.endMin);

  // ---- Flexible anchors, earliest-fit near their preferred time ----
  for (const a of anchors) {
    if (!a.required || a.startMin !== undefined || a.kind === "ceremony") continue;
    const got = allocate(gaps, a.minutes, a.suggestMin ?? 9 * 60);
    if (!got) continue; // still checkable from the anchor list
    gaps = got.gaps;
    slots.push({
      kind: "anchor", refId: a.slug, title: a.title, emoji: a.emoji,
      startMin: got.start, endMin: got.start + a.minutes, locked: false,
    });
  }

  // ---- Tasks by urgency ----
  const sorted = [...tasks].sort((x, y) => {
    const r = URGENCY_RANK[urgencyOf(x.due_on, day)] - URGENCY_RANK[urgencyOf(y.due_on, day)];
    if (r !== 0) return r;
    if (y.est_minutes !== x.est_minutes) return y.est_minutes - x.est_minutes;
    return x.id.localeCompare(y.id);
  });

  let placedTaskMinutes = 0;
  for (const t of sorted) {
    const chunks: number[] = [];
    let remaining = Math.max(15, t.est_minutes);
    if (remaining > 90) {
      while (remaining > 0) {
        chunks.push(Math.min(75, remaining));
        remaining -= Math.min(75, remaining);
      }
    } else {
      chunks.push(remaining);
    }
    let placedAll = true;
    chunks.forEach((dur, i) => {
      const got = allocate(gaps, dur, 9 * 60);
      if (!got) {
        placedAll = false;
        return;
      }
      gaps = got.gaps;
      placedTaskMinutes += dur;
      slots.push({
        kind: "task",
        refId: chunks.length > 1 ? `${t.id}#${i + 1}` : t.id,
        title: chunks.length > 1 ? `${t.title} (part ${i + 1})` : t.title,
        emoji: "📌",
        startMin: got.start,
        endMin: got.start + dur,
        locked: false,
      });
    });
    if (!placedAll) {
      unplaced.push({
        taskId: t.id,
        title: t.title,
        reason: "No room left before 23:45 — move something or split it",
      });
    }
  }

  // ---- Skill block on light days ----
  const flexiblePlaced = anchors
    .filter((a) => a.required && a.startMin === undefined && a.kind !== "ceremony")
    .every((a) => slots.some((s) => s.refId === a.slug));
  if (placedTaskMinutes < 60 && flexiblePlaced) {
    const got = allocate(gaps, 15, 9 * 60 + 30);
    if (got) {
      gaps = got.gaps;
      slots.push({
        kind: "skill", refId: "skill", title: "Skill block — learn one thing", emoji: "🎯",
        startMin: got.start, endMin: got.start + 15, locked: false,
      });
    }
  }

  return { version: 1, day, season, slots, unplaced };
}
