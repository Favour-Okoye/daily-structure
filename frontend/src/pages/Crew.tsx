import { Link } from "react-router-dom";
import { Chibi } from "../components/chibi/Chibi";
import { useCrew } from "../lib/crewQueries";
import { useAuth } from "../lib/auth";

export function Crew() {
  const { session } = useAuth();
  const { loading, aboard, crew } = useCrew();

  if (!session) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-sky-100">
        <div className="text-5xl">👒</div>
        <p className="mt-3 text-sm font-bold text-stone-600">Sign in to meet your crew.</p>
        <Link
          to="/login"
          className="mt-3 inline-block rounded-full bg-sky-900 px-5 py-2 text-sm font-black text-white"
        >
          Sign in ⚓
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="py-10 text-center text-sm font-bold text-stone-400">Raising the sails…</p>;
  }

  const locked = crew.filter((c) => !c.recruited).length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-b from-sky-200 to-sky-50 p-4 shadow-sm ring-1 ring-sky-100">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-black text-sky-900">The crew</h1>
          <span className="text-xs font-black text-sky-700">
            {aboard.length} aboard · {locked} to recruit
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-sky-800/70">
          They live off your real days. Feed the anchors, and watch them thrive.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {aboard.map((m) => (
          <div
            key={m.id}
            className="flex flex-col items-center rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-sky-100"
          >
            <Chibi char={m.id} mood={m.mood} size={104} />
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-base font-black text-stone-800">{m.name}</span>
              <span className="text-lg">{m.moodEmoji}</span>
            </div>
            <div className="text-[11px] font-bold text-stone-400">{m.role}</div>
            {m.line && (
              <p className="mt-2 rounded-2xl bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-900">
                “{m.line}”
              </p>
            )}
            <div className="mt-3 w-full">
              <div className="flex justify-between text-[10px] font-black text-stone-400">
                <span>{m.tier}</span>
                <span>{m.bond}/100</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${m.bond}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-sky-100">
        <div className="text-2xl">🔒</div>
        <p className="mt-1 text-sm font-black text-stone-700">{locked} future crewmates</p>
        <p className="mt-1 text-xs font-semibold text-stone-400">
          Usopp, Sanji, Chopper, Robin — and from another world entirely: Naruto, Hinata, Sakura,
          Kakashi, Sasuke. Streaks and XP will bring them aboard in a coming update.
        </p>
      </div>
    </div>
  );
}
