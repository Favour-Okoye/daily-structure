import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { Link } from "react-router-dom";
import { appDay, daySortKey, fmtMin, wallMinutes, weekdayOf } from "../lib/day";
import {
  anchorsForDay,
  churchForDay,
  requiredSlugs,
  REST_BLOCK,
  type AnchorForDay,
  type ChurchEvent,
  type Season,
} from "../lib/anchors";
import { useAnchorLog, useCheckAnchor, useCheckChurch } from "../lib/queries";
import { useGrowth } from "../lib/stats";
import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { QuietTimeGate, quietStartedAt } from "../components/QuietTimeGate";
import { awardCustom, DS_XP } from "../lib/xp";

const SEASON: Season = "gap"; // the season switch ships in a later phase

interface TimelineItem {
  key: string;
  kind: "anchor" | "church" | "rest";
  title: string;
  emoji: string;
  startMin: number;
  endMin?: number;
  fixed: boolean;
  xp?: number;
  required: boolean;
  hint?: string;
  anchor?: AnchorForDay;
  church?: ChurchEvent;
}

function fireConfetti() {
  void confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.7 },
    colors: ["#fbbf24", "#0ea5e9", "#0c4a6e", "#fde68a"],
  });
}

export function Today() {
  const { session } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const day = appDay();
  const isSunday = weekdayOf(day) === 0;
  const nowMin = wallMinutes();

  const items = useMemo<TimelineItem[]>(() => {
    const anchors = anchorsForDay(day, SEASON);
    const church = churchForDay(day);
    const rows: TimelineItem[] = [];
    for (const e of church) {
      rows.push({
        key: `church_${e.slug}`,
        kind: "church",
        title: e.title,
        emoji: e.emoji,
        startMin: e.startMin,
        endMin: e.endMin,
        fixed: true,
        xp: e.xp,
        required: true,
        church: e,
      });
    }
    rows.push({
      key: "rest",
      kind: "rest",
      title: "Rest — protected, no guilt",
      emoji: REST_BLOCK.emoji,
      startMin: REST_BLOCK.startMin,
      endMin: REST_BLOCK.endMin,
      fixed: true,
      required: false,
    });
    for (const a of anchors) {
      rows.push({
        key: a.slug,
        kind: "anchor",
        title: a.title,
        emoji: a.emoji,
        startMin: a.startMin ?? a.suggestMin ?? 9 * 60,
        endMin: a.endMin,
        fixed: a.startMin !== undefined,
        xp: a.xp,
        required: a.required,
        hint: a.hint,
        anchor: a,
      });
    }
    return rows.sort((x, y) => daySortKey(x.startMin) - daySortKey(y.startMin));
  }, [day]);

  const logQ = useAnchorLog(day);
  const log = logQ.data ?? {};
  const checkAnchor = useCheckAnchor(day);
  const checkChurch = useCheckChurch(day);
  const growth = useGrowth();

  const [quietOpen, setQuietOpen] = useState(false);
  useEffect(() => {
    // resume a quiet time that was running before a reload
    if (quietStartedAt() !== null) setQuietOpen(true);
  }, []);

  const required = useMemo(() => {
    const slugs = requiredSlugs(day, SEASON);
    for (const e of churchForDay(day)) slugs.push(`church_${e.slug}`);
    return slugs;
  }, [day]);
  const doneRequired = required.filter((s) => log[s]).length;
  const dayComplete = logQ.isSuccess && required.length > 0 && doneRequired === required.length;

  useEffect(() => {
    if (!dayComplete || !session) return;
    void awardCustom("day_complete", "day", day, DS_XP.day_complete).then((fresh) => {
      if (fresh) fireConfetti();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayComplete, day]);

  const quietAnchor = items.find((i) => i.anchor?.kind === "quiet")?.anchor;

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-md ring-1 ring-sky-100">
        <div className="text-5xl">🔌</div>
        <h1 className="mt-3 text-lg font-black text-sky-900">Not connected yet</h1>
        <p className="mt-2 text-sm text-stone-500">
          Fill in <code className="font-bold">frontend/.env.local</code> — full steps in{" "}
          <code className="font-bold">SETUP.md</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-3xl bg-sky-900 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-sky-300">
              {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
              {" · the voyage continues"}
            </div>
            <div className="mt-1 text-2xl font-black">
              🔥 {growth.streak.current}-day streak
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-sky-300">Total XP</div>
            <div className="text-2xl font-black text-amber-300">{growth.totalXp}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-sky-800/70 px-3 py-2">
          <span className="text-xs font-bold text-sky-200">
            {isSunday ? "Rest day" : "Required today"}
          </span>
          <span className="text-sm font-black text-amber-300">
            {doneRequired}/{required.length}
            {dayComplete && " · day complete! 🏴‍☠️"}
          </span>
        </div>
      </div>

      {!session && (
        <div className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-sky-100">
          <p className="text-sm font-bold text-stone-600">
            Sign in to start earning XP — same email code as MoneyTree.
          </p>
          <Link
            to="/login"
            className="mt-2 inline-block rounded-full bg-sky-900 px-5 py-2 text-sm font-black text-white"
          >
            Sign in ⚓
          </Link>
        </div>
      )}

      {isSunday && (
        <div className="rounded-3xl bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200">
          <p className="text-sm font-bold text-amber-900">
            🌊 Sunday is rest. Church, rest, and your confession — everything else is bonus, not
            duty.
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {items.map((item) => {
          const done = !!log[item.key];
          const activeNow =
            item.fixed &&
            item.endMin !== undefined &&
            nowMin >= item.startMin &&
            nowMin < item.endMin;
          const bonus = !item.required && item.kind !== "rest";
          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 transition ${
                activeNow && !done
                  ? "ring-2 ring-amber-400"
                  : done
                    ? "ring-sky-100 opacity-70"
                    : "ring-sky-100"
              } ${bonus ? "opacity-60" : ""}`}
            >
              <div className="w-20 shrink-0 text-center">
                {item.fixed && item.endMin !== undefined ? (
                  <div className="text-[11px] font-black text-sky-800">
                    {fmtMin(item.startMin)}
                    <div className="text-stone-300">–{fmtMin(item.endMin)}</div>
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-stone-400">
                    anytime
                    <div>~{fmtMin(item.startMin)}</div>
                  </div>
                )}
                {activeNow && !done && (
                  <span className="soft-pulse mt-0.5 inline-block rounded-full bg-amber-400 px-1.5 text-[9px] font-black text-sky-950">
                    NOW
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  <span>{item.emoji}</span>
                  <span className={done ? "line-through decoration-2" : ""}>{item.title}</span>
                  {bonus && (
                    <span className="rounded-full bg-stone-100 px-1.5 text-[9px] font-black text-stone-400">
                      BONUS
                    </span>
                  )}
                </div>
                {item.hint && !done && (
                  <p className="mt-0.5 text-[11px] font-semibold text-stone-400">{item.hint}</p>
                )}
              </div>
              <div className="shrink-0">
                {item.kind === "rest" ? (
                  <span className="text-xl">😴</span>
                ) : done ? (
                  <span className="text-xl">✅</span>
                ) : item.anchor?.kind === "quiet" ? (
                  <button
                    disabled={!session}
                    onClick={() => setQuietOpen(true)}
                    className="rounded-full bg-sky-900 px-3 py-1.5 text-xs font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-30"
                  >
                    Begin 🌊
                  </button>
                ) : (
                  <button
                    disabled={!session || checkAnchor.isPending || checkChurch.isPending}
                    onClick={() => {
                      if (item.kind === "church" && item.church) {
                        checkChurch.mutate({ event: item.church });
                      } else if (item.anchor) {
                        checkAnchor.mutate({ def: item.anchor });
                      }
                    }}
                    className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-30"
                  >
                    {item.anchor?.kind === "ceremony" ? "Seal ✨" : `+${item.xp} XP`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="pb-4 text-center text-xs font-bold text-stone-400">
        👒 The crew boards in the next update. Luffy, Zoro and Nami are on their way.
      </p>

      {quietOpen && quietAnchor && (
        <QuietTimeGate
          onComplete={(elapsedSeconds) => {
            setQuietOpen(false);
            checkAnchor.mutate({ def: quietAnchor, meta: { quietSeconds: elapsedSeconds } });
          }}
          onCancel={() => setQuietOpen(false)}
        />
      )}
    </div>
  );
}
