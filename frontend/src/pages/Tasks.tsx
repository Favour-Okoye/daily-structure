import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { appDay, fmtMin } from "../lib/day";
import { urgencyOf, type Urgency } from "../lib/planner";
import {
  taskXp,
  useAddEvent,
  useAddTask,
  useCompleteTask,
  useDeleteEvent,
  useDropTask,
  useEvents,
  useOpenTasks,
  useRecentDoneTasks,
  type DsTask,
} from "../lib/tasksQueries";
import { useAuth } from "../lib/auth";

const KINDS: { value: DsTask["kind"]; label: string }[] = [
  { value: "general", label: "General" },
  { value: "job_application", label: "Job application" },
  { value: "job_followup", label: "Job follow-up" },
  { value: "bi_practice", label: "Data/BI practice" },
  { value: "church", label: "Church" },
  { value: "errand", label: "Errand" },
];

const URGENCY_STYLE: Record<Urgency, { chip: string; label: string }> = {
  overdue: { chip: "bg-rose-100 text-rose-700 soft-pulse", label: "overdue" },
  today: { chip: "bg-orange-100 text-orange-700 soft-pulse", label: "due today" },
  urgent: { chip: "bg-orange-50 text-orange-600", label: "soon!" },
  soon: { chip: "bg-amber-50 text-amber-700", label: "this week" },
  calm: { chip: "bg-stone-100 text-stone-500", label: "no rush" },
};

export function Tasks() {
  const { session } = useAuth();
  const day = appDay();
  const openQ = useOpenTasks();
  const doneQ = useRecentDoneTasks();
  const eventsQ = useEvents();
  const addTask = useAddTask();
  const completeTask = useCompleteTask();
  const dropTask = useDropTask();
  const addEvent = useAddEvent();
  const deleteEvent = useDeleteEvent();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DsTask["kind"]>("general");
  const [due, setDue] = useState("");
  const [est, setEst] = useState(30);

  const [evTitle, setEvTitle] = useState("");
  const [evDay, setEvDay] = useState("");
  const [evStart, setEvStart] = useState("09:00");
  const [evEnd, setEvEnd] = useState("11:00");

  if (!session) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-sky-100">
        <div className="text-5xl">🗺️</div>
        <p className="mt-3 text-sm font-bold text-stone-600">Sign in to chart your tasks.</p>
        <Link to="/login" className="mt-3 inline-block rounded-full bg-sky-900 px-5 py-2 text-sm font-black text-white">
          Sign in ⚓
        </Link>
      </div>
    );
  }

  const submitTask = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask.mutate(
      { title: title.trim(), kind, due_on: due || null, est_minutes: est },
      { onSuccess: () => { setTitle(""); setDue(""); setEst(30); setKind("general"); } }
    );
  };

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const submitEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDay) return;
    addEvent.mutate(
      { title: evTitle.trim(), day: evDay, start_min: toMin(evStart), end_min: toMin(evEnd) },
      { onSuccess: () => { setEvTitle(""); setEvDay(""); } }
    );
  };

  const open = openQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Add task */}
      <form onSubmit={submitTask} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">📌 New task</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Passport photo at the studio"
          className="mt-2 w-full rounded-2xl bg-stone-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DsTask["kind"])}
            className="rounded-full bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-600"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-full bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-600"
            title="Deadline (optional)"
          />
          {[15, 30, 60, 120].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEst(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-black ${
                est === m ? "bg-sky-900 text-white" : "bg-stone-50 text-stone-500"
              }`}
            >
              {m >= 60 ? `${m / 60}h` : `${m}m`}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={addTask.isPending}
          className="mt-3 w-full rounded-full bg-amber-400 py-2.5 text-sm font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-40"
        >
          Add to the map 🗺️
        </button>
      </form>

      {/* Open tasks */}
      <div className="space-y-2">
        {open.length === 0 && (
          <p className="py-4 text-center text-xs font-bold text-stone-400">
            No open tasks — Nami approves. 🍊
          </p>
        )}
        {open
          .slice()
          .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"))
          .map((t) => {
            const u = urgencyOf(t.due_on, day);
            const style = URGENCY_STYLE[u];
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-sky-100">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-stone-800">{t.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className={`rounded-full px-2 py-0.5 ${style.chip}`}>{style.label}</span>
                    {t.due_on && <span className="text-stone-400">due {t.due_on}</span>}
                    <span className="text-stone-300">· {t.est_minutes}m · +{taskXp(t)} XP</span>
                  </div>
                </div>
                <button
                  onClick={() => completeTask.mutate(t)}
                  disabled={completeTask.isPending}
                  className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-40"
                >
                  Done ✓
                </button>
                <button
                  onClick={() => dropTask.mutate(t.id)}
                  className="shrink-0 text-xs font-bold text-stone-300 hover:text-rose-400"
                  title="Drop this task"
                >
                  ✕
                </button>
              </div>
            );
          })}
      </div>

      {/* One-off events */}
      <form onSubmit={submitEvent} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">📅 One-off event</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
          Sanctuary cleaning, department outing… the planner will sail around it.
        </p>
        <input
          value={evTitle}
          onChange={(e) => setEvTitle(e.target.value)}
          placeholder="e.g. Sanctuary cleaning"
          className="mt-2 w-full rounded-2xl bg-stone-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
          <input type="date" value={evDay} onChange={(e) => setEvDay(e.target.value)} className="rounded-full bg-stone-50 px-3 py-1.5" />
          <input type="time" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="rounded-full bg-stone-50 px-3 py-1.5" />
          <span>→</span>
          <input type="time" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="rounded-full bg-stone-50 px-3 py-1.5" />
        </div>
        <button
          type="submit"
          disabled={addEvent.isPending}
          className="mt-3 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
        >
          Pin it 📌
        </button>
        {(eventsQ.data ?? []).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {(eventsQ.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-600">
                <span className="flex-1">
                  {e.title} · {e.day} · {fmtMin(e.start_min)}–{fmtMin(e.end_min)}
                </span>
                <button type="button" onClick={() => deleteEvent.mutate(e.id)} className="text-stone-300 hover:text-rose-400">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Recently done */}
      {(doneQ.data ?? []).length > 0 && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black text-sky-900">✅ Done this week</h2>
          <div className="mt-2 space-y-1">
            {(doneQ.data ?? []).map((t) => (
              <div key={t.id} className="text-xs font-semibold text-stone-400 line-through">
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
