// Cloudflare Worker "setups-share-preview", route setups.bike/*
//
// Gives shared setup links (https://setups.bike/?s=<id>) their own link preview. Crawlers
// (iMessage, Slack, Facebook, X) read the page's <title> and og:/twitter: tags without running
// the app, so for those links this fetches index.html from S3 as normal and rewrites the tags
// with the bike's name and settings. Everything else passes straight through untouched, and
// any error falls back to the normal page. Only public fields are used (brand, model, setup
// name, settings), never the owner's name or email.
//
// Deploy: paste this file into the Worker in the Cloudflare dashboard (Workers & Pages) and
// click Deploy. It doesn't go through CodePipeline.

const API = "https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/sharedSetups";
const SHARE_ID = /^[A-Za-z0-9_-]{16,32}$/;

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
