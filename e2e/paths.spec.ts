import { test, expect } from './fixtures';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import {
  API, TEST_BRAND, appMenu, bikeCard, openGarage, removeTestBikes, sessionToken, setSetting, waitIdle,
} from './helpers';

// The UI paths garage.spec.ts doesn't walk through: the signed-out landing page, every adjuster
// and token control, the rest of saved setups (update, rename, delete, the unsaved-changes
// prompt, switching with an edit still pending), ride ratings and conditions, and logging out.
// Each test makes its own throwaway bike through the API (brand "E2E Test") and they're all
// deleted afterwards. Like every browser test, any console error fails it (fixtures.ts).
test.describe.configure({ mode: 'serial' });

let token: string;
const stamp = Date.now().toString(36);

test.beforeAll(async ({ request }) => {
  token = sessionToken();
  await removeTestBikes(request, token);
});
test.afterAll(async ({ request }) => {
  if (token) await removeTestBikes(request, token);
});

async function addBike(request: APIRequestContext, model: string, settings: Record<string, number> = {}) {
  const add = await request.post(`${API}/AddBike?${new URLSearchParams({ token, brand: TEST_BRAND, model })}`);
  expect(add.status()).toBe(200);
  const bikes = await (await request.get(`${API}/getBikes`, { params: { token } })).json();
  const bike = bikes.find((b: any) => b.brand === TEST_BRAND && b.model === model);
  if (Object.keys(settings).length) {
    const params = new URLSearchParams({ bike_id: String(bike.bike_id), token });
    for (const [k, v] of Object.entries(settings)) params.set(k, String(v));
    expect((await request.post(`${API}/updateBike?${params}`)).status()).toBe(200);
  }
  return bike.bike_id as number;
}

const value = (page: Page, model: string, name: string) => bikeCard(page, model).locator(`input[name="${name}"]`);

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the landing page explains the app and offers sign-in', async ({ page }) => {
    await page.goto('/?utm_source=sticker&utm_medium=qr&utm_campaign=trailhead');
    await expect(page.getByRole('heading', { level: 1, name: /saved for every bike/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What it remembers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free and Pro' })).toBeVisible();
    await expect(page.getByRole('button', { name: /clip in/i })).toHaveCount(2);
    await expect(page.getByText('Google account required.').first()).toBeVisible();
    await expect(page.getByRole('img', { name: /bike card in Setups\.Bike/ })).toBeVisible();
    for (const name of ['Terms', 'Privacy', 'Refunds']) await expect(page.getByRole('link', { name })).toBeVisible();
    // the campaign tags stay in the address (sign-up source tracking reads them from there)
    expect(page.url()).toContain('utm_source=sticker');
  });
});

