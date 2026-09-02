import { useEffect, useState } from "react";

interface Toast {
  id: number;
  kind: "xp" | "bond";
  text: string;
}

/** Floating pills: "+N XP ⚓" (amber) and "+N bond Zoro 💚" (green).
 *  Fired via CustomEvents "ds:xp" and "ds:bond" — cause and effect, visible. */
export function XpToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    const push = (kind: Toast["kind"], text: string) => {
      const id = ++counter;
      setToasts((t) => [...t, { id, kind, text }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
    };
    const onXp = (e: Event) => {
      const points = (e as CustomEvent<{ points: number }>).detail.points;
      push("xp", `+${points} XP ⚓`);
    };
    const onBond = (e: Event) => {
      const { name, delta } = (e as CustomEvent<{ name: string; delta: number }>).detail;
      push("bond", `+${delta} bond · ${name} 💚`);
    };
    window.addEventListener("ds:xp", onXp);
    window.addEventListener("ds:bond", onBond);
    return () => {
      window.removeEventListener("ds:xp", onXp);
      window.removeEventListener("ds:bond", onBond);
    };
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-1">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pop-in rounded-full px-4 py-1.5 text-sm font-black shadow-lg ${
            t.kind === "xp" ? "bg-sky-900 text-amber-300" : "bg-emerald-700 text-emerald-50"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
