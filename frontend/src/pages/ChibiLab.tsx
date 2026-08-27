import { Chibi } from "../components/chibi/Chibi";
import type { CharId, Mood } from "../lib/crew";

const CHARS: CharId[] = ["luffy", "zoro", "nami"];
const MOODS: Mood[] = ["happy", "neutral", "worried", "sad"];

/** Dev harness: every drawn character in every mood, no sign-in needed. */
export function ChibiLab() {
  return (
    <div className="space-y-6">
      {CHARS.map((c) => (
        <div key={c} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
          <h2 className="text-sm font-black capitalize text-sky-900">{c}</h2>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            {MOODS.map((m) => (
              <div key={m} className="text-center">
                <Chibi char={c} mood={m} size={104} />
                <div className="text-[10px] font-bold text-stone-400">{m}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
