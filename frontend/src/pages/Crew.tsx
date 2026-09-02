import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chibi } from "../components/chibi/Chibi";
import { VillageScene } from "../components/VillageScene";
import { MemoryGame } from "../components/MemoryGame";
import {
  useCancelExam,
  useCompleteQuestDay,
  useCrew,
  useMemorySession,
  useRepairStorm,
  useStartComeback,
  useStartExam,
  useTickets,
  useVillage,
} from "../lib/crewQueries";
import {
  CHAR_META,
  COMFY_FURNITURE,
  EXAMS,
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
  STORM_REPAIR_COST,
  THEME_COST,
  type CharId,
} from "../lib/crew";
import { useAuth } from "../lib/auth";

export function Crew() {
  const { session } = useAuth();
  const { loading, state, crew, aboard, wallet, examInfo, storm } = useCrew();
  const startComeback = useStartComeback();
  const completeQuestDay = useCompleteQuestDay();
  const startExam = useStartExam();
  const cancelExam = useCancelExam();
  const repairStorm = useRepairStorm();
  const village = useVillage();
  const tickets = useTickets();
  const memory = useMemorySession();
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [playing, setPlaying] = useState<CharId | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const say = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3800);
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
  const locked = crew.filter((c) => !c.recruited);
  const visible = aboard.filter((m) => !m.gone);

  const tryQuestDay = async () => {
    const res = await completeQuestDay(note);
    say(res.message);
    if (res.ok) setNote("");
  };

  return (
    <div className="space-y-4">
      {/* THE LIVING VILLAGE */}
      <VillageScene
        aboard={visible}
        state={state}
        onPick={(id) => cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />

      <div className="flex items-center justify-between rounded-3xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-sky-100">
        <span className="text-xs font-black text-stone-500">
          {aboard.length} aboard · {locked.length} to recruit
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
          💰 {wallet} XP to spend
        </span>
      </div>

      {flash && (
        <div className="pop-in rounded-3xl bg-sky-900 px-4 py-3 text-center text-sm font-black text-amber-300 shadow-md">
          {flash}
        </div>
      )}

      {/* Storm damage */}
      {storm && (
        <div className="rounded-3xl bg-white p-4 shadow-md ring-2 ring-stone-300">
          <p className="text-sm font-black text-stone-700">
            ⛈️ A storm damaged {CHAR_META[storm.charId].name}'s home!
          </p>
          <p className="mt-0.5 text-xs font-semibold text-stone-400">
            Homes with {2}+ furnishings hold in storms. Bare walls don't.
          </p>
          <button
            onClick={() => say(repairStorm().message)}
            className="mt-2 w-full rounded-full bg-sky-900 py-2 text-xs font-black text-white hover:bg-sky-800"
          >
            🔨 Repair — {STORM_REPAIR_COST} XP
          </button>
        </div>
      )}

      {/* Active level contract */}
      {examInfo && (
        <div className="rounded-3xl bg-white p-4 shadow-md ring-2 ring-sky-300">
          <div className="flex items-center gap-3">
            <Chibi char={examInfo.charId} mood="neutral" size={60} />
            <div className="flex-1">
              <h2 className="text-sm font-black text-stone-800">
                {CHAR_META[examInfo.charId].name}'s trial → “{FORM_NAMES[examInfo.charId][examInfo.targetLevel - 1]}”
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-stone-500">{examInfo.desc}</p>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${(examInfo.have / examInfo.needed) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] font-black text-stone-400">
                <span>{examInfo.have} / {examInfo.needed} days</span>
                <button onClick={() => { cancelExam(); say("Trial set aside — tuition returned."); }} className="text-rose-400">
                  cancel (full refund)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comeback quest */}
      {quest && (
        <div className="rounded-3xl bg-white p-4 shadow-md ring-2 ring-amber-300">
          <div className="flex items-center gap-3">
            <Chibi char={quest.charId} mood="sad" size={72} />
            <div className="flex-1">
              <h2 className="text-sm font-black text-stone-800">
                Winning back {CHAR_META[quest.charId].name} — day {Math.min(quest.daysDone + 1, 3)} of 3
              </h2>
              <p className="mt-0.5 text-xs font-bold text-amber-700">
                {QUEST_STEPS[Math.min(quest.daysDone, 2)].title}:{" "}
                <span className="font-semibold text-stone-500">{QUEST_STEPS[Math.min(quest.daysDone, 2)].detail}</span>
              </p>
              <div className="mt-1.5 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`h-2 w-8 rounded-full ${i < quest.daysDone ? "bg-amber-400" : "bg-stone-100"}`} />
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
        </div>
      )}

      {/* Crew cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {aboard.map((m) => (
          <div
            key={m.id}
            ref={(el) => { cardRefs.current[m.id] = el; }}
            className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ${m.gone ? "ring-stone-200" : "ring-sky-100"}`}
          >
            <div className="flex items-center gap-3">
              <Chibi char={m.id} mood={m.mood} level={m.level} size={76} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-stone-800">{m.name}</span>
                  <span>{m.moodEmoji}</span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black text-sky-700">
                    {m.formName} · Lv {m.level}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-stone-400">{m.role}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-sky-600">↳ {m.moodWhy}</div>
                <div className="mt-1.5">
                  <div className="flex justify-between text-[9px] font-black text-stone-400">
                    <span>{m.tier}</span>
                    <span>{m.bond}/100</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${m.bond}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {m.gone ? (
              <button
                disabled={!!quest}
                onClick={() => startComeback(m.id)}
                className="mt-2 w-full rounded-full bg-sky-900 py-2 text-xs font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
              >
                {quest ? "Finish the current quest first" : `Go after ${m.name} 🏃`}
              </button>
            ) : (
              <>
                {m.line && (
                  <p className="mt-2 rounded-2xl bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-900">“{m.line}”</p>
                )}
                {m.level < maxLevel(m.id) && !examInfo && !state.exam && (
                  <button
                    onClick={() => say(startExam(m.id, m.bond).message)}
                    className="mt-2 w-full rounded-full bg-stone-100 py-1.5 text-[11px] font-black text-stone-600 hover:bg-sky-50"
                    title={`Bond ${LEVEL_BOND_GATE[m.level + 1]}+ · tuition ${LEVEL_COST[m.level + 1]} XP · then: ${EXAMS[m.id].text(EXAMS[m.id].needed[m.level - 1] ?? 3)}`}
                  >
                    📜 Begin trial for “{FORM_NAMES[m.id][m.level]}” — {LEVEL_COST[m.level + 1]} XP tuition
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Playtime — Crew Memory */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-sky-900">🃏 Crew Memory</h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
            🎟️ {tickets.available}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-semibold text-stone-400">
          One rule: <b>a completed day = 1 ticket.</b> One ticket = one game. Every finish wins
          furniture; a perfect round wins the rare stuff. Never XP — life pays XP, games pay homes.
        </p>
        {picking ? (
          <div className="mt-2">
            <p className="text-[10px] font-black text-stone-400">WHO PLAYS WITH YOU?</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {visible.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (memory.start()) {
                      setPlaying(m.id);
                      setPicking(false);
                    }
                  }}
                  className="rounded-2xl bg-stone-50 p-1 hover:bg-amber-50"
                  title={m.name}
                >
                  <Chibi char={m.id} mood="happy" size={48} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            disabled={tickets.available < 1}
            onClick={() => setPicking(true)}
            className="mt-2 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
          >
            {tickets.available < 1 ? "Complete a day to earn a ticket" : "Play a round (1 🎟️)"}
          </button>
        )}
      </div>

      {/* Homes management */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">🏘️ Build & furnish</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
          {COMFY_FURNITURE}+ furnishings = a comfy home: +1 day before a walkout, and storms can't touch it.
        </p>
        <div className="mt-3 space-y-2">
          {visible.map((m) => {
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
                      {storm?.charId === m.id && <span className="text-rose-500"> · damaged ⚠️</span>}
                    </div>
                    {home.built ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {home.furniture.map((f, i) => (
                          <button
                            key={`${f}-${i}`}
                            onClick={() => village.removeFurniture(m.id, i)}
                            title={`${furnitureById(f)?.title} (tap to put back in crate)`}
                            className="rounded-lg bg-white px-1.5 py-0.5 text-sm shadow-sm"
                          >
                            {furnitureById(f)?.emoji}
                          </button>
                        ))}
                        {home.furniture.length === 0 && (
                          <span className="text-[10px] font-bold text-stone-300">bare walls — storms love those</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-stone-400">sleeping in a tent</span>
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
                      {theme.emoji} {THEME_COST}
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
                      Place ✚
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-stone-100 pt-3">
          {state.furnitureInv.length > 0 && (
            <>
              <p className="text-[10px] font-black text-stone-400">YOUR CRATE — tap an item, then “Place ✚” on a home</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {state.furnitureInv.map((f, i) => (
                  <button
                    key={`${f}-${i}`}
                    onClick={() => setPlacing(placing === f ? null : f)}
                    className={`rounded-xl px-2 py-1 text-lg shadow-sm ${placing === f ? "bg-amber-300 ring-2 ring-amber-500" : "bg-stone-50"}`}
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
            🐠 🐚 🌼 🔭 🏆 🧰 come from Crew Memory and island chests.
          </p>
        </div>
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

      {playing && (
        <MemoryGame
          companion={playing}
          onFinish={(perfect) => memory.finish(playing, perfect)}
          onQuit={() => setPlaying(null)}
        />
      )}

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
