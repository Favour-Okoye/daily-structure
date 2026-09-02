import { describe, expect, it } from "vitest";
import {
  areaMood,
  bondOf,
  buildAreaDays,
  dilemmaForDay,
  landfallTier,
  neglectRunOf,
  normalizeCrew,
  questRequirementMet,
  requestForDay,
  sceneForDay,
  STARTING_CREW,
  stormTarget,
  WALKOUT_GONE,
  type LogRow,
  type YesterdayFacts,
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

function facts(over: Partial<YesterdayFacts> = {}): YesterdayFacts {
  return {
    day: "2026-08-27",
    perfect: false,
    doneSlugs: new Set(),
    missedRequired: [],
    tasksDone: 0,
    graceUsed: false,
    streak: 2,
    overdueNow: 0,
    isSundayToday: false,
    ...over,
  };
}

describe("the morning deck scene", () => {
  it("is deterministic for a given day", () => {
    const y = facts({ missedRequired: ["exercise"] });
    const a = sceneForDay("2026-08-28", ["luffy", "zoro", "nami"], y);
    const b = sceneForDay("2026-08-28", ["luffy", "zoro", "nami"], y);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
  it("never casts characters who aren't aboard", () => {
    const lines = sceneForDay("2026-08-28", ["luffy"], facts({ perfect: true }));
    for (const l of lines) expect(l.charId).toBe("luffy");
  });
});

describe("requests and dilemmas share the calendar politely", () => {
  it("no day gets both", () => {
    for (let i = 0; i < 30; i++) {
      const day = `2026-09-${String(i + 1).padStart(2, "0")}`;
      const req = requestForDay(day, ["luffy", "zoro", "nami"]);
      const dil = dilemmaForDay(day, ["luffy", "zoro", "nami"]);
      expect(req && dil).toBeFalsy();
    }
  });
});

describe("landfall tiers", () => {
  it("scale with the week's XP", () => {
    expect(landfallTier(120)).toBe(1);
    expect(landfallTier(450)).toBe(2);
    expect(landfallTier(800)).toBe(3);
    expect(landfallTier(1500)).toBe(4);
  });
});

describe("storms", () => {
  it("only ever hit built-but-bare homes", () => {
    const state = normalizeCrew({}, "2026-08-27");
    // nothing built → never a target, any day
    for (let i = 1; i <= 28; i++) {
      expect(stormTarget(`2026-09-${String(i).padStart(2, "0")}`, state)).toBeNull();
    }
    state.village.zoro.built = true; // bare walls
    state.village.nami.built = true;
    state.village.nami.furniture = ["lamp", "rug"]; // furnished = safe
    let hitZoro = 0;
    let hitNami = 0;
    for (let i = 1; i <= 28; i++) {
      const t = stormTarget(`2026-09-${String(i).padStart(2, "0")}`, state);
      if (t === "zoro") hitZoro++;
      if (t === "nami") hitNami++;
    }
    expect(hitNami).toBe(0);
    expect(hitZoro).toBeGreaterThan(0); // ~12% of 28 days
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
