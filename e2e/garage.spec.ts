import { test, expect } from './fixtures';
import {
  TEST_BRAND, appMenu, bikeCard, openGarage, removeTestBikes, sessionToken, setSetting, waitIdle,
} from './helpers';

// The whole signed-in flow on one throwaway bike, against the live API and database:
// add, edit, saved setups, ride notes, sharing (and copying a share), reorder, retire.
// It reads and writes every app table, so it also proves the Lambdas' database role
// (setupsbike_app) has the grants it needs.
test.describe.configure({ mode: 'serial' });

let token: string;
const model = `Bike ${Date.now().toString(36)}`;

test.beforeAll(async ({ request }) => {
  token = sessionToken();
  await removeTestBikes(request, token); // leftovers from a run that failed part-way
});

test.afterAll(async ({ request }) => {
  if (token) await removeTestBikes(request, token);
});

test('full garage flow', async ({ page, browser }) => {
  const card = () => bikeCard(page, model).first();

  await test.step('load the garage', async () => {
    await openGarage(page);
  });

  await test.step('add a bike', async () => {
    await appMenu(page, 'Add a New Bike');
    const dialog = page.getByRole('dialog', { name: 'Add a bike' });
    await dialog.getByLabel('Brand').fill(TEST_BRAND);
    await dialog.getByLabel('Model').fill(model);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await waitIdle(page);
    await expect(card()).toBeVisible();
  });

  await test.step('edit settings, and they survive a reload', async () => {
    await setSetting(page, model, 'front_tire', 27);
    await setSetting(page, model, 'rear_sus_pressure', 185);
    await expect(card().getByRole('status')).toHaveText('Saved');
    await openGarage(page);
    await expect(card().locator('input[name="front_tire"]')).toHaveValue('27');
    await expect(card().locator('input[name="rear_sus_pressure"]')).toHaveValue('185');
  });

  await test.step('compression adjusters (cog menu)', async () => {
    await card().getByRole('button', { name: 'Compression adjusters' }).first().click();
    await page.getByRole('menuitem', { name: 'Dual' }).click();
    await expect(card().locator('input[name="front_sus_comp_2"]')).toBeVisible();
    await setSetting(page, model, 'front_sus_comp_1', 8);
    await expect(card().getByRole('status')).toHaveText('Saved');
  });

  await test.step('saved setups: save, edit, save another, switch back', async () => {
    const picker = card().locator('.setupPicker button');
    await picker.click();
    await page.getByRole('menuitem', { name: /Save current settings as new setup/ }).click();
    await page.getByRole('dialog', { name: 'Save as new setup' }).getByLabel('Setup name').fill('Dry');
    await page.getByRole('dialog', { name: 'Save as new setup' }).getByRole('button', { name: 'Save' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Dry');

    await setSetting(page, model, 'front_tire', 23);
    await expect(picker).toHaveText('Dry (edited)');
    await picker.click();
    await page.getByRole('menuitem', { name: /Save current settings as new setup/ }).click();
    await page.getByRole('dialog', { name: 'Save as new setup' }).getByLabel('Setup name').fill('Wet');
    await page.getByRole('dialog', { name: 'Save as new setup' }).getByRole('button', { name: 'Save' }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Wet');

    await picker.click();
    await page.getByRole('menuitem', { name: 'Dry', exact: true }).click();
    await waitIdle(page);
    await expect(picker).toHaveText('Dry');
    await expect(card().locator('input[name="front_tire"]')).toHaveValue('27');
  });

  await test.step('ride notes: log, edit, reuse settings, delete', async () => {
    await card().getByRole('button', { name: 'Log ride' }).click();
    const log = page.getByRole('dialog', { name: 'Log a ride' });
    await log.getByLabel('Trail or place').fill('E2E trail');
    await log.getByRole('button', { name: 'Tacky' }).click();
    await log.getByRole('button', { name: 'Log ride' }).click();

    // saving opens the bike's ride history
    const history = page.getByRole('dialog', { name: `Rides · ${model}` });
    await expect(history.getByText('E2E trail')).toBeVisible();

    await history.getByRole('button', { name: 'Ride actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit ride' });
    await edit.getByLabel('Trail or place').fill('E2E trail, edited');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(history.getByText('E2E trail, edited')).toBeVisible();

    // change a setting, then put the ride's settings back
    await history.getByRole('button', { name: 'Close' }).click();
    await setSetting(page, model, 'front_tire', 31);
    await expect(card().getByRole('status')).toHaveText('Saved');
    await card().getByRole('button', { name: 'Rides' }).click();
    await history.getByRole('button', { name: 'Ride actions' }).click();
    await page.getByRole('menuitem', { name: 'Use these settings again' }).click();
    await page.getByRole('dialog', { name: 'Use these settings again?' }).getByRole('button', { name: 'Use settings' }).click();
    await waitIdle(page);
    await expect(card().locator('input[name="front_tire"]')).toHaveValue('27');

    await card().getByRole('button', { name: 'Rides' }).click();
    await history.getByRole('button', { name: 'Ride actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: 'Delete this ride?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(history.getByText('No rides logged yet')).toBeVisible();
    await history.getByRole('button', { name: 'Close' }).click();
  });

  let shareLink = '';
  await test.step('share: make a link and open it signed out', async () => {
    await card().getByRole('button', { name: 'Share' }).click();
    const share = page.getByRole('dialog', { name: `Share ${model}` });
    await share.getByRole('button', { name: 'Make a link to the current settings' }).click();
    const link = share.locator('input[readonly]').first();
    await expect(link).toHaveValue(/\?s=/);
    shareLink = new URL(await link.inputValue()).search; // "?s=<id>", opened on localhost
    await share.getByRole('button', { name: 'Done' }).click();

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guest.newPage();
    await guestPage.goto(`/${shareLink}`);
    await expect(guestPage.getByText('Shared setup')).toBeVisible();
    await expect(guestPage.locator('.modelHeader')).toHaveText(model);
    await expect(guestPage.getByRole('button', { name: 'Sign in to copy to your garage' })).toBeVisible();
    await guest.close();
  });

  await test.step('copy the shared setup into the garage', async () => {
    await page.goto(`/${shareLink}`);
    await page.getByRole('button', { name: 'Copy to my garage' }).click();
    await expect(page.getByText('Copied to your garage.')).toBeVisible();
    await waitIdle(page);
    await expect(bikeCard(page, model)).toHaveCount(2);
    await expect(bikeCard(page, model).nth(1).locator('input[name="front_tire"]')).toHaveValue('27');
  });

  await test.step('remove the share link', async () => {
    await card().getByRole('button', { name: 'Share' }).click();
    const share = page.getByRole('dialog', { name: `Share ${model}` });
    await share.getByRole('button', { name: 'Remove link' }).click();
    await expect(share.locator('input[readonly]')).toHaveCount(0);
    await share.getByRole('button', { name: 'Done' }).click();

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guest.newPage();
    await guestPage.goto(`/${shareLink}`);
    await expect(guestPage.getByText("This shared setup doesn't exist or was removed")).toBeVisible();
    await guest.close();
  });

  await test.step('reorder the garage', async () => {
    const models = () => page.locator('.cardContainer .modelHeader').evaluateAll((els) => els.map((e) => e.firstChild?.textContent));
    const before = await models();
    await appMenu(page, "Reorder Bike's in Garage");
    const dialog = page.getByRole('dialog', { name: 'Reorder garage' });
    // move the last bike (the copy) up one
    await dialog.getByRole('button', { name: /up$/ }).last().click();
    await dialog.getByRole('button', { name: 'Save order' }).click();
    await waitIdle(page);
    const after = await models();
    const n = before.length;
    expect(after).toEqual([...before.slice(0, n - 2), before[n - 1], before[n - 2]]);
  });

  await test.step('retire both test bikes', async () => {
    await appMenu(page, 'Retire a Bike from Garage');
    const dialog = page.getByRole('dialog', { name: 'Retire bikes' });
    for (const box of await dialog.getByRole('checkbox', { name: `${TEST_BRAND} ${model}` }).all()) await box.check();
    await dialog.getByRole('button', { name: 'Remove 2 bikes' }).click();
    await waitIdle(page);
    await expect(bikeCard(page, model)).toHaveCount(0);
  });
});
