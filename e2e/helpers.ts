import { expect, Page, APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

export const API = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test';
const SESSION_FILE = 'e2e/.auth/session.json';
// Grant's real account. The tests add and delete bikes, so they never run as it.
const PROTECTED_USER_IDS = [1];
// Every bike the tests make uses this brand, so leftovers from a failed run are easy to find.
export const TEST_BRAND = 'E2E Test';

// The app token from the saved session, after checking it's usable and not a real account.
export function sessionToken(): string {
  if (!existsSync(SESSION_FILE)) throw new Error('No saved session. Run `npm run e2e:login` first.');
  const state = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  const item = state.origins?.flatMap((o: any) => o.localStorage).find((i: any) => i.name === 'setupsBikeSession');
  if (!item) throw new Error('Saved session has no app sign-in. Run `npm run e2e:login` again.');
  const { token } = JSON.parse(item.value);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  if (payload.exp * 1000 < Date.now() + 5 * 60_000) {
    throw new Error('The saved session has expired. Run `npm run e2e:login` again.');
  }
  if (PROTECTED_USER_IDS.includes(Number(payload.app_user_id))) {
    throw new Error('The saved session is a real account. Sign in with the test account instead.');
  }
  return token;
}

// Deletes any bikes a test made (brand TEST_BRAND), straight through the API.
export async function removeTestBikes(request: APIRequestContext, token: string) {
  const res = await request.get(`${API}/getBikes`, { params: { token } });
  expect(res.status()).toBe(200);
  const ids = (await res.json()).filter((b: any) => b.brand === TEST_BRAND).map((b: any) => b.bike_id);
  if (ids.length === 0) return;
  const del = await request.post(`${API}/DeleteBike`, { data: { token, deleteList: ids } });
  expect(del.status()).toBe(200);
}

// Waits for the full-screen loading spinner to go away.
export async function waitIdle(page: Page) {
  await expect(page.locator('div[role="status"][aria-live="polite"]')).toHaveCount(0, { timeout: 30_000 });
}

// Opens the garage and waits for it to load.
export async function openGarage(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await waitIdle(page);
}

export function bikeCard(page: Page, model: string) {
  return page.locator('.cardContainer').filter({ has: page.locator('.modelHeader', { hasText: model }) });
}

// Opens the red bike menu in the header and picks an item.
export async function appMenu(page: Page, item: string) {
  await page.getByTestId('PedalBikeIcon').click();
  await page.getByRole('menuitem', { name: item }).click();
}

// Types a value into a setting and leaves the field, which saves it.
export async function setSetting(page: Page, model: string, name: string, value: number) {
  const input = bikeCard(page, model).locator(`input[name="${name}"]`);
  await input.click();
  await input.fill(String(value));
  await input.blur();
}
