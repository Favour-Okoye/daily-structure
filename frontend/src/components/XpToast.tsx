import { useEffect, useState } from "react";

interface Toast {
  id: number;
  points: number;
}

/** Floating "+N XP" pill, fired by lib/xp.ts whenever a fresh award lands. */
export function XpToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    const onXp = (e: Event) => {
      const points = (e as CustomEvent<{ points: number }>).detail.points;
      const id = ++counter;
      setToasts((t) => [...t, { id, points }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener("ds:xp", onXp);
    return () => window.removeEventListener("ds:xp", onXp);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-1">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pop-in rounded-full bg-sky-900 px-4 py-1.5 text-sm font-black text-amber-300 shadow-lg"
        >
          +{t.points} XP ⚓
        </div>
      ))}
    </div>
  );
}
