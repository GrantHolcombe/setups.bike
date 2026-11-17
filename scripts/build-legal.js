// Renders legal/templates/*.html into public/*.html using legal/site.config.json.
// Runs before `npm start` and `npm run build`, so the pages always use the current config.
// Stops with an error if a value is still TODO or a template uses an unknown {{key}},
// so placeholders never reach the live site.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'legal', 'site.config.json');
const templateDir = path.join(root, 'legal', 'templates');
const outDir = path.join(root, 'public');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const todo = Object.entries(config).filter(([k, v]) => !k.startsWith('_') && (v === '' || /TODO/i.test(String(v))));
if (todo.length) {
  console.error(`build-legal: fill these in legal/site.config.json first: ${todo.map(([k]) => k).join(', ')}`);
  process.exit(1);
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pages = { terms: 'Terms of Service', privacy: 'Privacy Policy', refunds: 'Refund Policy' };
const nav = Object.entries(pages).map(([file, title]) => `<a href="${file}.html">${title}</a>`).join(' · ');

const layout = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | ${escape(config.appName)}</title>
<link rel="icon" href="favicon.ico">
<style>
  :root { --accent: #daa530; --text: #1f1f1f; --muted: #666; --bg: #fff; --line: #e6e6e6; }
  @media (prefers-color-scheme: dark) { :root { --text: #eaeaea; --muted: #a0a0a0; --bg: #161616; --line: #2c2c2c; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
  header { border-bottom: 3px solid var(--accent); padding: 14px 16px; }
  header a { color: var(--text); font-weight: 700; text-decoration: none; }
  h1 { margin: 8px 0 4px; } h2 { margin-top: 28px; font-size: 1.2rem; }
  .meta { color: var(--muted); margin-top: 0; }
  a { color: var(--accent); } li { margin: 6px 0; }
  footer { border-top: 1px solid var(--line); margin-top: 40px; padding-top: 16px; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<header><a href="${escape(config.siteUrl)}">${escape(config.appName)}</a></header>
<main>
${body}
<footer>${nav}<br>Contact: <a href="mailto:${escape(config.supportEmail)}">${escape(config.supportEmail)}</a></footer>
</main>
</body>
</html>
`;

for (const [file, title] of Object.entries(pages)) {
  const template = fs.readFileSync(path.join(templateDir, `${file}.html`), 'utf8');
  const body = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in config)) {
      console.error(`build-legal: ${file}.html uses {{${key}}}, which isn't in site.config.json`);
      process.exit(1);
    }
    return escape(config[key]);
  });
  fs.writeFileSync(path.join(outDir, `${file}.html`), layout(title, body));
}
console.log(`build-legal: wrote ${Object.keys(pages).map((p) => `public/${p}.html`).join(', ')}`);
