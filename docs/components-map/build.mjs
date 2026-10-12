// Generates docs/components-map/components-map.html (rendered to PDF/PNG with headless Edge/Chrome).
// Run: node docs/components-map/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "../../node_modules/lucide-react/dist/esm/icons");

async function icon(name, size = 22, color = "#1f2937") {
  const { __iconData } = await import(pathToFileURL(join(iconsDir, `${name}.mjs`)).href);
  const inner = __iconData.node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const COLS = ["Trigger", "Input", "Context", "Processing", "Output"];
const C = {
  blue: ["#3b82f6", "#eff6ff"],
  sky: ["#0ea5e9", "#f0f9ff"],
  orange: ["#f97316", "#fff7ed"],
  teal: ["#14b8a6", "#f0fdfa"],
  green: ["#22c55e", "#f0fdf4"],
  purple: ["#8b5cf6", "#f5f3ff"],
  yellow: ["#eab308", "#fefce8"],
  pink: ["#ec4899", "#fdf2f8"],
};
// Lane background by actor kind.
const LANE = { person: "#eef1f6", app: "#fbf1e4", store: "#eaf5ec", external: "#f1edfb", scheduler: "#e9f3fb" };

const steps = [
  {
    actor: "Vercel Cron", sub: "Daily refresh job", kind: "scheduler", icon: "clock", col: 0, color: "blue",
    title: "Daily refresh runs",
    body: "06:00 IST (00:30 UTC) calls /api/cron/refresh — only with the CRON_SECRET bearer",
    detail: {
      Trigger: "Vercel Cron, schedule “30 0 * * *” in vercel.json (UTC). Manual “Refresh Releases” button does the same (max once per 5 min).",
      Input: "Authorization: Bearer CRON_SECRET, checked with a constant-time compare.",
      Context: "automation_runs row keyed release_refresh:<IST date> — a second run the same day is skipped.",
      Processing: "Computes the 7-day window in Asia/Kolkata: today − 6 … today.",
      Output: "Starts the refresh pipeline (step 2).",
    },
  },
  {
    actor: "TMDB API", sub: "Release data source", kind: "external", icon: "film", col: 1, color: "sky",
    title: "Pulls India releases",
    body: "Last 7 days on Netflix · Prime · Hotstar: dates, providers, genres, runtime, episodes",
    detail: {
      Trigger: "Refresh pipeline (releases.service → TmdbReleaseAdapter).",
      Input: "/discover/movie & /discover/tv with watch_region=IN, provider IDs 8, 119, 122/2336, release & air-date filters; a pass per users’ languages.",
      Context: "Provider map in config/providers.ts (stable IDs first, names as fallback).",
      Processing: "Fetches details + release_dates + watch/providers for up to 160 candidates, 6 at a time, with retries on 429/5xx.",
      Output: "Raw candidate titles with India provider listings.",
    },
  },
  {
    actor: "Release Radar App", sub: "Release validator", kind: "app", icon: "shield-check", col: 3, color: "orange",
    title: "Verifies the OTT date",
    body: "India digital date or platform-original premiere = ✓ verified; theatrical / global = unverified",
    detail: {
      Trigger: "Each candidate from step 2.",
      Input: "Release-date types per country, season air dates, original TV network, India providers.",
      Context: "Rules in lib/release/eligibility.ts; window is never widened.",
      Processing: "Movie: India Digital (type 4) date in window → verified. Series/season premiere in window on its own platform → verified. Global digital / primary date → unverified. Old-season episodes → excluded. Duplicates collapsed.",
      Output: "Normalised titles + release events, each marked verified or unverified_date.",
    },
  },
  {
    actor: "Supabase", sub: "Catalogue store", kind: "store", icon: "database", col: 2, color: "green",
    title: "Saves titles & releases",
    body: "Upserts titles + ott_releases, logs the run; a failed fetch never deletes data",
    detail: {
      Trigger: "Validated records from step 3.",
      Input: "titles (unique tmdb_id + media_type), ott_releases (unique title × provider × region × event).",
      Context: "Metadata fingerprint per title detects real changes; first_seen_at preserved.",
      Processing: "Idempotent upserts; automation_runs + integration_status updated (succeeded / partial / failed).",
      Output: "Live catalogue + “Last synced” timestamp. On TMDB failure the last good data stays and is labelled as such.",
    },
  },
  {
    actor: "Naman", sub: "Signs in & sets his taste", kind: "person", icon: "user", col: 1, color: "teal",
    title: "Sets his preferences",
    body: "Thriller · Sci-fi · Indie drama, Hindi · English · Tamil, his platforms, discovery mode",
    detail: {
      Trigger: "Signs in (Supabase Auth, email + password) and opens My Preferences.",
      Input: "Genres, languages, platforms, movies/series, runtime, dubbed, popular vs hidden gems, Stick / Balanced / Surprise me, mood.",
      Context: "user_preferences row created on sign-up with the brief’s defaults.",
      Processing: "PUT /api/preferences validated with Zod; RLS + column grants let him edit only his own safe columns.",
      Output: "Saved taste profile (Save / Cancel / Reset to defaults).",
    },
  },
  {
    actor: "Naman · Vercel Cron", sub: "Discover · Friday 6 PM", kind: "scheduler", icon: "calendar-clock", col: 0, color: "blue",
    title: "Asks “what’s new?”",
    body: "Opens Discover / This Week or Preview — or the Friday 18:00 IST cron fires",
    detail: {
      Trigger: "Page visit, “Get AI verdicts”, “Preview My Friday Digest”, “Send Test Digest”, or cron “30 12 * * *” (= 18:00 IST) on his digest day (Friday).",
      Input: "Signed-in session (JWT checked server-side) or CRON_SECRET.",
      Context: "Weekly run keyed weekly_digest:<IST date> — no duplicate runs.",
      Processing: "Cron first runs a refresh, then finds users with digest on, Telegram connected and today = digest day.",
      Output: "A request to build his personalised list (step 7).",
    },
  },
  {
    actor: "Supabase", sub: "Window & profile", kind: "store", icon: "database", col: 2, color: "green",
    title: "Loads this week for him",
    body: "Releases in the IST window + his preferences, watchlist & cached AI verdicts",
    detail: {
      Trigger: "Step 6.",
      Input: "ott_releases ⋈ titles in the window, user_preferences, watchlist, viewing_feedback, ai_recommendations.",
      Context: "Preference fingerprint (genres, languages, platforms, mode, mood…) + title metadata fingerprint.",
      Processing: "Reuses a verdict only if both fingerprints still match; otherwise the title is marked unscored.",
      Output: "Catalogue items: verified flag, platforms, release type, watch status, cached verdict.",
    },
  },
  {
    actor: "Gemini Flash", sub: "Recommendation engine", kind: "external", icon: "sparkles", col: 3, color: "purple",
    title: "Scores each new title",
    body: "0–100 match, watch / maybe / skip, 2-line synopsis, reason — Zod-validated",
    detail: {
      Trigger: "Unscored titles on his platforms + languages + content types (hard constraints first).",
      Input: "His profile + TMDB metadata only (overview, genres, runtime, votes). Metadata is fenced as untrusted data.",
      Context: "gemini-3.6-flash, fallback gemini-3.5-flash when busy; low thinking; batches of 12, sequential.",
      Processing: "Structured JSON → Zod schema; rejects unknown titles and verdict/score contradictions; confidence capped by metadata completeness; no synopsis invented.",
      Output: "Verdicts saved to ai_recommendations. If Gemini fails, the catalogue still works with a retry message.",
    },
  },
  {
    actor: "Release Radar App", sub: "Digest builder", kind: "app", icon: "list-ordered", col: 3, color: "orange",
    title: "Builds the Friday digest",
    body: "Verified only, his platforms + languages, ranked by match, top 10",
    detail: {
      Trigger: "Scored items from step 8.",
      Input: "Verified releases, verdicts, watchlist / “Not interested” feedback.",
      Context: "Discovery mode: Stick = genre match only, Balanced = genre match or score ≥ 70, Surprise = any.",
      Processing: "Drops watched / not-interested, ranks by score (skips last), formats title, platform, genre, language, runtime/episodes, why, verdict, match, synopsis, TMDB link; splits under 4096 chars.",
      Output: "Telegram-ready messages (Preview shows them without sending).",
    },
  },
  {
    actor: "Telegram Bot", sub: "Delivery", kind: "external", icon: "send", col: 4, color: "yellow",
    title: "Sends the digest",
    body: "To his verified chat, once per week; resumes if half-sent",
    detail: {
      Trigger: "Weekly cron or “Send Test Digest”.",
      Input: "Chat ID verified via a one-time /start code (getUpdates) — never typed by the user.",
      Context: "digest_history idempotency key weekly:<user>:<period start>; message chunks stored.",
      Processing: "sendMessage (HTML, escaped). Records each accepted chunk; classifies blocked bot, bad chat, rate limit, network errors.",
      Output: "“sent” only when Telegram accepts every message; otherwise partial / failed with the reason.",
    },
  },
  {
    actor: "Naman", sub: "Watch decision", kind: "person", icon: "popcorn", col: 4, color: "purple",
    title: "Picks tonight’s watch",
    body: "Reads verdicts, saves to watchlist, “Pick My Next Watch” — the app suggests, he decides",
    detail: {
      Trigger: "Friday digest in Telegram or the Discover page.",
      Input: "Watch / Maybe / Skip, match score, “Why this matches you”, filters (mood, watch time, hidden gems).",
      Context: "Watchlist statuses: Want to watch · Watching · Watched · Not interested.",
      Processing: "Watchlist saved via /api/watchlist (RLS). “Not interested” becomes feedback that lowers future rankings.",
      Output: "His choice for tonight; preferences never change silently.",
    },
  },
  {
    actor: "Release Radar App", sub: "History & monitoring", kind: "app", icon: "rotate-ccw-clock", col: 4, color: "sky",
    title: "Logs & monitors",
    body: "Digest History, last sync, integration health & next run in Settings",
    detail: {
      Trigger: "Every run and delivery.",
      Input: "automation_runs, digest_history, integration_status.",
      Context: "Live health checks (TMDB /configuration, Gemini model lookup, Telegram getMe), cached 5 min.",
      Processing: "Shows preview / test sent / weekly sent / failed, last successful delivery and next scheduled run.",
      Output: "Errors visible in the app, details only in server logs.",
    },
  },
];

// ---------- Layout ----------
const W = 1600, PAD = 56, HEAD_Y = 190, HEAD_H = 56, ROW_H = 176, ACTOR_W = 330, GAP = 8;
const COL_W = (W - 2 * PAD - ACTOR_W) / 5;
const CARD_W = COL_W - 22, CARD_H = 150;
const gridTop = HEAD_Y + HEAD_H;
const gridH = steps.length * ROW_H + 10;
const pageH = gridTop + gridH + 190;

const colX = (c) => PAD + ACTOR_W + c * COL_W;
const cardBox = (i) => {
  const s = steps[i];
  return { x: colX(s.col) + 11, y: gridTop + i * ROW_H + 13, w: CARD_W, h: CARD_H };
};

// Elbow connector: down from card i, across, down into card i+1.
function connector(i) {
  const a = cardBox(i), b = cardBox(i + 1);
  const ax = a.x + a.w / 2, ay = a.y + a.h, bx = b.x + b.w / 2, by = b.y;
  const midY = ay + (by - ay) / 2;
  const d = ax === bx ? `M${ax},${ay} L${bx},${by - 9}` : `M${ax},${ay} L${ax},${midY} L${bx},${midY} L${bx},${by - 9}`;
  return `<path d="${d}" fill="none" stroke="#475569" stroke-width="2"/><path d="M${bx - 6},${by - 11} L${bx + 6},${by - 11} L${bx},${by - 1} Z" fill="#475569"/>`;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const lanes = await Promise.all(
  steps.map(async (s, i) => {
    const y = gridTop + i * ROW_H + 6;
    return `<div class="lane" style="top:${y}px;height:${ROW_H - 12}px;background:${LANE[s.kind]}">
      <div class="lane-icon">${await icon(s.icon, 26)}</div>
      <div><div class="actor">${esc(s.actor)}</div><div class="sub">${esc(s.sub)}</div></div></div>`;
  }),
);

const cards = steps
  .map((s, i) => {
    const b = cardBox(i);
    const [stroke, fill] = C[s.color];
    return `<div class="card" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;border-color:${stroke};background:${fill}">
      <div class="num" style="background:${stroke}">${i + 1}</div>
      <div class="ct">${esc(s.title)}</div><div class="cb">${esc(s.body)}</div></div>`;
  })
  .join("");

const rowsBg = steps.map((_, i) => `<div class="rowline" style="top:${gridTop + (i + 1) * ROW_H}px"></div>`).join("");
const colLines = COLS.map((_, c) => `<div class="colline" style="left:${colX(c)}px"></div>`).join("");
const header = `<div class="thead">
  <div style="width:${ACTOR_W}px">Actor / Step</div>${COLS.map((c) => `<div style="width:${COL_W}px">${c}</div>`).join("")}</div>`;

const dbIcon = await icon("database", 30, "#15803d");
const page1 = `<section class="page" style="height:${pageH}px">
  <h1>OTT Release Radar – Components Map</h1>
  <p class="subtitle">How the app works, step by step</p>
  ${header}
  <div class="grid" style="top:${gridTop}px;height:${gridH}px"></div>
  ${colLines}${rowsBg}${lanes.join("")}
  <svg class="arrows" width="${W}" height="${pageH}">${steps.slice(0, -1).map((_, i) => connector(i)).join("")}</svg>
  ${cards}
  <div class="note" style="top:${gridTop + gridH + 40}px">
    ${dbIcon}
    <div><div class="nt">Supabase keeps the catalogue, preferences, AI verdicts &amp; delivery logs</div>
    <div class="nb">(steps 4, 5, 7 &amp; 10) · per-user rows locked by Row Level Security · AI verdicts are reused until the title or his preferences change</div></div>
  </div>
  <p class="foot" style="top:${gridTop + gridH + 150}px">OTT Release Radar · Next.js on Vercel · TMDB live data · Gemini Flash recommends — Naman decides</p>
</section>`;

const detailRows = steps
  .map((s, i) => {
    const [stroke] = C[s.color];
    return `<tr><td class="dn"><span style="background:${stroke}">${i + 1}</span></td>
      <td class="da"><b>${esc(s.actor)}</b><br><i>${esc(s.sub)}</i><div class="dt">${esc(s.title)}</div></td>
      ${COLS.map((c) => `<td>${esc(s.detail[c])}</td>`).join("")}</tr>`;
  })
  .join("");

const page2 = `<section class="page detail">
  <h1>Step details</h1>
  <p class="subtitle">Every process in the map, under the same headers</p>
  <table><thead><tr><th>#</th><th>Actor / Step</th>${COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${detailRows}</tbody></table>
  <div class="legend">
    <span><i style="background:${LANE.person}"></i>Person</span>
    <span><i style="background:${LANE.scheduler}"></i>Scheduler / trigger</span>
    <span><i style="background:${LANE.app}"></i>Release Radar app (Next.js on Vercel)</span>
    <span><i style="background:${LANE.store}"></i>Supabase (Postgres + Auth)</span>
    <span><i style="background:${LANE.external}"></i>External API (TMDB · Gemini · Telegram)</span>
  </div>
  <p class="foot2">Live app: ott-release-radar-eight.vercel.app · Code: github.com/salonimesa29/ott-release-radar · Known limit: TMDB has no “date added to Netflix India” field, so unverified dates are shown but never sent in the digest.</p>
</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>OTT Release Radar – Components Map</title>
<style>
@page { size: ${W}px ${pageH}px; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Inter, system-ui, sans-serif; color: #1f2937; background: #fff; }
.page { position: relative; width: ${W}px; page-break-after: always; overflow: hidden; }
h1 { position: absolute; left: ${PAD}px; top: 40px; margin: 0; font-size: 46px; font-weight: 700; color: #111827; letter-spacing: -0.5px; }
.subtitle { position: absolute; left: ${PAD}px; top: 112px; margin: 0; font-size: 22px; font-style: italic; color: #6b7280; }
.thead { position: absolute; left: ${PAD}px; top: ${HEAD_Y}px; height: ${HEAD_H}px; width: ${W - 2 * PAD}px; background: #1e293b; border-radius: 14px 14px 0 0; display: flex; color: #fff; font-weight: 700; font-size: 20px; }
.thead > div { display: flex; align-items: center; justify-content: center; border-right: 1px solid #334155; }
.thead > div:last-child { border-right: 0; }
.grid { position: absolute; left: ${PAD}px; width: ${W - 2 * PAD}px; background: #f8fafc; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 14px 14px; }
.colline { position: absolute; top: ${gridTop}px; height: ${gridH}px; border-left: 1px solid #e5e7eb; }
.rowline { position: absolute; left: ${PAD + ACTOR_W}px; width: ${W - 2 * PAD - ACTOR_W}px; border-top: 1px solid #eef0f3; }
.lane { position: absolute; left: ${PAD + GAP}px; width: ${ACTOR_W - 2 * GAP}px; border-radius: 12px; display: flex; align-items: center; gap: 22px; padding-left: 30px; }
.lane-icon { display: flex; }
.actor { font-size: 21px; font-weight: 700; color: #111827; }
.sub { font-size: 17px; font-style: italic; color: #6b7280; margin-top: 4px; }
.arrows { position: absolute; left: 0; top: 0; }
.card { position: absolute; border: 2.5px solid; border-radius: 12px; padding: 16px 18px; }
.num { position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; }
.ct { font-size: 17px; font-weight: 700; color: #111827; line-height: 1.25; }
.cb { font-size: 14px; color: #4b5563; line-height: 1.38; margin-top: 6px; }
.note { position: absolute; left: ${PAD + ACTOR_W + COL_W * 1.85}px; width: ${COL_W * 3.1}px; border: 2.5px solid #22c55e; background: #f0fdf4; border-radius: 12px; padding: 18px 24px; display: flex; gap: 20px; align-items: center; }
.nt { font-size: 18px; font-weight: 700; color: #14532d; }
.nb { font-size: 15px; color: #4b5563; margin-top: 4px; }
.foot { position: absolute; left: ${PAD}px; margin: 0; font-size: 16px; font-style: italic; color: #6b7280; }
.detail { padding: 0 ${PAD}px 60px; }
.detail h1, .detail .subtitle { position: static; }
.detail h1 { padding-top: 40px; }
.detail .subtitle { margin: 8px 0 28px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 16.5px; line-height: 1.55; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
th { background: #1e293b; color: #fff; font-size: 17px; padding: 14px 12px; text-align: left; }
td { padding: 18px 14px; vertical-align: top; border-top: 1px solid #eef0f3; color: #374151; }
tr:nth-child(even) td { background: #f8fafc; }
td.dn { width: 46px; } td.dn span { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; color: #fff; font-weight: 700; align-items: center; justify-content: center; }
td.da { width: 230px; } td.da i { color: #6b7280; } .dt { margin-top: 6px; font-weight: 600; color: #111827; }
.legend { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 24px; font-size: 15px; color: #374151; }
.legend i { display: inline-block; width: 18px; height: 18px; border-radius: 4px; vertical-align: -3px; margin-right: 8px; border: 1px solid #d1d5db; }
.foot2 { margin-top: 18px; font-size: 14px; font-style: italic; color: #6b7280; }
</style></head><body>${page1}${page2}</body></html>`;

writeFileSync(join(here, "components-map.html"), html);
console.log("written", join(here, "components-map.html"), "page1 height", pageH);
