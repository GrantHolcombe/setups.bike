// Cloudflare Worker "setups-share-preview", route setups.bike/*
//
// Gives shared setup links (https://setups.bike/?s=<id>) their own link preview. Crawlers
// (iMessage, Slack, Facebook, X) read the page's <title> and og:/twitter: tags without running
// the app, so for those links this fetches index.html from S3 as normal and rewrites the tags
// with the bike's name and settings. Everything else passes straight through untouched, and
// any error falls back to the normal page. Only public fields are used (brand, model, setup
// name, settings), never the owner's name or email.
//
// It also serves QR short links: https://setups.bike/q/<code> redirects (302) to the campaign
// link in QR_CODES below, so a printed QR code keeps working if the destination changes. Unknown
// codes go to the home page, never a 404. If a KV namespace is bound as QR_SCANS, each scan adds
// one to "scan:<code>:<YYYY-MM-DD>" (read them in the dashboard: Workers KV > QR_SCANS).
//
// It also limits the website to North America (US, Canada, Mexico) until the legal review covers
// GDPR: visitors from anywhere else get a short branded page instead of the app (see geoBlock).
// The API, Stripe and Resend webhooks don't go through Cloudflare, so they're unaffected.
//
// Deploy: paste this file into the Worker in the Cloudflare dashboard (Workers & Pages) and
// click Deploy. It doesn't go through CodePipeline.

const API = "https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/sharedSetups";
const SHARE_ID = /^[A-Za-z0-9_-]{16,32}$/;

// Printed QR codes: /q/<code> -> where it goes today. Add a line per sticker or shop; never
// remove a code that has been printed (point it somewhere else instead).
const QR_CODES = {
  trailhead: "/?utm_source=sticker&utm_medium=qr&utm_campaign=trailhead",
};

// --- North America only (card: "Limit setups.bike to North America") ---------------------------
// To lift it once GDPR is covered: set GEO_LIMIT to false and deploy.
const GEO_LIMIT = true;
const ALLOWED_COUNTRIES = new Set(["US", "CA", "MX"]);
// Still served to blocked visitors: the legal pages, robots.txt, what the blocked page shows, and
// the BIMI logo (mail providers anywhere fetch it to show our logo next to emails).
const OPEN_PATHS = /^\/(privacy\.html|terms\.html|refunds\.html|robots\.txt|favicon\.ico|img\/logos\/|bimi\/)/;
// Search and link-preview crawlers, let through from any country so search listings and share
// previews keep working. The user agent can be faked, but that only gets someone what a VPN
// would; the point is to show we don't offer the service outside North America.
const CRAWLERS = /googlebot|google-inspectiontool|bingbot|duckduckbot|applebot|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|pinterest|redditbot|embedly/i;

