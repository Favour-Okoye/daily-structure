// Smart reminder robot — runs on GitHub Actions at ~12:00 and ~18:00 Brussels.
// Reads what Favour has NOT ticked today and nudges only about that.
// Completely silent when she's caught up. Never sends XP — only memory jogs.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const webpush = require("web-push");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SERVICE_ROLE;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const APP_URL = "https://favour-okoye.github.io/daily-structure/";

if (!SERVICE_ROLE) {
  console.log("SUPABASE_SERVICE_ROLE secret not set yet — skipping quietly.");
  process.exit(0);
}

// New-style secret keys (sb_secret_…) go ONLY in the apikey header — they are not
// JWTs and are refused as Bearer tokens. Legacy service_role JWTs (eyJ…) need both.
const KEY = SERVICE_ROLE.trim();
const keyKind = KEY.startsWith("sb_secret_")
  ? "new secret key"
  : KEY.startsWith("sb_publishable_")
    ? "PUBLISHABLE key (wrong one — need the secret key)"
    : KEY.startsWith("eyJ")
      ? "legacy JWT key"
      : "unrecognized key format";
// Shape only — this repo's logs are public, so never print any part of the key.
console.log(
  `Key type: ${keyKind} (length ${KEY.length}; spaces: ${/\s/.test(KEY)}; quotes: ${/["']/.test(KEY)}; ascii-only: ${/^[\x21-\x7e]+$/.test(KEY)})`
);
const headers = KEY.startsWith("eyJ")
  ? { apikey: KEY, Authorization: `Bearer ${KEY}` }
  : { apikey: KEY };

/** App-day: Brussels calendar day, flipped at 04:00 (mirror of lib/day.ts). */
function appDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(
    new Date(now.getTime() - 4 * 3600_000)
  );
}
function brusselsHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23" }).format(now)
  );
}
function weekdayOf(day) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (res.status === 401) {
    // A bad key is a setup problem, not an outage: say so and exit cleanly,
    // so GitHub doesn't email "workflow failed" twice a day.
    console.log(
      "Supabase rejected the key. Update the SUPABASE_SERVICE_ROLE secret with the sb_secret_… key. Skipping this run."
    );
    process.exit(0);
  }
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const day = appDay();
const hour = brusselsHour();
const minute = Number(
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", minute: "2-digit" }).format(new Date())
);
const wallMin = hour * 60 + minute;
const wd = weekdayOf(day);

// GitHub's scheduler runs this hours late at times, so it wakes often and
// only speaks inside the real windows (Brussels): 12:00–13:30 and 18:00–19:30.
const slot =
  wallMin >= 12 * 60 && wallMin < 13 * 60 + 30
    ? "midday"
    : wallMin >= 18 * 60 && wallMin < 19 * 60 + 30
      ? "evening"
      : null;
const forced = process.env.FORCE_SLOT; // manual runs can force a slot for testing
const activeSlot = forced || slot;
if (!activeSlot) {
  console.log(`Outside the reminder windows (${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} Brussels). Nothing to do.`);
  process.exit(0);
}

const [settingsRows, profileRows, logRows] = await Promise.all([
  get("ds_settings?select=user_id,data&limit=1"),
  get("ds_profiles?select=season&limit=1"),
  get(`ds_anchor_log?day=eq.${day}&select=anchor_slug,status`),
]);

const userId = settingsRows[0]?.user_id;
const data = settingsRows[0]?.data ?? {};
const on = typeof data.remindersOn === "boolean" ? data.remindersOn : !!data.push;
const subs = [...(data.pushSubs ?? []), ...(data.push ? [data.push] : [])].filter(
  (s, i, all) => s?.endpoint && all.findIndex((x) => x?.endpoint === s.endpoint) === i
);
if (!on || subs.length === 0) {
  console.log("Reminders are off or no device is saved. Skipping.");
  process.exit(0);
}

if (wd === 0) {
  console.log("Sunday is rest. No nudges on rest days.");
  process.exit(0);
}

if (!forced && (data.reminderLog ?? {})[activeSlot] === day) {
  console.log(`The ${activeSlot} nudge already went out today.`);
  process.exit(0);
}

const season = profileRows[0]?.season ?? "gap";
const offs = new Set((data.offs ?? {})[day] ?? []);
const logged = new Set(logRows.map((r) => r.anchor_slug)); // done or grace both count as handled

const bookTitle = data.book?.title ?? "the book";
const CANDIDATES = [
  ["devotional", "📖 Devotional"],
  ["noon_prayer", "🙏 Noon prayer"],
  ["bible", "📜 Bible chapter"],
  ...(season === "gap" ? [["book", `📗 ${bookTitle}`]] : []),
  ["money_tree", "🌳 Money Tree"],
  ["quiet_time", "🌊 Quiet time"],
];

const missing = CANDIDATES.filter(([slug]) => !logged.has(slug) && !offs.has(slug)).map(
  ([, label]) => label
);

/** Record the slot as handled and drop dead devices — against the fresh row. */
async function writeBack(deadEndpoints) {
  const [row] = await get("ds_settings?select=data&limit=1");
  const fresh = row?.data ?? {};
  const next = {
    ...fresh,
    reminderLog: { ...(fresh.reminderLog ?? {}), [activeSlot]: day },
  };
  if (deadEndpoints.length) {
    next.pushSubs = (fresh.pushSubs ?? []).filter((s) => !deadEndpoints.includes(s?.endpoint));
    if (fresh.push && deadEndpoints.includes(fresh.push.endpoint)) next.push = null;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ds_settings?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ data: next }),
  });
  if (!res.ok) console.log(`Couldn't record the send: ${res.status}`);
}

if (missing.length === 0) {
  console.log("All caught up — staying silent. ⚓");
  await writeBack([]);
  process.exit(0);
}

const shown = missing.slice(0, 4).join(" · ") + (missing.length > 4 ? ` +${missing.length - 4}` : "");
const payload =
  activeSlot === "midday"
    ? {
        title: "Midday sweep ⚓",
        body: `Already done any of these? Tap what's true: ${shown}`,
        tag: "ds-midday",
        url: APP_URL,
      }
    : {
        title: "Evening sweep 🌙",
        body: `Still open: ${shown}. Tick the true ones — ceremony later. The crew believes you.`,
        tag: "ds-evening",
        url: APP_URL,
      };

webpush.setVapidDetails("mailto:rubyontop18@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE.trim());
const dead = [];
let delivered = 0;
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    delivered++;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
    else console.log(`One device failed: ${err.statusCode ?? err.message}`);
  }
}
console.log(`Sent ${activeSlot} nudge to ${delivered}/${subs.length} device(s); ${dead.length} expired and removed. "${payload.body}"`);
await writeBack(dead);
if (delivered === 0) {
  console.log("No device could receive it — opening the app on her phone re-saves a fresh subscription.");
}
