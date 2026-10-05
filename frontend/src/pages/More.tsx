import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  useExerciseTarget,
  useSaveConfession,
  useSaveSettingsData,
  useSeason,
  useSetSeason,
  useSettings,
} from "../lib/queries";

const VAPID_PUBLIC_KEY =
  "BLT2LtJrdTlaO3JoeGp_dUAnjMnXv99sDkD6mjtqIIO8YsGKYCEfmO5NlS51JkMUG4r8--5Zp-P2TduXjaFyEN0";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
import { useCrewState } from "../lib/crewQueries";
import { SKILL_DECK } from "../lib/crew";

export function More() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const save = useSaveConfession();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settingsQ.isSuccess && !loaded) {
      setText((settingsQ.data.confession_lines ?? []).join("\n"));
      setLoaded(true);
    }
  }, [settingsQ.isSuccess, settingsQ.data, loaded]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">✨ Your confession</h2>
        <p className="mt-1 text-xs font-semibold text-stone-400">
          One line per row — the nightly ceremony will show them to you one at a time. This lives
          only in your database, never in the code.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          disabled={!session}
          placeholder={session ? "Money loves me.\nMoney comes to me easily…" : "Sign in first"}
          className="mt-3 w-full rounded-2xl bg-stone-50 p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          disabled={!session || save.isPending}
          onClick={() =>
            save.mutate(
              text
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            )
          }
          className="mt-2 w-full rounded-full bg-sky-900 py-2.5 text-sm font-black text-white transition enabled:hover:bg-sky-800 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : save.isSuccess ? "Saved ✨" : "Save confession"}
        </button>
      </div>

      <RemindersCard />

      <MovementCard />

      <BookCard />

      <SkillDeckCard />

      <SeasonToggle />

      <FridayToggle />

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <h2 className="text-sm font-black text-sky-900">🧭 About</h2>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold text-stone-500">
          <li>• Season: <b>Gap</b> — we retune everything when the job starts (work season).</li>
          <li>• The app's day flips at <b>04:00</b>, so your 2am confession counts for the right day.</li>
          <li>• Signing out here also signs you out of MoneyTree (shared account).</li>
          <li>• Sundays are rest: only the confession is required.</li>
        </ul>
      </div>

      {session && (
        <button
          onClick={() => void supabase!.auth.signOut()}
          className="w-full rounded-full bg-stone-200 py-2.5 text-sm font-black text-stone-600 hover:bg-stone-300"
        >
          Sign out (both apps)
        </button>
      )}
    </div>
  );
}

function RemindersCard() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const save = useSaveSettingsData();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const data = (settingsQ.data?.data ?? {}) as Record<string, unknown> & { push?: unknown };
  const enabled = !!data.push;

  const enable = async () => {
    setBusy(true);
    setNote(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNote("Notifications were blocked — allow them in your browser settings and try again.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      save.mutate({ ...data, push: sub.toJSON() });
      setNote("Reminders on — 12:00 and 18:00, only about what's still unticked.");
    } catch {
      setNote("Couldn't subscribe on this device. Try from the installed app on your phone.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      await (await reg.pushManager.getSubscription())?.unsubscribe();
    } catch {
      /* best effort */
    }
    save.mutate({ ...data, push: null });
    setNote("Reminders off.");
    setBusy(false);
  };

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">🔔 Reminders</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        12:00 and 18:00: a nudge listing only what's still unticked. Silent when you're caught up.
        Never on Sundays.
      </p>
      <button
        disabled={!session || busy || save.isPending}
        onClick={() => void (enabled ? disable() : enable())}
        className={`mt-2 w-full rounded-full py-2.5 text-sm font-black transition disabled:opacity-40 ${
          enabled
            ? "bg-stone-200 text-stone-600 hover:bg-stone-300"
            : "bg-sky-900 text-white hover:bg-sky-800"
        }`}
      >
        {busy ? "…" : enabled ? "Turn reminders off" : "Turn reminders on"}
      </button>
      {note && <p className="mt-2 text-xs font-bold text-sky-700">{note}</p>}
    </div>
  );
}

