import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the local app (npm start) against the live API and database, signed in as
// the comped Pro test account. See e2e/README.md. Run with `npm run e2e`.
export default defineConfig({
  testDir: './e2e',
  // every test uses the same test account, so run them one at a time
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'e2e/.auth/session.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // a phone-sized smoke test (the full flow runs on desktop only)
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { BROWSER: 'none' },
  },
});
