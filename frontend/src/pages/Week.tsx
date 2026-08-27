import { useState } from "react";
import { Link } from "react-router-dom";
import { appDay, isoWeekKey, mondayOfWeekKey } from "../lib/day";
import { GOALS_DECK } from "../lib/crew";
import { useCrew } from "../lib/crewQueries";
import { currentWeekMonday, goalMet, useSetWeeklyPicks, useSettleWeek, useWeekData } from "../lib/weekQueries";
import { useXpDays } from "../lib/stats";
import { useOpenTasks } from "../lib/tasksQueries";
import { useAuth } from "../lib/auth";

export function Week() {
  const { session } = useAuth();
  const { state, streak } = useCrew();
  const xpDaysQ = useXpDays();
  const tasksQ = useOpenTasks();
  const setPicks = useSetWeeklyPicks();
  const settle = useSettleWeek();
  const [selected, setSelected] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const today = appDay();
  const thisWeekKey = isoWeekKey(today);
  const thisMonday = currentWeekMonday();
  const thisWeekQ = useWeekData(thisMonday);

  const weekly = state?.weekly ?? null;
  const isCurrentWeek = weekly?.weekKey === thisWeekKey;
  const isFutureWeek = !!weekly && weekly.weekKey > thisWeekKey;
  const needsSettle = !!weekly && !weekly.settled && weekly.weekKey < thisWeekKey;
  const settleWeekQ = useWeekData(needsSettle ? mondayOfWeekKey(weekly!.weekKey) : thisMonday);
  const lateInWeek = [4, 5, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay());

  if (!session) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-sky-100">
        <div className="text-5xl">🌊</div>
        <p className="mt-3 text-sm font-bold text-stone-600">Sign in to see the voyage.</p>
        <Link to="/login" className="mt-3 inline-block rounded-full bg-sky-900 px-5 py-2 text-sm font-black text-white">
          Sign in ⚓
        </Link>
      </div>
    );
  }

  const overdueNow = (tasksQ.data ?? []).filter((t) => t.due_on && t.due_on < today).length;
  const weekDays = thisWeekQ.data?.days ?? [];
  const xpByDay = new Map((xpDaysQ.data ?? []).map((d) => [d.happened_on, d.points]));
  const maxXp = Math.max(60, ...weekDays.map((d) => xpByDay.get(d) ?? 0));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));

  return (
    <div className="space-y-4">
      {/* This week's recap */}
      <div className="rounded-3xl bg-sky-900 p-4 text-white shadow-md">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-black">This week's voyage</h1>
          <span className="text-xs font-black text-sky-300">🔥 {streak.current}-day streak</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-1.5">
          {weekDays.map((d) => {
            const xp = xpByDay.get(d) ?? 0;
            const label = ["M", "T", "W", "T", "F", "S", "S"][weekDays.indexOf(d)];
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] font-black text-amber-300">{xp > 0 ? xp : ""}</span>
                <div className="flex h-16 w-full items-end rounded-lg bg-sky-800/60">
                  <div
                    className={`w-full rounded-lg ${d === today ? "bg-amber-400" : "bg-sky-400"}`}
                    style={{ height: `${Math.min(100, (xp / maxXp) * 100)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-black ${d === today ? "text-amber-300" : "text-sky-400"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {flash && (
        <div className="pop-in rounded-3xl bg-sky-900 px-4 py-3 text-center text-sm font-black text-amber-300 shadow-md">
          {flash}
        </div>
      )}

      {/* Settle last week */}
      {needsSettle && (
        <div className="rounded-3xl bg-white p-4 shadow-md ring-2 ring-amber-300">
          <h2 className="text-sm font-black text-sky-900">⚖️ Last week awaits judgment</h2>
          <div className="mt-2 space-y-1">
            {weekly!.picks.map((p) => {
              const g = GOALS_DECK.find((x) => x.id === p);
              const met = settleWeekQ.data ? goalMet(p, settleWeekQ.data, overdueNow) : null;
              return (
                <p key={p} className="text-xs font-bold text-stone-600">
                  {met === null ? "…" : met ? "✅" : "❌"} {g?.emoji} {g?.title}
                  {met && <span className="text-amber-600"> +40 XP</span>}
                </p>
              );
            })}
          </div>
          <button
            disabled={!settleWeekQ.data || settle.isPending}
            onClick={() =>
              settle.mutate(
                { weekData: settleWeekQ.data! },
                {
                  onSuccess: (results) => {
                    const met = results.filter((r) => r.met).length;
                    setFlash(
                      met === 2
                        ? "Both goals met! The crew feasts tonight. 🎉 +100 XP"
                        : met === 1
                          ? "One goal met — solid sailing. +60 XP"
                          : "No goals met — but the log is honest, and next week is fresh. +20 XP"
                    );
                    window.setTimeout(() => setFlash(null), 5000);
                  },
                }
              )
            }
            className="mt-3 w-full rounded-full bg-amber-400 py-2.5 text-sm font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-40"
          >
            {settle.isPending ? "Weighing…" : "Settle the week ⚖️ (+20 XP for the log)"}
          </button>
        </div>
      )}

      {/* Current picks or picking */}
      {isCurrentWeek && !needsSettle ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black text-sky-900">🎯 This week's promises</h2>
          <div className="mt-2 space-y-1.5">
            {weekly!.picks.map((p) => {
              const g = GOALS_DECK.find((x) => x.id === p);
              const met = thisWeekQ.data ? goalMet(p, thisWeekQ.data, overdueNow) : false;
              return (
                <div key={p} className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2">
                  <span>{g?.emoji}</span>
                  <span className="flex-1 text-xs font-bold text-stone-700">{g?.title}</span>
                  <span className={`text-[10px] font-black ${met ? "text-green-600" : "text-stone-400"}`}>
                    {met ? "ON TRACK ✓" : "IN PROGRESS"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] font-bold text-stone-400">
            Settled next week — 40 XP each. Sakura is watching.
          </p>
        </div>
      ) : isFutureWeek ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black text-sky-900">🎯 Promises for the coming week</h2>
          <div className="mt-2 space-y-1.5">
            {weekly!.picks.map((p) => {
              const g = GOALS_DECK.find((x) => x.id === p);
              return (
                <div key={p} className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2">
                  <span>{g?.emoji}</span>
                  <span className="flex-1 text-xs font-bold text-stone-700">{g?.title}</span>
                  <span className="text-[10px] font-black text-sky-500">SETS SAIL MONDAY</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !needsSettle && (
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
            <h2 className="text-sm font-black text-sky-900">🎯 Pick 2 promises for this week</h2>
            {lateInWeek && (
              <p className="mt-1 text-[11px] font-bold text-amber-700">
                The week's almost over — it's completely fine to wait and promise fresh on Sunday
                evening instead. Promises should be winnable.
              </p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {GOALS_DECK.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggle(g.id)}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-bold transition ${
                    selected.includes(g.id)
                      ? "bg-sky-900 text-white"
                      : "bg-stone-50 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <span>{g.emoji}</span> {g.title}
                </button>
              ))}
            </div>
            <button
              disabled={selected.length !== 2}
              onClick={() => {
                setPicks(selected);
                setSelected([]);
              }}
              className="mt-3 w-full rounded-full bg-amber-400 py-2.5 text-sm font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-40"
            >
              Promise these two ({selected.length}/2)
            </button>
          </div>
        )
      )}

      {/* Voyage log */}
      {(state?.log.length ?? 0) > 0 && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black text-sky-900">📜 Voyage log</h2>
          <div className="mt-2 space-y-1">
            {state!.log.slice(0, 14).map((l, i) => (
              <p key={i} className="text-xs font-semibold text-stone-500">
                <span className="text-stone-300">{l.day}</span> {l.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
