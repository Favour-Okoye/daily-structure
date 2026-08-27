import { useState } from "react";
import { Link } from "react-router-dom";
import { Chibi } from "../components/chibi/Chibi";
import {
  useBuyLevel,
  useCompleteQuestDay,
  useCrew,
  useStartComeback,
  useVillage,
  type CrewMember,
} from "../lib/crewQueries";
import {
  CHAR_META,
  COMFY_FURNITURE,
  FORM_NAMES,
  FURNITURE,
  furnitureById,
  HOME_THEMES,
  HOUSE_COST,
  isComfy,
  LEVEL_BOND_GATE,
  LEVEL_COST,
  maxLevel,
  QUEST_STEPS,
  THEME_COST,
} from "../lib/crew";
import { useAuth } from "../lib/auth";

export function Crew() {
  const { session } = useAuth();
  const { loading, state, crew, aboard, wallet } = useCrew();
  const startComeback = useStartComeback();
  const completeQuestDay = useCompleteQuestDay();
  const buyLevel = useBuyLevel();
  const village = useVillage();
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);

  const say = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3600);
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-sky-100">
        <div className="text-5xl">👒</div>
        <p className="mt-3 text-sm font-bold text-stone-600">Sign in to meet your crew.</p>
        <Link to="/login" className="mt-3 inline-block rounded-full bg-sky-900 px-5 py-2 text-sm font-black text-white">
          Sign in ⚓
        </Link>
      </div>
    );
  }

  if (loading || !state) {
    return <p className="py-10 text-center text-sm font-bold text-stone-400">Raising the sails…</p>;
  }

  const quest = state.comeback;
  const questChar = quest ? crew.find((c) => c.id === quest.charId) : null;
  const locked = crew.filter((c) => !c.recruited);

  const tryBuy = (m: CrewMember) => {
    const res = buyLevel(m.id, m.bond);
    setFlash(res.message);
    window.setTimeout(() => setFlash(null), 3200);
  };

  const tryQuestDay = async () => {
    const res = await completeQuestDay(note);
    setFlash(res.message);
    if (res.ok) setNote("");
    window.setTimeout(() => setFlash(null), 4200);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-b from-sky-200 to-sky-50 p-4 shadow-sm ring-1 ring-sky-100">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-black text-sky-900">The crew</h1>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-sky-800">
            💰 {wallet} XP to spend
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-sky-800/70">
          {aboard.length} aboard · {locked.length} to recruit. They live off your real days.
        </p>
      </div>

      {flash && (
        <div className="pop-in rounded-3xl bg-sky-900 px-4 py-3 text-center text-sm font-black text-amber-300 shadow-md">
          {flash}
        </div>
      )}

      {/* Active comeback quest */}
      {quest && questChar && (
        <div className="rounded-3xl bg-white p-4 shadow-md ring-2 ring-amber-300">
          <div className="flex items-center gap-3">
            <Chibi char={quest.charId} mood="sad" size={72} />
            <div className="flex-1">
              <h2 className="text-sm font-black text-stone-800">
                Winning back {CHAR_META[quest.charId].name} — day {Math.min(quest.daysDone + 1, 3)} of 3
              </h2>
              <p className="mt-0.5 text-xs font-bold text-amber-700">
                {QUEST_STEPS[Math.min(quest.daysDone, 2)].title}:{" "}
                <span className="font-semibold text-stone-500">
                  {QUEST_STEPS[Math.min(quest.daysDone, 2)].detail}
                </span>
              </p>
              <div className="mt-1.5 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-2 w-8 rounded-full ${i < quest.daysDone ? "bg-amber-400" : "bg-stone-100"}`}
                  />
                ))}
              </div>
            </div>
          </div>
          {quest.daysDone === 2 && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Your recommitment — what will be different this time?"
              className="mt-3 w-full rounded-2xl bg-stone-50 p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <button
            onClick={() => void tryQuestDay()}
            className="mt-3 w-full rounded-full bg-amber-400 py-2.5 text-sm font-black text-sky-950 hover:bg-amber-300"
          >
            {quest.daysDone === 2 ? "Deliver the apology 🕊️" : "Complete today's step"}
          </button>
          <p className="mt-2 text-center text-[10px] font-bold text-stone-400">
            Grace tokens can't excuse quest days. Sasuke respects only the real thing.
          </p>
        </div>
      )}

      {/* Aboard */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {aboard.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col items-center rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ${
              m.gone ? "ring-stone-200" : "ring-sky-100"
            }`}
          >
            <Chibi char={m.id} mood={m.mood} level={m.level} size={104} />
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-base font-black text-stone-800">{m.name}</span>
              <span className="text-lg">{m.moodEmoji}</span>
            </div>
            <div className="text-[11px] font-bold text-stone-400">{m.role}</div>
            <div className="mt-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700">
              {m.formName} · Lv {m.level}
            </div>

            {m.gone ? (
              <div className="mt-3 w-full">
                <p className="text-xs font-bold text-stone-500">
                  Gone since {state.characters[m.id].goneSince}. The spot feels empty.
                </p>
                <button
                  disabled={!!quest}
                  onClick={() => startComeback(m.id)}
                  className="mt-2 w-full rounded-full bg-sky-900 py-2 text-xs font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
                >
                  {quest ? "Finish the current quest first" : "Go after them 🏃"}
                </button>
              </div>
            ) : (
              <>
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
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${m.bond}%` }} />
                  </div>
                </div>
                {m.level < maxLevel(m.id) && (
                  <button
                    onClick={() => tryBuy(m)}
                    className="mt-2 w-full rounded-full bg-stone-100 py-1.5 text-[11px] font-black text-stone-600 hover:bg-amber-100"
                    title={`Needs bond ${LEVEL_BOND_GATE[m.level + 1]}+ and ${LEVEL_COST[m.level + 1]} XP`}
                  >
                    ⚡ Unlock “{FORM_NAMES[m.id][m.level]}” — {LEVEL_COST[m.level + 1]} XP
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* The village */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">🏘️ The village</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
          Build homes with XP. A home with {COMFY_FURNITURE}+ furnishings holds its owner one extra
          day before a walkout — their house is a reason to stay.
        </p>
        <div className="mt-3 space-y-2">
          {aboard
            .filter((m) => !m.gone)
            .map((m) => {
              const home = state.village[m.id];
              const theme = HOME_THEMES[m.id];
              return (
                <div key={m.id} className="rounded-2xl bg-stone-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{home.themed ? theme.emoji : home.built ? "🏠" : "🏕️"}</span>
                    <div className="flex-1">
                      <div className="text-xs font-black text-stone-700">
                        {m.name}
                        {home.themed && <span className="text-sky-600"> · {theme.title}</span>}
                        {isComfy(home) && <span className="text-amber-600"> · comfy ✨</span>}
                      </div>
                      {home.built ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {home.furniture.map((f, i) => (
                            <button
                              key={`${f}-${i}`}
                              onClick={() => village.removeFurniture(m.id, i)}
                              title={`${furnitureById(f)?.title} (tap to put back)`}
                              className="rounded-lg bg-white px-1.5 py-0.5 text-sm shadow-sm"
                            >
                              {furnitureById(f)?.emoji}
                            </button>
                          ))}
                          {home.furniture.length === 0 && (
                            <span className="text-[10px] font-bold text-stone-300">empty — needs warmth</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-stone-400">sleeping under the stars</span>
                      )}
                    </div>
                    {!home.built ? (
                      <button
                        onClick={() => say(village.buildOrTheme(m.id).message)}
                        className="rounded-full bg-sky-900 px-3 py-1.5 text-[10px] font-black text-white hover:bg-sky-800"
                      >
                        Build 🏠 {HOUSE_COST}
                      </button>
                    ) : !home.themed ? (
                      <button
                        onClick={() => say(village.buildOrTheme(m.id).message)}
                        className="rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-black text-stone-600 hover:bg-amber-100"
                      >
                        {theme.emoji} {theme.title} {THEME_COST}
                      </button>
                    ) : null}
                    {placing && home.built && (
                      <button
                        onClick={() => {
                          void village.placeFurniture(m.id, placing).then((r) => {
                            say(r.message);
                            if (r.ok) setPlacing(null);
                          });
                        }}
                        className="soft-pulse rounded-full bg-amber-400 px-3 py-1.5 text-[10px] font-black text-sky-950"
                      >
                        Place here ✚
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Inventory + shop */}
        {(state.furnitureInv.length > 0 || true) && (
          <div className="mt-3 border-t border-stone-100 pt-3">
            {state.furnitureInv.length > 0 && (
              <>
                <p className="text-[10px] font-black text-stone-400">
                  YOUR CRATE — tap an item, then “Place here” on a home
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {state.furnitureInv.map((f, i) => (
                    <button
                      key={`${f}-${i}`}
                      onClick={() => setPlacing(placing === f ? null : f)}
                      className={`rounded-xl px-2 py-1 text-lg shadow-sm ${
                        placing === f ? "bg-amber-300 ring-2 ring-amber-500" : "bg-stone-50"
                      }`}
                      title={furnitureById(f)?.title}
                    >
                      {furnitureById(f)?.emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="mt-2 text-[10px] font-black text-stone-400">FURNITURE SHOP</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {FURNITURE.filter((f) => f.cost > 0).map((f) => (
                <button
                  key={f.id}
                  onClick={() => say(village.buyFurniture(f.id).message)}
                  className="rounded-xl bg-stone-50 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-amber-50"
                  title={f.title}
                >
                  {f.emoji} {f.cost}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] font-bold text-stone-300">
              🐠 🔭 🏆 🧰 only come from playtime prizes (coming next).
            </p>
          </div>
        )}
      </div>

      {/* Locked */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">🔒 Still out there</h2>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {locked.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-2">
              <span className="text-lg">❓</span>
              <div>
                <div className="text-xs font-black text-stone-600">{m.name}</div>
                <div className="text-[10px] font-bold text-stone-400">{m.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voyage log */}
      {state.log.length > 0 && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black text-sky-900">📜 Recent voyage log</h2>
          <div className="mt-2 space-y-1">
            {state.log.slice(0, 8).map((l, i) => (
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
