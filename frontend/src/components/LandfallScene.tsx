import { useState } from "react";
import confetti from "canvas-confetti";
import { Chibi } from "./chibi/Chibi";
import { islandAt, TIER_LINES, furnitureById } from "../lib/crew";
import { useCrew, useLandfall } from "../lib/crewQueries";

/**
 * Sunday landfall — the week's XP sailed the ship here.
 * Reveal the island, feast with the crew, open the chest.
 */
export function LandfallScene() {
  const { state, aboard } = useCrew();
  const landfall = useLandfall();
  const [landed, setLanded] = useState<{
    name: string; emoji: string; blurb: string; hue: number; tier: number; drops: string[];
  } | null>(null);
  const [closed, setClosed] = useState(false);

  const pending = state?.voyage.pendingLandfall ?? null;
  if (closed || (!pending && !landed)) return null;

  const island = landed ?? (state ? { ...islandAt(state.voyage.islandIndex), tier: pending!.tier, drops: [] as string[] } : null);
  if (!island) return null;
  const crew = aboard.filter((m) => !m.gone).slice(0, 6);
  const dishes = ["🍖", "🍜", "🍊", "🐟", "🍞", "🫖", "🍰", "🥘"].slice(0, 2 * (landed?.tier ?? pending?.tier ?? 1));

  return (
    <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center overflow-y-auto bg-sky-950/97 px-5 py-8 text-center text-white">
      {!landed ? (
        <>
          <div className="text-xs font-black uppercase tracking-widest text-sky-400">Land ho!</div>
          <h1 className="mt-2 text-2xl font-black text-amber-300">The week's sailing is done</h1>
          <p className="mt-2 max-w-xs text-sm font-semibold text-sky-200">
            {pending!.weekXp} XP filled the sails. An island waits through the mist…
          </p>
          <div className="pop-in mt-6 flex h-40 w-40 items-center justify-center rounded-full text-7xl"
            style={{ background: `radial-gradient(circle, hsl(${islandAt(state!.voyage.islandIndex).hue} 60% 70%), hsl(${islandAt(state!.voyage.islandIndex).hue} 45% 45%))`, filter: "blur(1px) brightness(0.6)" }}>
            ❓
          </div>
          <button
            onClick={() => {
              const r = landfall();
              if (r) {
                setLanded(r);
                void confetti({ particleCount: 150, spread: 90, origin: { y: 0.55 }, colors: ["#fbbf24", "#34d399", "#f472b6"], zIndex: 200 });
              }
            }}
            className="mt-8 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
          >
            Make landfall ⚓
          </button>
        </>
      ) : (
        <>
          <div className="pop-in flex h-44 w-44 items-center justify-center rounded-full text-8xl shadow-2xl"
            style={{ background: `radial-gradient(circle, hsl(${island.hue} 65% 72%), hsl(${island.hue} 50% 48%))` }}>
            {island.emoji}
          </div>
          <h1 className="mt-4 text-3xl font-black text-amber-300">{island.name}</h1>
          <p className="mt-1 max-w-xs text-sm font-semibold text-sky-200">{island.blurb}</p>
          <p className="mt-2 text-xs font-bold text-sky-400">{TIER_LINES[island.tier]}</p>

          {/* the feast */}
          <div className="mt-5 w-full max-w-sm rounded-3xl bg-sky-900/70 p-3">
            <div className="flex justify-center gap-1 text-2xl">{dishes.map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="mt-2 flex justify-center gap-1">
              {crew.map((m) => (
                <Chibi key={m.id} char={m.id} mood="happy" size={44} />
              ))}
            </div>
            <p className="mt-1 text-[10px] font-bold text-sky-400">
              The crew feasts on the shore — richness earned by YOUR week.
            </p>
          </div>

          {island.drops.length > 0 && (
            <div className="pop-in mt-4 rounded-3xl bg-sky-900 px-6 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">The island's chest</p>
              <div className="mt-1 flex justify-center gap-3 text-2xl">
                {island.drops.map((d, i) => (
                  <span key={i} title={furnitureById(d)?.title}>{furnitureById(d)?.emoji}</span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setClosed(true)}
            className="mt-6 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
          >
            Onward — new week, new sea 🌊
          </button>
        </>
      )}
    </div>
  );
}