// The blocked page, or null to carry on. request.cf.country is Cloudflare's guess from the IP;
// when it's missing (local tests) or unknown ("XX"), the visitor is let through rather than
// shown a wrong refusal. Tor ("T1") is treated like any other country outside the list.
export function geoBlock(request, url) {
  if (!GEO_LIMIT) return null;
  // Testing aid, only on the Worker's own workers.dev address: ?geo=DE pretends to be Germany.
  const testCountry = url.hostname.endsWith(".workers.dev") ? url.searchParams.get("geo") : null;
  const country = (testCountry || (request.cf && request.cf.country) || "").toUpperCase();
  if (!country || country === "XX" || ALLOWED_COUNTRIES.has(country)) return null;
  if (OPEN_PATHS.test(url.pathname)) return null;
  if (CRAWLERS.test(request.headers.get("user-agent") || "")) return null;
  console.log("geo blocked", country);
  return new Response(BLOCKED_PAGE, {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

// Self-contained (no app JS); colors follow docs/STYLE_GUIDE.md in light and dark.
const BLOCKED_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#daa520">
<title>Setups.Bike: not available in your country yet</title>
<style>
  :root { --bg: #ffffff; --text: #1c1c1c; --muted: #5f5f5f; --link: #8a6514; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #ececec; --muted: #b0b0b0; --link: #daa530; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
  header { background: goldenrod; height: 150px; }
  header img { display: block; width: 120px; height: 120px; margin: 15px; border-radius: 8px; background: #ff0000; }
  main { max-width: 480px; margin: 0 auto; padding: 32px 16px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin: 0 0 12px; }
  p { margin: 0 0 12px; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  a { color: var(--link); }
  @media (max-width: 600px) { header img { margin: 15px auto; } }
</style>
</head>
<body>
<header><img src="/img/logos/setups-logo.svg" alt="Setups.Bike" width="120" height="120"></header>
<main>
  <h1>Setups.Bike isn't available in your country yet</h1>
  <p>For now Setups.Bike is only open to riders in the United States, Canada and Mexico. We'd love
  to bring it to more places, and we're working on it.</p>
  <p class="muted">If you're in one of those countries and seeing this (on a VPN, for example),
  turn the VPN off and reload. <a href="/privacy.html">Privacy Policy</a> &middot;
  <a href="/terms.html">Terms</a></p>
</main>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const blocked = geoBlock(request, url);
    if (blocked) return blocked;
    if (url.pathname.startsWith("/q/")) return qrRedirect(url, env, ctx);
    const id = url.searchParams.get("s");
    if (request.method !== "GET" || url.pathname !== "/" || !id || !SHARE_ID.test(id)) {
      return fetch(request);
    }

    // On the setups.bike route this is the S3 site itself. On the Worker's own workers.dev
    // address (used for testing) it fetches the live site instead of calling itself.
    const page = await fetch(url.hostname === "setups.bike" ? request : `https://setups.bike/${url.search}`);
    try {
      if (!page.ok || !(page.headers.get("content-type") || "").includes("text/html")) return page;
      const share = await lookUp(id);
      if (!share) return page; // removed or unknown link: the generic preview
      return withTags(page, previewText(share), `https://setups.bike/?s=${id}`);
    } catch (err) {
      console.log("share preview failed", String(err));
      return page;
    }
  },
};

// /q/<code>: a 302 to the code's campaign link (or the home page), counting the scan if the
// QR_SCANS KV namespace is bound. Counting never delays or breaks the redirect.
function qrRedirect(url, env, ctx) {
  let code = url.pathname.slice(3);
  try { code = decodeURIComponent(code); } catch { /* malformed %-escape: treat as unknown */ }
  code = code.replace(/\/+$/, "").toLowerCase();
  const target = QR_CODES[code];
  if (target && env && env.QR_SCANS && ctx) {
    const key = `scan:${code}:${new Date().toISOString().slice(0, 10)}`;
    ctx.waitUntil(
      env.QR_SCANS.get(key)
        .then((n) => env.QR_SCANS.put(key, String((Number(n) || 0) + 1)))
        .catch((err) => console.log("qr scan not counted", String(err)))
    );
  }
  console.log("qr", target ? code : `unknown:${code.slice(0, 40)}`);
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(target || "/", "https://setups.bike").toString(), "Cache-Control": "no-store" },
  });
}

// The share's public fields, or null. Uses the Lambda's "preview" action, which doesn't count
// as a view. Gives up after 3 seconds so a slow API never holds up the page.
async function lookUp(id) {
  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({ action: "preview", shareId: id }),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return null;
  return (await res.json()).share || null;
}

const num = (v) => Number(v) || 0;

// "LSC 4 / HSC 6", only for the adjusters the bike has (None / Single / Dual)
function adjusters(s, prefix, kind) {
  const count = Math.min(2, Math.max(0, num(s[`${prefix}count`])));
  if (count === 0) return null;
  const parts = [`LS${kind} ${num(s[`${prefix}1`])}`];
  if (count === 2) parts.push(`HS${kind} ${num(s[`${prefix}2`])}`);
  return parts.join(" / ");
}

function end(s, which) {
  const sus = which === "front" ? "fork" : "shock";
  const parts = [`tire ${num(s[`${which}_tire`])}`, `${sus} ${num(s[`${which}_sus_pressure`])}`];
  const comp = adjusters(s, `${which}_sus_comp_`, "C");
  const reb = adjusters(s, `${which}_sus_rebound_`, "R");
  if (comp) parts.push(comp);
  if (reb) parts.push(reb);
  if (num(s[`${which}_tokens`])) parts.push(`${num(s[`${which}_tokens`])} tokens`);
  return `${which === "front" ? "Front" : "Rear"}: ${parts.join(", ")}`;
}

export function previewText(share) {
  const bike = `${share.brand || ""} ${share.model || ""}`.trim() || "A bike";
  const title = share.setup_name
    ? `${bike}: "${share.setup_name}" setup on Setups.Bike`
    : `${bike} setup on Setups.Bike`;
  const s = share.settings || {};
  const description = `${end(s, "front")}. ${end(s, "rear")}. Shared by a rider on Setups.Bike; copy it to your own garage.`;
  return { title, description };
}

function withTags(page, { title, description }, shareUrl) {
  const content = (value) => ({ element: (el) => el.setAttribute("content", value) });
  return new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', content(description))
    .on('meta[property="og:title"]', content(title))
    .on('meta[property="og:description"]', content(description))
    .on('meta[property="og:url"]', content(shareUrl))
    .on('meta[name="twitter:title"]', content(title))
    .on('meta[name="twitter:description"]', content(description))
    .transform(page);
}
