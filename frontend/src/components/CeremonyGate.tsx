import { useEffect, useMemo, useState } from "react";
import { appDay, daySortKey, fmtMin, shiftDay } from "../lib/day";
import { type Season } from "../lib/anchors";
import { buildPlan, type DayPlan } from "../lib/planner";
import { useSettings } from "../lib/queries";
import { useApprovePlan, useCrew } from "../lib/crewQueries";
import { useEvents, useOpenTasks } from "../lib/tasksQueries";
import { useXpDays } from "../lib/stats";
import { Chibi } from "./chibi/Chibi";

const SEASON: Season = "gap";

type Stage = "confession" | "summary" | "tomorrow";

/**
 * The nightly closing ceremony (~02:00, after family prayers):
 * 1. The confession, line by line — spoken, then tapped.
 * 2. The day's summary.
 * 3. Nami presents tomorrow's plan; approving it seals the day.
 */
export function CeremonyGate({
  requiredDone,
  requiredTotal,
  streak,
  onSealed,
  onClose,
}: {
  requiredDone: number;
  requiredTotal: number;
  streak: number;
  onSealed: () => void;
  onClose: () => void;
}) {
  const day = appDay();
  const tomorrow = shiftDay(day, 1);
  const settingsQ = useSettings();
  const xpDaysQ = useXpDays();
  const { aboard } = useCrew();
  const approve = useApprovePlan();

  const lines = useMemo(() => {
    const fromDb = (settingsQ.data?.confession_lines ?? []).filter(
      (l) => l.trim() && !l.startsWith("Open More")
    );
    return fromDb.length
      ? fromDb
      : ["(Your confession isn't saved yet — add it in More → Confession. Say tonight's from the heart.)"];
  }, [settingsQ.data]);

  const [stage, setStage] = useState<Stage>("confession");
  const [lineIdx, setLineIdx] = useState(0);

  const xpToday = (xpDaysQ.data ?? []).find((d) => d.happened_on === day)?.points ?? 0;

  const tasksQ = useOpenTasks();
  const eventsQ = useEvents();
  const fridayOnline = !!(settingsQ.data?.data as { fridayOnline?: boolean } | undefined)?.fridayOnline;

  const built = useMemo(() => {
    const tasks = (tasksQ.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      kind: t.kind,
      due_on: t.due_on,
      est_minutes: t.est_minutes,
    }));
    const events = (eventsQ.data ?? [])
      .filter((e) => e.day === tomorrow)
      .map((e) => ({ id: e.id, title: e.title, day: e.day, start_min: e.start_min, end_min: e.end_min }));
    return buildPlan(tomorrow, SEASON, tasks, events, { fridayOnline });
  }, [tomorrow, tasksQ.data, eventsQ.data, fridayOnline]);

  // Local adjustable copy — Nami proposes, Favour disposes.
  const [plan, setPlan] = useState<DayPlan | null>(null);
  useEffect(() => {
    if (stage === "tomorrow" && plan === null) setPlan(built);
  }, [stage, built, plan]);

  const shiftSlot = (refId: string, delta: number) => {
    setPlan((p) =>
      p
        ? {
            ...p,
            slots: p.slots.map((s) =>
              s.refId === refId && !s.locked
                ? {
                    ...s,
                    startMin: Math.max(0, Math.min(1439, s.startMin + delta)),
                    endMin: Math.max(0, Math.min(1439, s.endMin + delta)),
                  }
                : s
            ),
          }
        : p
    );
  };

  const removeSlot = (refId: string, title: string) => {
    setPlan((p) =>
      p
        ? {
            ...p,
            slots: p.slots.filter((s) => s.refId !== refId),
            unplaced: [
              ...p.unplaced,
              { taskId: refId.split("#")[0], title, reason: "Removed by you — sails another day" },
            ],
          }
        : p
    );
  };

  const nami = aboard.find((c) => c.id === "nami");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sky-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        {stage === "confession" && (
          <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
            <div className="text-4xl">✨</div>
            <h1 className="mt-2 text-lg font-black">The confession</h1>
            <p className="mt-1 text-xs font-bold text-sky-300">
              Say it out loud. Then tap. {lineIdx + 1} / {lines.length}
            </p>
            <p className="pop-in mt-8 min-h-24 text-xl font-black leading-relaxed" key={lineIdx}>
              “{lines[lineIdx]}”
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-1.5">
              {lines.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i <= lineIdx ? "bg-amber-400" : "bg-sky-800"}`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (lineIdx < lines.length - 1) setLineIdx(lineIdx + 1);
                else setStage("summary");
              }}
              className="mt-8 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
            >
              {lineIdx < lines.length - 1 ? "I said it — next" : "Amen ✨"}
            </button>
            <button onClick={onClose} className="mt-3 text-xs font-bold text-sky-500">
              Not yet — come back later
            </button>
          </div>
        )}

        {stage === "summary" && (
          <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
            <h1 className="text-lg font-black">Today's voyage</h1>
            <div className="mt-6 grid w-full grid-cols-3 gap-2">
              <div className="rounded-2xl bg-sky-900 p-3">
                <div className="text-2xl font-black text-amber-300">
                  {requiredDone}/{requiredTotal}
                </div>
                <div className="text-[10px] font-bold text-sky-300">required done</div>
              </div>
              <div className="rounded-2xl bg-sky-900 p-3">
                <div className="text-2xl font-black text-amber-300">+{xpToday}</div>
                <div className="text-[10px] font-bold text-sky-300">XP today</div>
              </div>
              <div className="rounded-2xl bg-sky-900 p-3">
                <div className="text-2xl font-black text-amber-300">🔥{streak}</div>
                <div className="text-[10px] font-bold text-sky-300">day streak</div>
              </div>
            </div>
            <div className="mt-5 flex justify-center gap-4">
              {aboard.map((m) => (
                <div key={m.id} className="text-center">
                  <Chibi char={m.id} mood={m.mood} size={64} />
                  <div className="text-[10px] font-black text-sky-300">
                    {m.name} {m.moodEmoji}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStage("tomorrow")}
              className="mt-8 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
            >
              Now — tomorrow's course 🗺️
            </button>
          </div>
        )}

        {stage === "tomorrow" && (
          <div className="py-4">
            <div className="flex items-end gap-3">
              <Chibi char="nami" mood={nami?.mood ?? "happy"} size={84} />
              <div className="mb-4 flex-1 rounded-2xl rounded-bl-none bg-sky-900 p-3 text-left">
                <p className="text-xs font-bold text-sky-100">
                  Here's tomorrow's course,{" "}
                  {new Date(`${tomorrow}T12:00:00Z`).toLocaleDateString("en-GB", {
                    weekday: "long",
                  })}
                  . Approve it and sleep already knowing your 7am. 🍊
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {(plan?.slots ?? [])
                .slice()
                .sort((a, b) => daySortKey(a.startMin) - daySortKey(b.startMin))
                .map((s) => (
                  <div
                    key={s.refId}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
                      s.kind === "task" ? "bg-amber-400/15" : "bg-sky-900/70"
                    }`}
                  >
                    <span className="w-[5.5rem] shrink-0 text-[11px] font-black text-sky-300">
                      {fmtMin(s.startMin)}–{fmtMin(s.endMin)}
                    </span>
                    <span className="text-sm">{s.emoji}</span>
                    <span className="flex-1 text-xs font-bold text-sky-50">{s.title}</span>
                    {s.locked ? (
                      <span className="text-[9px] font-black text-sky-500">FIXED</span>
                    ) : s.kind === "task" || s.kind === "skill" ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => shiftSlot(s.refId, -15)}
                          className="rounded-full bg-sky-800 px-1.5 text-[10px] font-black text-sky-200"
                          title="15 minutes earlier"
                        >
                          ◂
                        </button>
                        <button
                          onClick={() => shiftSlot(s.refId, 15)}
                          className="rounded-full bg-sky-800 px-1.5 text-[10px] font-black text-sky-200"
                          title="15 minutes later"
                        >
                          ▸
                        </button>
                        <button
                          onClick={() => removeSlot(s.refId, s.title)}
                          className="rounded-full bg-sky-800 px-1.5 text-[10px] font-black text-rose-300"
                          title="Remove from tomorrow"
                        >
                          ✕
                        </button>
                      </span>
                    ) : null}
                  </div>
                ))}
            </div>
            {(plan?.unplaced.length ?? 0) > 0 && (
              <div className="mt-3 rounded-2xl bg-sky-900/50 p-3">
                <p className="text-[10px] font-black text-sky-400">DIDN'T FIT TOMORROW</p>
                {plan!.unplaced.map((u) => (
                  <p key={u.taskId + u.reason} className="mt-1 text-xs font-semibold text-sky-200">
                    • {u.title} — <span className="text-sky-400">{u.reason}</span>
                  </p>
                ))}
              </div>
            )}
            <button
              disabled={approve.isPending || !plan}
              onClick={() =>
                plan &&
                approve.mutate(
                  { day: tomorrow, plan },
                  {
                    onSuccess: () => {
                      onSealed();
                      onClose();
                    },
                  }
                )
              }
              className="mt-5 w-full rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg transition enabled:hover:bg-amber-300 disabled:opacity-40"
            >
              {approve.isPending ? "Charting…" : "Approve the course — seal the day ⚓"}
            </button>
            <button
              onClick={() => setStage("summary")}
              className="mt-2 w-full text-center text-xs font-bold text-sky-500"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
