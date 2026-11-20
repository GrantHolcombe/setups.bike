// One-time sign-in for the end-to-end tests. Opens Chrome on the local app; sign in with the
// test Google account and the app session is saved to e2e/.auth/session.json (git-ignored).
// Re-run when the tests say the session has expired (app tokens last 7 days).
//
//   npm start            (in another terminal, or let this wait for it)
//   npm run e2e:login
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const APP = 'http://localhost:3000';
const AUTH_DIR = 'e2e/.auth';
const SESSION_KEY = 'setupsBikeSession';

mkdirSync(AUTH_DIR, { recursive: true });

// A persistent profile keeps the Google sign-in between runs, so next week it's one click.
// Real Chrome without the automation banner, because Google refuses sign-in in obvious bots.
const context = await chromium.launchPersistentContext(`${AUTH_DIR}/chrome-profile`, {
  channel: 'chrome',
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = context.pages()[0] || (await context.newPage());
await page.goto(APP);

console.log('Sign in with the test Google account in the Chrome window ("Clip in")...');
await page.waitForFunction((key) => !!localStorage.getItem(key), SESSION_KEY, { timeout: 5 * 60_000, polling: 1000 });

const email = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).profile?.email, SESSION_KEY);
await context.storageState({ path: `${AUTH_DIR}/session.json` });
console.log(`Saved the session for ${email} to ${AUTH_DIR}/session.json`);
await context.close();
