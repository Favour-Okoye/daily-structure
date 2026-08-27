/**
 * App-day: the Brussels calendar day, except the day flips at 04:00, not midnight.
 * Family prayers run 00:00-02:00 and the confession lands ~02:00 — all of that
 * belongs to the *previous* day.
 *
 * RULE: no other file in this app may do calendar/day math. Everything imports
 * from here. (If you're writing `new Intl.DateTimeFormat` or `.toISOString().slice`
 * anywhere else, stop.)
 */

const TZ = "Europe/Brussels";
const FLIP_MS = 4 * 3600_000;

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** Current instant — honors dev time-travel via localStorage "ds:fakeNow". */
export function appNow(): Date {
  if (import.meta.env?.DEV && typeof localStorage !== "undefined") {
    try {
      const fake = localStorage.getItem("ds:fakeNow");
      if (fake) {
        const t = Date.parse(fake);
        if (!Number.isNaN(t)) return new Date(t);
      }
    } catch {
      /* storage unavailable */
    }
  }
  return new Date();
}

/** The app-day (YYYY-MM-DD) an instant belongs to. */
export function appDay(now: Date = appNow()): string {
  return fmtDay(new Date(now.getTime() - FLIP_MS));
}

/** YYYY-MM-DD + delta days. Pure string math — no timezones involved. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0=Sunday … 6=Saturday for an app-day string. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** ISO week key like "2026-W35" — grace tokens reset when this changes. */
export function isoWeekKey(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const target = new Date(d);
  target.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // Thursday of d's week
  const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Brussels midnight of a calendar day, as a UTC instant (offset probe: CEST/CET). */
function brusselsMidnightMs(day: string): number {
  for (const off of ["+02:00", "+01:00"]) {
    const t = Date.parse(`${day}T00:00:00${off}`);
    const probe = new Date(t);
    if (fmtDay(probe) !== day) continue;
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(probe);
    if (hour === "00") return t;
  }
  return Date.parse(`${day}T00:00:00+01:00`);
}

/**
 * UTC window [startIso, endIso) during which appDay() === day.
 * Used for the Money Tree auto-detect query — query created_at against this
 * window, NEVER MoneyTree's happened_on (it uses midnight-based days).
 * DST-exact: a fall-back day is 25h long, a spring-forward day 23h.
 */
export function appDayWindowUtc(day: string): { startIso: string; endIso: string } {
  return {
    startIso: new Date(brusselsMidnightMs(day) + FLIP_MS).toISOString(),
    endIso: new Date(brusselsMidnightMs(shiftDay(day, 1)) + FLIP_MS).toISOString(),
  };
}

/** Brussels wall-clock minutes since midnight (drives the timeline's now marker). */
export function wallMinutes(now: Date = appNow()): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/** Monday of the ISO week containing `day`. */
export function mondayOf(day: string): string {
  const w = weekdayOf(day); // 0=Sun..6=Sat
  return shiftDay(day, -((w + 6) % 7));
}

/** Monday of an ISO week key like "2026-W35". */
export function mondayOfWeekKey(weekKey: string): string {
  const [y, w] = weekKey.split("-W");
  return shiftDay(mondayOf(`${y}-01-04`), (Number(w) - 1) * 7);
}

/** Sort key placing the 00:00-04:00 block at the END of the app-day timeline. */
export function daySortKey(startMin: number): number {
  return (startMin + 1440 - 240) % 1440;
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