test('adjusters and tokens: every control saves and survives a reload', async ({ page, request }) => {
  const model = `Adjusters ${stamp}`;
  await addBike(request, model);
  await openGarage(page);
  const card = bikeCard(page, model);

  await test.step('front compression: Dual, with both values', async () => {
    await card.getByRole('button', { name: 'Compression adjusters' }).first().click();
    await page.getByRole('menuitem', { name: 'Dual' }).click();
    await setSetting(page, model, 'front_sus_comp_1', 4);
    await setSetting(page, model, 'front_sus_comp_2', 8);
  });
  await test.step('rear rebound: Single', async () => {
    await card.getByRole('button', { name: 'Rebound adjusters' }).last().click();
    await page.getByRole('menuitem', { name: 'Single' }).click();
    await setSetting(page, model, 'rear_sus_rebound_1', 9);
  });
  await test.step('tokens: +2 front, +1 -1 rear', async () => {
    const front = card.getByRole('group', { name: 'Token count' }).first();
    const rear = card.getByRole('group', { name: 'Token count' }).last();
    await front.getByRole('button', { name: 'Add a token' }).click();
    await front.getByRole('button', { name: 'Add a token' }).click();
    await rear.getByRole('button', { name: 'Add a token' }).click();
    await rear.getByRole('button', { name: 'Remove a token' }).click();
    await expect(front).toContainText('Token Count (2)');
    await expect(rear).toContainText('Token Count (0)');
    await expect(rear.getByRole('button', { name: 'Remove a token' })).toBeDisabled();
  });
  await expect(card.getByRole('status')).toHaveText('Saved');

  await test.step('everything is still there after a reload', async () => {
    await openGarage(page);
    await expect(value(page, model, 'front_sus_comp_1')).toHaveValue('4');
    await expect(value(page, model, 'front_sus_comp_2')).toHaveValue('8');
    await expect(value(page, model, 'rear_sus_rebound_1')).toHaveValue('9');
    await expect(value(page, model, 'rear_sus_rebound_2')).toHaveCount(0);
    await expect(value(page, model, 'front_sus_rebound_1')).toHaveCount(0); // never set: None
    await expect(card.getByRole('group', { name: 'Token count' }).first()).toContainText('Token Count (2)');
  });
  await test.step('setting compression back to None hides its values, and that saves too', async () => {
    await card.getByRole('button', { name: 'Compression adjusters' }).first().click();
    await page.getByRole('menuitem', { name: 'None' }).click();
    await expect(value(page, model, 'front_sus_comp_1')).toHaveCount(0);
    await expect(card.getByRole('status')).toHaveText('Saved');
    await openGarage(page);
    await expect(value(page, model, 'front_sus_comp_1')).toHaveCount(0);
  });
  await test.step('the page stays put while an adjuster menu is open', async () => {
    await card.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await card.getByRole('button', { name: 'Rebound adjusters' }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Dual' })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await page.keyboard.press('Escape');
  });
});

test('saved setups: update, rename, unsaved-changes prompt, pending edits, delete', async ({ page, request }) => {
  const model = `Setups ${stamp}`;
  await addBike(request, model, { front_tire: 20 });
  await openGarage(page);
  const card = bikeCard(page, model);
  const picker = card.locator('.setupPicker button');
  const saveAs = async (name: string) => {
    await picker.click();
    await page.getByRole('menuitem', { name: /Save current settings as new setup/ }).click();
    const d = page.getByRole('dialog', { name: 'Save as new setup' });
    await d.getByLabel('Setup name').fill(name);
    await d.getByRole('button', { name: 'Save' }).click();
    await waitIdle(page);
  };

  await test.step('save, edit, then update the setup with the new value', async () => {
    await saveAs('Dry');
    await expect(picker).toHaveText('Dry');
    await setSetting(page, model, 'front_tire', 25);
    await expect(picker).toHaveText('Dry (edited)');
    await picker.click();
    await page.getByRole('menuitem', { name: 'Update "Dry" with current settings' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Dry');
  });
  await test.step('rename it', async () => {
    await picker.click();
    await page.getByRole('menuitem', { name: 'Rename "Dry"…' }).click();
    const d = page.getByRole('dialog', { name: 'Rename setup' });
    await d.getByLabel('Setup name').fill('Dry fast');
    await d.getByRole('button', { name: 'Rename' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Dry fast');
  });
  await test.step('a second setup', async () => {
    await setSetting(page, model, 'front_tire', 30);
    await saveAs('Wet');
    await expect(picker).toHaveText('Wet');
  });
  await test.step('unsaved settings: switching asks first ("Save first" and "Switch anyway")', async () => {
    await setSetting(page, model, 'front_tire', 33);
    await expect(card.getByRole('status')).toHaveText('Saved');
    await picker.click();
    await page.getByRole('menuitem', { name: 'Dry fast', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Switch to "Dry fast"?' });
    await confirm.getByRole('button', { name: 'Save first' }).click();
    await expect(page.getByRole('dialog', { name: 'Save as new setup' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Save as new setup' }).getByRole('button', { name: 'Cancel' }).click();
    await picker.click();
    await page.getByRole('menuitem', { name: 'Dry fast', exact: true }).click();
    await confirm.getByRole('button', { name: 'Switch anyway' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Dry fast');
    await expect(value(page, model, 'front_tire')).toHaveValue('25');
  });
  await test.step('switching while an edit is still being typed (not yet saved)', async () => {
    const input = value(page, model, 'front_tire');
    await input.click();
    await input.fill('30'); // matches "Wet", so no prompt; the pending save is sent first
    await picker.click();
    await page.getByRole('menuitem', { name: 'Wet', exact: true }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Wet');
    await expect(input).toHaveValue('30');
    await openGarage(page);
    await expect(value(page, model, 'front_tire')).toHaveValue('30');
    await expect(card.locator('.setupPicker button')).toHaveText('Wet');
  });
  await test.step('delete a setup', async () => {
    await picker.click();
    await page.getByRole('menuitem', { name: 'Delete "Wet"…' }).click();
    await page.getByRole('dialog', { name: 'Delete "Wet"?' }).getByRole('button', { name: 'Delete' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Choose a setup');
    await picker.click();
    await expect(page.getByRole('menuitem', { name: 'Wet', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Dry fast', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test('ride notes: rating and conditions are saved with the ride', async ({ page, request }) => {
  const model = `Rides ${stamp}`;
  await addBike(request, model, { front_tire: 22 });
  await openGarage(page);
  const card = bikeCard(page, model);

  await card.getByRole('button', { name: 'Log ride' }).click();
  const log = page.getByRole('dialog', { name: 'Log a ride' });
  await log.getByRole('button', { name: 'Wet' }).click();
  await log.getByRole('button', { name: 'Wet' }).click(); // tapping again clears it
  await log.getByRole('button', { name: 'Muddy' }).click();
  // MUI's Rating hides its radio inputs; click the visible star (the input's label) like a rider would
  const fourStars = await log.getByRole('radio', { name: '4 Stars' }).getAttribute('id');
  await log.locator(`label[for="${fourStars}"]`).click();
  await expect(log.getByRole('radio', { name: '4 Stars' })).toBeChecked();
  await log.getByLabel('Notes').fill('Slid around on roots');
  await log.getByRole('button', { name: 'Log ride' }).click();

  const history = page.getByRole('dialog', { name: `Rides · ${model}` });
  await expect(history.getByText('Slid around on roots')).toBeVisible();
  await expect(history.getByText('Muddy')).toBeVisible();
  await expect(history.getByText('Wet', { exact: true })).toHaveCount(0);
  await expect(history.getByRole('img', { name: '4 Stars' })).toBeVisible();
  await history.getByRole('button', { name: 'Settings' }).click();
  await expect(history.getByText('22').first()).toBeVisible();
  await history.getByRole('button', { name: 'Close' }).click();
});

test('email preferences: the menu switch saves, and the one-time prompt saves an answer', async ({ page }) => {
  sessionToken();
  await openGarage(page);
  const openPrefs = async () => {
    await appMenu(page, 'Email preferences');
    return page.getByRole('dialog', { name: 'Email preferences' });
  };
  // flip the switch, check it saved through a reload, then put it back how it was. The test
  // account is synced to Resend like any user (Grant may keep it ON as a test inbox), so the
  // test must leave it in the state it found it.
  const sw = (d: Locator) => d.getByRole('switch', { name: 'News and offers by email' });
  let dialog = await openPrefs();
  const startedOn = await sw(dialog).isChecked();
  await sw(dialog).click();
  await expect(sw(dialog)).toBeChecked({ checked: !startedOn });
  await expect(sw(dialog)).toBeEnabled(); // saved
  await dialog.getByRole('button', { name: 'Done' }).click();
  await openGarage(page);
  dialog = await openPrefs();
  await expect(sw(dialog)).toBeChecked({ checked: !startedOn });
  await sw(dialog).click(); // back to how it started
  await expect(sw(dialog)).toBeChecked({ checked: startedOn });
  await expect(sw(dialog)).toBeEnabled();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // a never-asked account (faked in the account response) sees the prompt; "No thanks" saves off
  await page.route('**/test/account?**', async (route) => {
    try {
      const res = await route.fetch();
      const json = { ...(await res.json()), marketingEmails: null };
      await route.fulfill({ status: res.status(), headers: res.headers(), json });
    } catch {
      // the page moved on before the real response arrived; nothing to fake
    }
  });
  await openGarage(page);
  const prompt = page.getByText('Want news from Setups.Bike?');
  await expect(prompt).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().endsWith('/emailPrefs') && r.request().method() === 'POST');
  // answer the way the account already is, so the run leaves it unchanged
  await page.getByRole('button', { name: startedOn ? 'Yes please' : 'No thanks' }).click();
  const res = await saved;
  expect(res.status()).toBe(200);
  expect(JSON.parse(res.request().postData() || '{}')).toMatchObject({ action: 'set', on: startedOn, via: 'prompt' });
  await expect(prompt).toHaveCount(0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('logging out returns to the landing page and stays signed out', async ({ page }) => {
  sessionToken();
  await openGarage(page);
  await appMenu(page, 'Logout');
  await expect(page.getByRole('heading', { level: 1, name: /saved for every bike/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /saved for every bike/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toHaveCount(0);
});