function MovementCard() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const save = useSaveSettingsData();
  const target = useExerciseTarget();
  const data = (settingsQ.data?.data ?? {}) as Record<string, unknown>;
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">💪 Movement target</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        Days per week Zoro expects. Stairs, errands and carrying all count — tick the truth.
      </p>
      <div className="mt-2 flex gap-2">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            disabled={!session || save.isPending}
            onClick={() => save.mutate({ ...data, exerciseTarget: n })}
            className={`flex-1 rounded-full py-2 text-xs font-black ${
              target === n ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            {n} days
          </button>
        ))}
      </div>
    </div>
  );
}

function BookCard() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const save = useSaveSettingsData();
  const data = (settingsQ.data?.data ?? {}) as Record<string, unknown> & {
    book?: { title?: string; chapters?: number };
  };
  const [title, setTitle] = useState("");
  const [loaded, setLoaded] = useState(false);
  const chapters = data.book?.chapters ?? 2;

  useEffect(() => {
    if (settingsQ.isSuccess && !loaded) {
      setTitle(data.book?.title ?? "9-5 Is Not a Scam");
      setLoaded(true);
    }
  }, [settingsQ.isSuccess, loaded, data.book?.title]);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">📗 Current book</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        Finished one? Set the next — the daily anchor follows along. Robin approves of sequels.
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={!session}
        placeholder="Book title"
        className="mt-2 w-full rounded-2xl bg-stone-50 px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs font-bold text-stone-500">Chapters per day:</span>
        {[1, 2].map((n) => (
          <button
            key={n}
            disabled={!session || save.isPending}
            onClick={() => save.mutate({ ...data, book: { title: title.trim(), chapters: n } })}
            className={`rounded-full px-4 py-1.5 text-xs font-black ${
              chapters === n ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          disabled={!session || save.isPending || !title.trim()}
          onClick={() => save.mutate({ ...data, book: { title: title.trim(), chapters } })}
          className="ml-auto rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black text-sky-950 transition enabled:hover:bg-amber-300 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : save.isSuccess ? "Saved 📗" : "Save"}
        </button>
      </div>
    </div>
  );
}

function SkillDeckCard() {
  const { data } = useCrewState();
  const pointer = (data?.state?.skillPointer ?? 0) % SKILL_DECK.length;
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">🎯 Your skill deck</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        On light days, the planner deals ONE card into your day as a 15-minute skill block.
        Complete it (+15 XP) and the deck rotates. Usopp is recruited by these.
      </p>
      <div className="mt-2 space-y-1">
        {SKILL_DECK.map((card, i) => (
          <div
            key={card.id}
            className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-bold ${
              i === pointer
                ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300"
                : "bg-stone-50 text-stone-500"
            }`}
          >
            <span>{card.emoji}</span>
            <span className="flex-1">{card.title}</span>
            {i === pointer && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-sky-950">
                UP NEXT
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SeasonToggle() {
  const { session } = useAuth();
  const season = useSeason();
  const setSeason = useSetSeason();
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">🍂 Season</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        Gap = the full daily voyage. Work = September mode: shorter mornings, evening exercise,
        weekday office block, book off, one Money Tree video. History is never lost — only
        expectations change.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          disabled={!session || setSeason.isPending}
          onClick={() => setSeason.mutate("gap")}
          className={`flex-1 rounded-full py-2 text-xs font-black ${
            season === "gap" ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
          }`}
        >
          Gap season 🌅
        </button>
        <button
          disabled={!session || setSeason.isPending}
          onClick={() => setSeason.mutate("work")}
          className={`flex-1 rounded-full py-2 text-xs font-black ${
            season === "work" ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
          }`}
        >
          Work season 💼
        </button>
      </div>
    </div>
  );
}

function FridayToggle() {
  const { session } = useAuth();
  const settingsQ = useSettings();
  const save = useSaveSettingsData();
  const data = (settingsQ.data?.data ?? {}) as { fridayOnline?: boolean };
  const online = !!data.fridayOnline;
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
      <h2 className="text-sm font-black text-sky-900">🙌 Friday prayers</h2>
      <p className="mt-1 text-xs font-semibold text-stone-400">
        In church (7-9pm, home ~10) or online (8-9pm)? The planner sails around it.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          disabled={!session || save.isPending}
          onClick={() => save.mutate({ ...data, fridayOnline: false })}
          className={`flex-1 rounded-full py-2 text-xs font-black ${
            !online ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
          }`}
        >
          In church ⛪
        </button>
        <button
          disabled={!session || save.isPending}
          onClick={() => save.mutate({ ...data, fridayOnline: true })}
          className={`flex-1 rounded-full py-2 text-xs font-black ${
            online ? "bg-sky-900 text-white" : "bg-stone-100 text-stone-500"
          }`}
        >
          Online 💻
        </button>
      </div>
    </div>
  );
}
