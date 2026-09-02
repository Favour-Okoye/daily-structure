import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Chibi } from "./chibi/Chibi";
import { ALL_CHARS, CHAR_META, furnitureById, type CharId } from "../lib/crew";

/**
 * Crew Memory — find the matching pairs of crew faces.
 * One rule shown up front: finish = furniture, ≤12 tries = the rare stuff.
 * Pays bond + furniture. NEVER XP — real life is the only XP source.
 */

const PAIRS = 8;
export const PERFECT_TRIES = 12;

interface Card {
  key: number;
  charId: CharId;
  flipped: boolean;
  matched: boolean;
}

function shuffled(day: number): CharId[] {
  const pool = [...ALL_CHARS];
  // simple LCG so each session differs
  let seed = day || Date.now();
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, PAIRS);
  const deck = [...chosen, ...chosen];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const CHEERS = ["Nakama!", "Found them!", "That's the one!", "Nice memory!", "Again!"];

export function MemoryGame({
  companion,
  onFinish,
  onQuit,
}: {
  companion: CharId;
  onFinish: (perfect: boolean) => { dropId: string };
  onQuit: () => void;
}) {
  const [cards, setCards] = useState<Card[]>(() =>
    shuffled(Date.now()).map((charId, key) => ({ key, charId, flipped: false, matched: false }))
  );
  const [open, setOpen] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const [result, setResult] = useState<{ dropId: string; perfect: boolean } | null>(null);
  const lock = useRef(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);

  useEffect(() => {
    if (matchedCount === PAIRS * 2 && !result) {
      const perfect = tries <= PERFECT_TRIES;
      const r = onFinish(perfect);
      setResult({ ...r, perfect });
      void confetti({
        particleCount: perfect ? 160 : 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#0ea5e9", "#f472b6"],
        zIndex: 200,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCount]);

  const flip = (key: number) => {
    if (lock.current || result) return;
    const card = cards[key];
    if (card.flipped || card.matched) return;
    const nowOpen = [...open, key];
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, flipped: true } : c)));
    if (nowOpen.length < 2) {
      setOpen(nowOpen);
      return;
    }
    setTries((t) => t + 1);
    const [a] = nowOpen;
    const first = cards[a];
    const isMatch = first.charId === card.charId;
    if (isMatch) {
      setCards((cs) =>
        cs.map((c) => (c.charId === card.charId ? { ...c, matched: true, flipped: true } : c))
      );
      setOpen([]);
      setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      window.setTimeout(() => setCheer(null), 1200);
    } else {
      lock.current = true;
      setOpen([]);
      window.setTimeout(() => {
        setCards((cs) =>
          cs.map((c) => (c.key === a || c.key === key ? { ...c, flipped: false } : c))
        );
        lock.current = false;
      }, 750);
    }
  };

  const drop = result ? furnitureById(result.dropId) : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto bg-sky-950 px-4 py-6 text-white">
      <div className="flex w-full max-w-sm items-center justify-between">
        <button onClick={onQuit} className="text-xs font-bold text-sky-400">← quit</button>
        <div className="text-sm font-black text-amber-300">
          tries: {tries} <span className="text-sky-500">/ perfect ≤ {PERFECT_TRIES}</span>
        </div>
      </div>

      <div className="mt-1 flex w-full max-w-sm items-end gap-2">
        <div className="relative">
          <Chibi char={companion} mood={cheer ? "happy" : "neutral"} size={58} />
          {cheer && (
            <div className="pop-in absolute -top-1 left-12 whitespace-nowrap rounded-2xl rounded-bl-none bg-white px-2 py-1 text-[10px] font-black text-sky-900">
              {cheer}
            </div>
          )}
        </div>
        <p className="mb-2 flex-1 text-[10px] font-bold text-sky-300">
          Match the crew! Finish = furniture 🎁 · {PERFECT_TRIES} tries or fewer = something rare ✨
        </p>
      </div>

      <div className="mt-2 grid w-full max-w-sm grid-cols-4 gap-1.5">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => flip(c.key)}
            className={`flex aspect-square items-center justify-center rounded-2xl transition ${
              c.matched
                ? "bg-amber-400/25 ring-2 ring-amber-400"
                : c.flipped
                  ? "bg-sky-800"
                  : "bg-sky-900 hover:bg-sky-800"
            }`}
          >
            {c.flipped || c.matched ? (
              <Chibi char={c.charId} mood="neutral" size={54} />
            ) : (
              <span className="text-xl">🌊</span>
            )}
          </button>
        ))}
      </div>

      {result && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-sky-950/97 px-6 text-center">
          <Chibi char={companion} mood="happy" size={110} />
          <h1 className="mt-3 text-2xl font-black text-amber-300">
            {result.perfect ? `PERFECT — ${tries} tries!` : `All pairs in ${tries} tries!`}
          </h1>
          <p className="mt-2 text-sm font-bold text-sky-200">+3 bond with {CHAR_META[companion].name} 💛</p>
          {drop && (
            <div className="pop-in mt-4 rounded-3xl bg-sky-900 px-6 py-4">
              <div className="text-4xl">{drop.emoji}</div>
              <p className="mt-1 text-sm font-black">You won: {drop.title}!</p>
              <p className="text-[10px] font-bold text-sky-400">In your crate — place it on a home.</p>
            </div>
          )}
          <button
            onClick={onQuit}
            className="mt-6 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
          >
            Back to the village ⚓
          </button>
        </div>
      )}
    </div>
  );
}
