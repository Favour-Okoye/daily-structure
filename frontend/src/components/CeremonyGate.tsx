import { useMemo, useState } from "react";
import { appDay, daySortKey, fmtMin, shiftDay } from "../lib/day";
import { anchorsForDay, churchForDay, REST_BLOCK, type Season } from "../lib/anchors";
import { useSettings } from "../lib/queries";
import { useApprovePlan, useCrew } from "../lib/crewQueries";
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

  const plan = useMemo(() => {
    const slots: {
      kind: string;
      refId: string;
      title: string;
      emoji: string;
      startMin: number;
      endMin: number | null;
      locked: boolean;
    }[] = [];
    for (const e of churchForDay(tomorrow)) {
      slots.push({
        kind: "event",
        refId: e.slug,
        title: e.title,
        emoji: e.emoji,
        startMin: e.startMin,
        endMin: e.endMin,
        locked: true,
      });
    }
    slots.push({
      kind: "rest",
      refId: "rest",
      title: "Rest — protected",
      emoji: REST_BLOCK.emoji,
      startMin: REST_BLOCK.startMin,
      endMin: REST_BLOCK.endMin,
      locked: true,
    });
    for (const a of anchorsForDay(tomorrow, SEASON)) {
      if (!a.required) continue;
      slots.push({
        kind: "anchor",
        refId: a.slug,
        title: a.title,
        emoji: a.emoji,
        startMin: a.startMin ?? a.suggestMin ?? 9 * 60,
        endMin: a.endMin ?? null,
        locked: a.startMin !== undefined,
      });
    }
    slots.sort((x, y) => daySortKey(x.startMin) - daySortKey(y.startMin));
    return { version: 1, day: tomorrow, season: SEASON, slots, unplaced: [] };
  }, [tomorrow]);

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
              {plan.slots.map((s) => (
                <div
                  key={s.refId}
                  className="flex items-center gap-3 rounded-2xl bg-sky-900/70 px-3 py-2"
                >
                  <span className="w-24 shrink-0 text-[11px] font-black text-sky-300">
                    {s.endMin !== null
                      ? `${fmtMin(s.startMin)}–${fmtMin(s.endMin)}`
                      : `~${fmtMin(s.startMin)}`}
                  </span>
                  <span className="text-sm">{s.emoji}</span>
                  <span className="flex-1 text-xs font-bold text-sky-50">{s.title}</span>
                  {s.locked && <span className="text-[9px] font-black text-sky-500">FIXED</span>}
                </div>
              ))}
            </div>
            <button
              disabled={approve.isPending}
              onClick={() =>
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
