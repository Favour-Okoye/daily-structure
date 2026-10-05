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

const headers = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
};

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
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const day = appDay();
const hour = brusselsHour();
const slot = hour < 15 ? "midday" : "evening";
const wd = weekdayOf(day);

const [settingsRows, profileRows, logRows] = await Promise.all([
  get("ds_settings?select=data&limit=1"),
  get("ds_profiles?select=season&limit=1"),
  get(`ds_anchor_log?day=eq.${day}&select=anchor_slug,status`),
]);

const data = settingsRows[0]?.data ?? {};
const push = data.push;
if (!push || !push.endpoint) {
  console.log("No push subscription saved — she hasn't enabled reminders. Skipping.");
  process.exit(0);
}

if (wd === 0) {
  console.log("Sunday is rest. No nudges on rest days.");
  process.exit(0);
}

const season = profileRows[0]?.season ?? "gap";
const offs = new Set((data.offs ?? {})[day] ?? []);
const logged = new Set(logRows.map((r) => r.anchor_slug)); // done, grace or off-row all count as handled

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

if (missing.length === 0) {
  console.log("All caught up — staying silent. ⚓");
  process.exit(0);
}

const shown = missing.slice(0, 4).join(" · ") + (missing.length > 4 ? ` +${missing.length - 4}` : "");
const payload =
  slot === "midday"
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

webpush.setVapidDetails("mailto:rubyontop18@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
try {
  await webpush.sendNotification(push, JSON.stringify(payload));
  console.log(`Sent ${slot} nudge: ${payload.body}`);
} catch (err) {
  if (err.statusCode === 404 || err.statusCode === 410) {
    console.log("Subscription expired — she needs to re-enable reminders in More.");
    process.exit(0);
  }
  throw err;
}
