import { describe, expect, it } from "vitest";
import {
  appDay,
  appDayWindowUtc,
  daySortKey,
  isoWeekKey,
  shiftDay,
  weekdayOf,
} from "./day";

describe("appDay — the 04:00 Brussels boundary", () => {
  // August = CEST (+02:00). 03:59 wall = 01:59Z, 04:00 wall = 02:00Z.
  it("03:59 still belongs to yesterday", () => {
    expect(appDay(new Date("2026-08-28T01:59:00Z"))).toBe("2026-08-27");
  });
  it("04:00 flips to today", () => {
    expect(appDay(new Date("2026-08-28T02:00:00Z"))).toBe("2026-08-28");
  });
  it("04:01 is today", () => {
    expect(appDay(new Date("2026-08-28T02:01:00Z"))).toBe("2026-08-28");
  });
  it("a 02:00 confession lands on the previous day", () => {
    // 2026-08-28 02:00 wall (CEST) = 00:00Z
    expect(appDay(new Date("2026-08-28T00:00:00Z"))).toBe("2026-08-27");
  });

  it("fall-back day 2026-10-25 (25h): boundary instant is midnight+4h", () => {
    // Brussels midnight Oct 25 = 22:00Z Oct 24 (CEST). +4h = 02:00Z.
    expect(appDay(new Date("2026-10-25T01:59:59Z"))).toBe("2026-10-24");
    expect(appDay(new Date("2026-10-25T02:00:00Z"))).toBe("2026-10-25");
  });

  it("spring-forward day 2027-03-28 (23h): boundary instant is midnight+4h", () => {
    // Brussels midnight Mar 28 = 23:00Z Mar 27 (CET). +4h = 03:00Z.
    expect(appDay(new Date("2027-03-28T02:59:59Z"))).toBe("2027-03-27");
    expect(appDay(new Date("2027-03-28T03:00:00Z"))).toBe("2027-03-28");
  });
});

describe("appDayWindowUtc", () => {
  it("a normal day is exactly 24h", () => {
    const { startIso, endIso } = appDayWindowUtc("2026-08-27");
    expect(Date.parse(endIso) - Date.parse(startIso)).toBe(24 * 3600_000);
  });
  it("the fall-back day is 25h", () => {
    const { startIso, endIso } = appDayWindowUtc("2026-10-25");
    expect(Date.parse(endIso) - Date.parse(startIso)).toBe(25 * 3600_000);
  });
  it("the spring-forward day is 23h", () => {
    const { startIso, endIso } = appDayWindowUtc("2027-03-28");
    expect(Date.parse(endIso) - Date.parse(startIso)).toBe(23 * 3600_000);
  });
  it("windows tile: end of one day is start of the next", () => {
    expect(appDayWindowUtc("2026-08-27").endIso).toBe(appDayWindowUtc("2026-08-28").startIso);
  });
  it("every instant in the window maps back to the same app-day", () => {
    const { startIso, endIso } = appDayWindowUtc("2026-10-25");
    expect(appDay(new Date(startIso))).toBe("2026-10-25");
    expect(appDay(new Date(Date.parse(endIso) - 1000))).toBe("2026-10-25");
    expect(appDay(new Date(Date.parse(endIso)))).toBe("2026-10-26");
  });
});

describe("shiftDay / weekdayOf / isoWeekKey", () => {
  it("shifts across month and year ends", () => {
    expect(shiftDay("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("knows Sunday", () => {
    expect(weekdayOf("2026-08-30")).toBe(0); // Sunday
    expect(weekdayOf("2026-08-27")).toBe(4); // Thursday
  });
  it("iso week is stable Monday..Sunday and rolls on Monday", () => {
    expect(isoWeekKey("2026-08-24")).toBe(isoWeekKey("2026-08-30"));
    expect(isoWeekKey("2026-08-30")).not.toBe(isoWeekKey("2026-08-31"));
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
  });
});

describe("daySortKey — timeline order", () => {
  it("puts family prayers (00:00) and confession (02:00) after the evening", () => {
    const order = [420, 1230, 0, 120].map(daySortKey); // 07:00, 20:30, 00:00, 02:00
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });
});
