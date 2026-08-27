import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  useSaveConfession,
  useSaveSettingsData,
  useSeason,
  useSetSeason,
  useSettings,
} from "../lib/queries";

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
