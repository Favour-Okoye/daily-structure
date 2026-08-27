import { Chibi } from "../components/chibi/Chibi";
import { ALL_CHARS, type Mood } from "../lib/crew";

const MOODS: Mood[] = ["happy", "neutral", "worried", "sad", "packing", "gone"];

/** Dev harness: every drawn character in every mood, no sign-in needed. */
export function ChibiLab() {
  return (
    <div className="space-y-6">
      {ALL_CHARS.map((c) => (
        <div key={c} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black capitalize text-sky-900">{c}</h2>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            {MOODS.map((m) => (
              <div key={m} className="text-center">
                <Chibi char={c} mood={m} size={96} />
                <div className="text-[10px] font-bold text-stone-400">{m}</div>
              </div>
            ))}
            <div className="text-center">
              <Chibi char={c} mood="happy" level={3} size={96} />
              <div className="text-[10px] font-bold text-stone-400">level 3 aura</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
