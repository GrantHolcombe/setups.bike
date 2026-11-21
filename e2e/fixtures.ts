import { test as base, expect } from '@playwright/test';

// Every browser test fails if the page logs a console error or warning, or throws an
// uncaught exception. React and MUI report real bugs this way (bad props, missing keys,
// accessibility problems), so they get fixed instead of piling up. Add a pattern to
// IGNORED only for noise we can't fix, with a comment saying why.
const IGNORED: RegExp[] = [
  // React's development-mode hint (npm start only, never in the production build)
  /Download the React DevTools/,
  // Chrome's note that we called preventDefault() on beforeinstallprompt: on purpose, so the
  // menu can offer its own "Install App" item instead of Chrome's automatic banner (src/pwa.ts)
  /Banner not shown: beforeinstallpromptevent/,
  // Google's sign-in popup script polling window.closed under Google's own COOP header
  // (accounts.google.com); harmless, and not something this app can change
  /Cross-Origin-Opener-Policy policy would block the window\.closed call/,
];

export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [async ({ page }, use, testInfo) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      const text = msg.text();
      if (IGNORED.some((re) => re.test(text))) return;
      problems.push(`[console.${msg.type()}] ${text.split('\n')[0].slice(0, 300)}`);
    });
    page.on('pageerror', (err) => problems.push(`[uncaught] ${err.message.slice(0, 300)}`));
    await use(problems);
    if (problems.length) {
      await testInfo.attach('console-problems', { body: problems.join('\n'), contentType: 'text/plain' });
    }
    expect(problems, 'browser console errors/warnings during this test').toEqual([]);
  }, { auto: true }],
});

export { expect };
