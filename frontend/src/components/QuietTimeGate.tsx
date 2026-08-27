import { useEffect, useState } from "react";

const START_KEY = "ds:quietStart";
const MIN_SECONDS = 10 * 60;
const TARGET_SECONDS = 15 * 60;

/** Read the persisted start (survives reload and screen-lock). */
export function quietStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(START_KEY);
    if (!raw) return null;
    const t = Number(raw);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/**
 * The no-phone habit inside a phone app: start it, put the phone face-down,
 * and the timer quietly counts from a timestamp — locking the screen is fine.
 * The check unlocks after 10 minutes.
 */
export function QuietTimeGate({
  onComplete,
  onCancel,
}: {
  onComplete: (elapsedSeconds: number) => void;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let start = quietStartedAt();
    if (start === null) {
      start = Date.now();
      try {
        localStorage.setItem(START_KEY, String(start));
      } catch {
        /* storage unavailable — timer still runs in memory */
      }
    }
    const tick = () => setElapsed(Math.floor((Date.now() - start!) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const clear = () => {
    try {
      localStorage.removeItem(START_KEY);
    } catch {
      /* ignore */
    }
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const unlocked = elapsed >= MIN_SECONDS;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-sky-950 px-6 text-center text-white">
      <div className="text-5xl">🌊</div>
      <h1 className="mt-3 text-xl font-black">Quiet time</h1>
      <p className="mt-2 max-w-xs text-sm text-sky-200">
        Phone face-down. Just you, your thoughts, and the Holy Spirit. We'll be here.
      </p>
      <div className="mt-8 font-black tabular-nums" style={{ fontSize: "4rem" }}>
        {mm}:{ss}
      </div>
      <p className="mt-1 text-xs font-bold text-sky-300">
        {unlocked
          ? elapsed >= TARGET_SECONDS
            ? "Beautiful. That's a full quiet time. ✨"
            : "10 minutes reached — finish whenever you're ready."
          : "The check unlocks at 10:00."}
      </p>
      <button
        onClick={() => {
          clear();
          onComplete(elapsed);
        }}
        disabled={!unlocked}
        className="mt-8 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg transition enabled:hover:bg-amber-300 disabled:opacity-30"
      >
        I'm back — done 🌅
      </button>
      <button
        onClick={() => {
          clear();
          onCancel();
        }}
        className="mt-3 text-xs font-bold text-sky-400"
      >
        Cancel (no XP)
      </button>
    </div>
  );
}
