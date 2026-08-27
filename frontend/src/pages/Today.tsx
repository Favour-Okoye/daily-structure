import { useEffect, useMemo, useRef, useState } from "react";
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
} from "../lib/anchors";
import {
  flushOutbox,
  useAnchorLog,
  useCheckAnchor,
  useCheckChurch,
  useMoneyTreeVideoCount,
  useSeason,
} from "../lib/queries";
import { useGrowth } from "../lib/stats";
import { useAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { QuietTimeGate, quietStartedAt } from "../components/QuietTimeGate";
import { CeremonyGate } from "../components/CeremonyGate";
import { useAdvanceSkill, useClaimRequest, useCrew, useGrace } from "../lib/crewQueries";
import { CHAR_META, SKILL_DECK } from "../lib/crew";
import { Chibi } from "../components/chibi/Chibi";
import { useCompleteTask, useDayPlan, useOpenTasks, type DsTask } from "../lib/tasksQueries";
import type { PlanSlot } from "../lib/planner";
import { awardCustom, DS_XP } from "../lib/xp";

const SKILL_BLOCK_DEF = {
  slug: "skill_block",
  title: "Skill block",
  emoji: "🎯",
  xp: 15,
  area: "skills",
  kind: "check",
  minutes: 15,
  requiredOn: () => false,
} as unknown as AnchorForDay;

// (season now comes live from the profile — gap until September, then work)

interface TimelineItem {
  key: string;
  kind: "anchor" | "church" | "rest" | "task" | "skill";
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
  task?: DsTask;
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
  const season = useSeason();
  const isSunday = weekdayOf(day) === 0;
  const nowMin = wallMinutes();

  const items = useMemo<TimelineItem[]>(() => {
    const anchors = anchorsForDay(day, season);
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
  }, [day, season]);

  const logQ = useAnchorLog(day);
  const log = logQ.data ?? {};
  const checkAnchor = useCheckAnchor(day);
  const checkChurch = useCheckChurch(day);
  const growth = useGrowth();
  const { aboard, state: crewState } = useCrew();
  const { left: graceLeft, grace } = useGrace();
  const advanceSkill = useAdvanceSkill();
  const claimRequest = useClaimRequest();

  // Task/skill slots from the plan approved at last night's ceremony.
  const planQ = useDayPlan(day);
  const openTasksQ = useOpenTasks();
  const completeTask = useCompleteTask();
  const planItems = useMemo<TimelineItem[]>(() => {
    const slots = ((planQ.data?.plan as { slots?: PlanSlot[] } | undefined)?.slots ?? []).filter(
      (s) => s.kind === "task" || s.kind === "skill"
    );
    const open = new Map((openTasksQ.data ?? []).map((t) => [t.id, t]));
    const skillCard = SKILL_DECK[(crewState?.skillPointer ?? 0) % SKILL_DECK.length];
    return slots.map((s) => ({
      key: `plan_${s.refId}`,
      kind: s.kind === "task" ? ("task" as const) : ("skill" as const),
      title: s.kind === "skill" ? skillCard.title : s.title,
      emoji: s.kind === "skill" ? skillCard.emoji : s.emoji,
      startMin: s.startMin,
      endMin: s.endMin,
      fixed: true,
      required: false,
      task: s.kind === "task" ? open.get(s.refId.split("#")[0]) : undefined,
    }));
  }, [planQ.data, openTasksQ.data, crewState?.skillPointer]);

  const allItems = useMemo(
    () => [...items, ...planItems].sort((x, y) => daySortKey(x.startMin) - daySortKey(y.startMin)),
    [items, planItems]
  );

  const [quietOpen, setQuietOpen] = useState(false);
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [graceFor, setGraceFor] = useState<{ slug: string; title: string } | null>(null);
  const [graceReason, setGraceReason] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    // resume a quiet time that was running before a reload
    if (quietStartedAt() !== null) setQuietOpen(true);
  }, []);

  // Offline outbox: sync anything checked while at sea.
  useEffect(() => {
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // MoneyTree auto-detect: Robin notices the 3 videos on her own.
  const mtDone = !!log["money_tree"];
  const mtCountQ = useMoneyTreeVideoCount(day, logQ.isSuccess && !mtDone);
  const mtAuto = useRef(false);
  useEffect(() => {
    if (mtAuto.current || mtDone || !logQ.isSuccess) return;
    if ((mtCountQ.data ?? 0) >= 3) {
      const def = items.find((i) => i.key === "money_tree")?.anchor;
      if (def) {
        mtAuto.current = true;
        checkAnchor.mutate({ def, meta: { auto: true, videos: mtCountQ.data } });
        setFlash("🌳 Robin saw you finish your Money Tree videos — logged for you.");
        window.setTimeout(() => setFlash(null), 5000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mtCountQ.data, mtDone, logQ.isSuccess]);

  const required = useMemo(() => {
    const slugs = requiredSlugs(day, season);
    for (const e of churchForDay(day)) slugs.push(`church_${e.slug}`);
    return slugs;
  }, [day, season]);
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
            {session && <span className="ml-2 text-sky-300">🕊️ {graceLeft} grace</span>}
          </span>
          <span className="text-sm font-black text-amber-300">
            {doneRequired}/{required.length}
            {dayComplete && " · day complete! 🏴‍☠️"}
          </span>
        </div>
      </div>

      {flash && (
        <div className="pop-in rounded-3xl bg-sky-900 px-4 py-3 text-center text-sm font-black text-amber-300 shadow-md">
          {flash}
        </div>
      )}

      {session && aboard.length > 0 && (
        <Link
          to="/crew"
          className="flex items-center justify-center gap-3 rounded-3xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-sky-100"
        >
          {aboard.map((m) => (
            <span key={m.id} className="text-xs font-black text-stone-600">
              {m.name} {m.moodEmoji}
            </span>
          ))}
          <span className="text-[10px] font-black text-sky-600">→ crew</span>
        </Link>
      )}

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

      {aboard.some((m) => m.mood === "packing") && (
        <Link
          to="/crew"
          className="soft-pulse block rounded-3xl bg-rose-50 p-4 shadow-sm ring-2 ring-rose-300"
        >
          <p className="text-sm font-black text-rose-700">
            🎒{" "}
            {aboard
              .filter((m) => m.mood === "packing")
              .map((m) => m.name)
              .join(" and ")}{" "}
            is packing their bags — one real day in their area and they'll stay. Today.
          </p>
        </Link>
      )}

      {aboard.some((m) => m.gone) && (
        <Link to="/crew" className="block rounded-3xl bg-stone-100 p-4 shadow-sm ring-1 ring-stone-300">
          <p className="text-sm font-black text-stone-600">
            💨 {aboard.filter((m) => m.gone).map((m) => m.name).join(", ")} left the crew. Go after
            them →
          </p>
        </Link>
      )}

      {crewState?.request && crewState.request.day === day && (
        <div
          className={`flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ${
            crewState.request.done ? "ring-sky-100 opacity-70" : "ring-2 ring-sky-300"
          }`}
        >
          <Chibi
            char={crewState.request.charId}
            mood={crewState.request.done ? "happy" : "neutral"}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-sky-600">
              {CHAR_META[crewState.request.charId].name.toUpperCase()} ASKS
            </div>
            <p className="text-xs font-bold text-stone-700">“{crewState.request.text}”</p>
          </div>
          {crewState.request.done ? (
            <span className="text-xl">💛</span>
          ) : crewState.request.kind !== "furnish" ? (
            <button
              onClick={() =>
                void claimRequest().then((r) => {
                  setFlash(r.message);
                  window.setTimeout(() => setFlash(null), 4000);
                })
              }
              className="shrink-0 rounded-full bg-sky-900 px-3 py-1.5 text-[10px] font-black text-white hover:bg-sky-800"
            >
              Claim +10
            </button>
          ) : (
            <Link
              to="/crew"
              className="shrink-0 rounded-full bg-sky-900 px-3 py-1.5 text-[10px] font-black text-white"
            >
              To the village →
            </Link>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {allItems.map((item) => {
          const entry = item.kind === "anchor" || item.kind === "church" ? log[item.key] : undefined;
          const excused = entry?.status === "grace";
          const done =
            item.kind === "task"
              ? openTasksQ.isSuccess && !item.task
              : item.kind === "skill"
                ? !!log["skill_block"]
                : !!entry;
          const activeNow =
            item.fixed &&
            item.endMin !== undefined &&
            nowMin >= item.startMin &&
            nowMin < item.endMin;
          const bonus =
            !item.required && item.kind !== "rest" && item.kind !== "task" && item.kind !== "skill";
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
                  <span className={done && !excused ? "line-through decoration-2" : ""}>
                    {item.title}
                  </span>
                  {excused && (
                    <span className="rounded-full bg-sky-50 px-1.5 text-[9px] font-black text-sky-500">
                      EXCUSED
                    </span>
                  )}
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
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.kind === "rest" ? (
                  <span className="text-xl">😴</span>
                ) : done ? (
                  <span className="text-xl">{excused ? "🕊️" : "✅"}</span>
                ) : item.kind === "task" ? (
                  <button
                    disabled={!session || completeTask.isPending || !item.task}
                    onClick={() => item.task && completeTask.mutate(item.task)}
                    className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-30"
                  >
                    Done ✓
                  </button>
                ) : item.kind === "skill" ? (
                  <button
                    disabled={!session || checkAnchor.isPending}
                    onClick={() =>
                      checkAnchor.mutate({ def: SKILL_BLOCK_DEF }, { onSuccess: () => advanceSkill() })
                    }
                    className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-30"
                  >
                    +15 XP
                  </button>
                ) : item.anchor?.kind === "quiet" ? (
                  <button
                    disabled={!session}
                    onClick={() => setQuietOpen(true)}
                    className="rounded-full bg-sky-900 px-3 py-1.5 text-xs font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-30"
                  >
                    Begin 🌊
                  </button>
                ) : item.anchor?.kind === "ceremony" ? (
                  <button
                    disabled={!session}
                    onClick={() => setCeremonyOpen(true)}
                    className="rounded-full bg-sky-900 px-3 py-1.5 text-xs font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-30"
                  >
                    Ceremony ✨
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
                    +{item.xp} XP
                  </button>
                )}
                {!done &&
                  session &&
                  graceLeft > 0 &&
                  (item.kind === "anchor" || item.kind === "church") &&
                  item.anchor?.kind !== "ceremony" && (
                    <button
                      onClick={() => {
                        setGraceFor({ slug: item.key, title: item.title });
                        setGraceReason("");
                      }}
                      className="text-[9px] font-black text-stone-300 hover:text-sky-500"
                    >
                      🕊️ can't today
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {graceFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-sky-950/80 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-black text-sky-900">🕊️ Grace for “{graceFor.title}”</h2>
            <p className="mt-1 text-xs font-semibold text-stone-400">
              {graceLeft} token{graceLeft !== 1 ? "s" : ""} left this week. No XP — but no one gets
              sad either. Honesty first: what's the real reason?
            </p>
            <textarea
              value={graceReason}
              onChange={(e) => setGraceReason(e.target.value)}
              rows={2}
              autoFocus
              placeholder="e.g. Not home at noon — department outing ran long"
              className="mt-3 w-full rounded-2xl bg-stone-50 p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              disabled={grace.isPending}
              onClick={() =>
                grace.mutate(
                  { slug: graceFor.slug, reason: graceReason },
                  {
                    onSuccess: () => {
                      setGraceFor(null);
                      setFlash("🕊️ Excused. The crew understands — this time.");
                      window.setTimeout(() => setFlash(null), 4000);
                    },
                    onError: (e) => {
                      setFlash(e instanceof Error ? e.message : "Couldn't apply grace.");
                      window.setTimeout(() => setFlash(null), 4000);
                    },
                  }
                )
              }
              className="mt-3 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
            >
              Use a grace token
            </button>
            <button
              onClick={() => setGraceFor(null)}
              className="mt-2 w-full text-center text-xs font-bold text-stone-400"
            >
              Never mind — I'll still do it
            </button>
          </div>
        </div>
      )}

      <p className="pb-4 text-center text-xs font-bold text-stone-400">
        ⚓ The crew never pays XP. Your real day pays the crew.
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

      {ceremonyOpen && (
        <CeremonyGate
          requiredDone={doneRequired}
          requiredTotal={required.length}
          streak={growth.streak.current}
          onSealed={() => {
            const confession = items.find((i) => i.anchor?.kind === "ceremony")?.anchor;
            if (confession) checkAnchor.mutate({ def: confession });
          }}
          onClose={() => setCeremonyOpen(false)}
        />
      )}
    </div>
  );
}
