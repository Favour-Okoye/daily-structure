import { describe, expect, it } from "vitest";
import {
  areaMood,
  bondOf,
  buildAreaDays,
  neglectRunOf,
  normalizeCrew,
  questRequirementMet,
  STARTING_CREW,
  WALKOUT_GONE,
  type LogRow,
} from "./crew";

const SEASON = "gap" as const;

function rows(...entries: [string, string][]): LogRow[] {
  return entries.map(([day, slug]) => ({ day, anchor_slug: slug, status: "done" as const }));
}

describe("normalizeCrew", () => {
  it("boots the starting three from an empty blob", () => {
    const s = normalizeCrew({}, "2026-08-27");
    expect(Object.keys(s.characters)).toHaveLength(12);
    for (const id of STARTING_CREW) expect(s.characters[id].recruited).toBe(true);
    expect(s.characters.naruto.recruited).toBe(false);
    expect(s.startedOn).toBe("2026-08-27");
  });
  it("keeps unknown-field-tolerant defaults for old blobs", () => {
    const s = normalizeCrew({ startedOn: "2026-08-20", spentXp: 40 }, "2026-08-27");
    expect(s.startedOn).toBe("2026-08-20");
    expect(s.spentXp).toBe(40);
    expect(s.characters.zoro.level).toBe(1);
  });
});

describe("areaMood — Zoro (body/exercise)", () => {
  // Week of Mon 2026-08-17 … Fri 2026-08-21
  it("happy when the last 3 expected days were all trained", () => {
    const ad = buildAreaDays(
      rows(["2026-08-18", "exercise"], ["2026-08-19", "exercise"], ["2026-08-20", "exercise"])
    );
    expect(areaMood("body", "2026-08-21", "2026-08-17", SEASON, ad)).toBe("happy");
  });

  it("sad after three straight missed sessions", () => {
    const ad = buildAreaDays();
    expect(areaMood("body", "2026-08-21", "2026-08-17", SEASON, ad)).toBe("sad");
  });

  it("today's training live-bumps the mood one step", () => {
    const ad = buildAreaDays(rows(["2026-08-21", "exercise"]));
    // history still empty (sad), but today's session lifts it to worried
    expect(areaMood("body", "2026-08-21", "2026-08-17", SEASON, ad)).toBe("worried");
  });

  it("Sundays never count against the crew", () => {
    // trained Thu 20, Fri 21, Sat 22; Sunday 23 rests; Monday 24 checks mood
    const ad = buildAreaDays(
      rows(["2026-08-20", "exercise"], ["2026-08-21", "exercise"], ["2026-08-22", "exercise"])
    );
    expect(areaMood("body", "2026-08-24", "2026-08-17", SEASON, ad)).toBe("happy");
  });

  it("brand-new sailors start happy (honeymoon)", () => {
    const ad = buildAreaDays();
    expect(areaMood("body", "2026-08-18", "2026-08-17", SEASON, ad)).toBe("happy");
  });
});

describe("neglectRunOf — the walkout clock", () => {
  it("5 neglected weekdays trip the walkout threshold", () => {
    // started Mon 17, nothing ever done, checked Sat 22 → Fri,Thu,Wed,Tue,Mon = 5
    const run = neglectRunOf("body", "2026-08-22", "2026-08-17", SEASON, buildAreaDays());
    expect(run).toBe(5);
    expect(run >= WALKOUT_GONE).toBe(true);
  });
  it("a trained day breaks the run", () => {
    const ad = buildAreaDays(rows(["2026-08-19", "exercise"]));
    expect(neglectRunOf("body", "2026-08-22", "2026-08-17", SEASON, ad)).toBe(2);
  });
  it("Sunday never extends the run", () => {
    // started Thu 20, nothing done, checked Tue 25 → Mon 24, Sat 22, Fri 21, Thu 20 (Sun 23 skipped) = 4
    expect(neglectRunOf("body", "2026-08-25", "2026-08-20", SEASON, buildAreaDays())).toBe(4);
  });
});

describe("questRequirementMet — comeback steps", () => {
  it("step 1: one item in their area", () => {
    expect(questRequirementMet(1, "body", "2026-08-21", SEASON, new Set())).toBe(false);
    expect(questRequirementMet(1, "body", "2026-08-21", SEASON, new Set(["exercise"]))).toBe(true);
  });
  it("step 2: the area's full expectations", () => {
    expect(questRequirementMet(2, "body", "2026-08-21", SEASON, new Set(["exercise"]))).toBe(true);
    expect(questRequirementMet(2, "faith", "2026-08-21", SEASON, new Set(["devotional"]))).toBe(false);
    expect(
      questRequirementMet(
        2,
        "faith",
        "2026-08-21",
        SEASON,
        new Set(["devotional", "noon_prayer", "bible", "family_prayers", "confession"])
      )
    ).toBe(true);
  });
});

describe("bondOf", () => {
  it("grows with completions and shrinks with neglect, clamped to 0..100", () => {
    const state = normalizeCrew({ startedOn: "2026-08-17" }, "2026-08-17");
    const done = rows(
      ["2026-08-18", "exercise"],
      ["2026-08-19", "exercise"],
      ["2026-08-20", "exercise"]
    );
    const ad = buildAreaDays(done);
    // 3 days × +2, minus 1 neglected expected day (Mon 17): −3 → 3
    expect(bondOf("zoro", "2026-08-21", state, SEASON, ad, done)).toBe(3);
    // total neglect: floors at 0
    expect(bondOf("zoro", "2026-08-21", state, SEASON, buildAreaDays(), [])).toBe(0);
  });
});
