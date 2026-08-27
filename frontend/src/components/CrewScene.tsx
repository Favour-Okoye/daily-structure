import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Chibi } from "./chibi/Chibi";
import { CHAR_META } from "../lib/crew";
import { useCrew, useDismissScene } from "../lib/crewQueries";

/** Full-screen recruit / reunion moments. Mounted once in AppShell. */
export function CrewScene() {
  const { state } = useCrew();
  const dismiss = useDismissScene();
  const recruit = state?.pendingRecruit ?? null;
  const reunion = state?.pendingReunion ?? null;
  const charId = recruit ?? reunion;

  useEffect(() => {
    if (!charId) return;
    const id = window.setTimeout(() => {
      void confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#0ea5e9", "#f472b6", "#fde68a"],
        zIndex: 200,
      });
    }, 350);
    return () => window.clearTimeout(id);
  }, [charId]);

  if (!charId) return null;
  const meta = CHAR_META[charId];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-sky-950/97 px-6 text-center text-white">
      <div className="pop-in">
        <Chibi char={charId} mood="happy" size={160} />
      </div>
      <h1 className="mt-4 text-2xl font-black text-amber-300">
        {recruit ? `${meta.name} joined the crew!` : `${meta.name} came back!`}
      </h1>
      <p className="mt-2 max-w-xs text-sm font-semibold text-sky-200">
        {recruit
          ? `${meta.role}. Your consistency brought them aboard — keep showing up and they'll stay.`
          : "The comeback is complete. What was broken is mended — protect it this time."}
      </p>
      <button
        onClick={dismiss}
        className="mt-8 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
      >
        {recruit ? "Welcome aboard ⚓" : "Welcome home 🏴‍☠️"}
      </button>
    </div>
  );
}
