import { describe, expect, it } from "vitest";
import { buildPlan, urgencyOf, type PlanTask } from "./planner";
import { REST_BLOCK } from "./anchors";

const SEASON = "gap" as const;

function task(id: string, over: Partial<PlanTask> = {}): PlanTask {
  return { id, title: id, kind: "general", due_on: null, est_minutes: 30, ...over };
}

// 2026-08-27 Thu · 28 Fri · 30 Sun · 31 Mon
describe("buildPlan", () => {
  it("never schedules over the rest block, even under task pressure", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task(`t${i}`, { est_minutes: 60 }));
    const plan = buildPlan("2026-08-27", SEASON, tasks, []);
    for (const s of plan.slots) {
      if (s.kind === "rest") continue;
      const overlaps = s.startMin < REST_BLOCK.endMin && s.endMin > REST_BLOCK.startMin;
      expect(overlaps, `${s.title} overlaps rest`).toBe(false);
    }
  });

  it("Thursday carries the evangelism meeting as a locked slot", () => {
    const plan = buildPlan("2026-08-27", SEASON, [], []);
    const ev = plan.slots.find((s) => s.refId === "thu_evangelism");
    expect(ev?.locked).toBe(true);
    expect(ev?.startMin).toBe(19 * 60);
  });

  it("Friday in-church mode blocks 19:00-22:00 for tasks", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task(`t${i}`, { est_minutes: 60 }));
    const plan = buildPlan("2026-08-28", SEASON, tasks, []);
    for (const s of plan.slots) {
      if (s.kind !== "task") continue;
      const overlaps = s.startMin < 22 * 60 && s.endMin > 19 * 60;
      expect(overlaps, `${s.title} scheduled during Friday prayers/travel`).toBe(false);
    }
  });

  it("Friday online mode only blocks 20:00-21:00", () => {
    const plan = buildPlan("2026-08-28", SEASON, [], [], { fridayOnline: true });
    const ev = plan.slots.find((s) => s.kind === "church");
    expect(ev?.startMin).toBe(20 * 60);
    expect(ev?.endMin).toBe(21 * 60);
  });

  it("Sunday rests: tasks are pushed to Monday, only church/rest/confession remain", () => {
    const plan = buildPlan("2026-08-30", SEASON, [task("a"), task("b")], []);
    expect(plan.unplaced).toHaveLength(2);
    expect(plan.unplaced[0].reason).toContain("Sunday");
    expect(plan.slots.every((s) => ["church", "rest", "anchor"].includes(s.kind))).toBe(true);
  });

  it("overdue tasks get the earliest gaps", () => {
    const plan = buildPlan(
      "2026-08-31",
      SEASON,
      [task("calm", { due_on: null }), task("late", { due_on: "2026-08-29" })],
      []
    );
    const lateSlot = plan.slots.find((s) => s.refId === "late");
    const calmSlot = plan.slots.find((s) => s.refId === "calm");
    expect(lateSlot && calmSlot && lateSlot.startMin < calmSlot.startMin).toBe(true);
  });

  it("chunks big tasks into ≤75-minute parts", () => {
    const plan = buildPlan("2026-08-31", SEASON, [task("big", { est_minutes: 150 })], []);
    const parts = plan.slots.filter((s) => s.refId.startsWith("big#"));
    expect(parts.length).toBe(2);
    for (const p of parts) expect(p.endMin - p.startMin).toBeLessThanOrEqual(75);
  });

  it("one-off events are locked and respected", () => {
    const plan = buildPlan(
      "2026-08-29", // Saturday
      SEASON,
      [task("t1", { est_minutes: 120 })],
      [{ id: "clean", title: "Sanctuary cleaning", day: "2026-08-29", start_min: 9 * 60, end_min: 11 * 60 }]
    );
    const ev = plan.slots.find((s) => s.refId === "clean");
    expect(ev?.locked).toBe(true);
    for (const s of plan.slots) {
      if (s.kind === "task") {
        const overlaps = s.startMin < 11 * 60 && s.endMin > 9 * 60;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("light days earn a skill block; heavy days don't", () => {
    const light = buildPlan("2026-08-31", SEASON, [], []);
    expect(light.slots.some((s) => s.kind === "skill")).toBe(true);
    const heavy = buildPlan(
      "2026-08-31",
      SEASON,
      Array.from({ length: 4 }, (_, i) => task(`t${i}`, { est_minutes: 60 })),
      []
    );
    expect(heavy.slots.some((s) => s.kind === "skill")).toBe(false);
  });
});

describe("work season", () => {
  it("weekdays trade the rest block for the office and shift exercise to evening", () => {
    const plan = buildPlan("2026-09-07", "work", [], []); // a Monday
    expect(plan.slots.find((s) => s.refId === "workday")?.locked).toBe(true);
    expect(plan.slots.some((s) => s.kind === "rest")).toBe(false);
    const exercise = plan.slots.find((s) => s.refId === "exercise");
    expect(exercise?.startMin).toBe(18 * 60 + 45);
    expect(plan.slots.some((s) => s.kind === "skill")).toBe(false); // weekdays: no skill block
  });
  it("Saturday keeps rest and allows the skill block", () => {
    const plan = buildPlan("2026-09-05", "work", [], []); // a Saturday
    expect(plan.slots.some((s) => s.kind === "rest")).toBe(true);
    expect(plan.slots.some((s) => s.kind === "skill")).toBe(true);
  });
  it("gap season still protects the rest block", () => {
    const plan = buildPlan("2026-09-07", "gap", [], []);
    expect(plan.slots.some((s) => s.kind === "rest")).toBe(true);
    expect(plan.slots.some((s) => s.refId === "workday")).toBe(false);
  });
});

describe("urgencyOf", () => {
  it("ramps calm → soon → urgent → today → overdue", () => {
    const day = "2026-08-27";
    expect(urgencyOf(null, day)).toBe("calm");
    expect(urgencyOf("2026-09-10", day)).toBe("calm");
    expect(urgencyOf("2026-09-01", day)).toBe("soon");
    expect(urgencyOf("2026-08-29", day)).toBe("urgent");
    expect(urgencyOf("2026-08-27", day)).toBe("today");
    expect(urgencyOf("2026-08-26", day)).toBe("overdue");
  });
});
