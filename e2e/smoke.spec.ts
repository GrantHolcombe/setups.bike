import { test, expect } from './fixtures';
import { appMenu, openGarage, sessionToken } from './helpers';

// Loads the garage and opens the menu. Runs on desktop and on a phone-sized screen.
test('the garage loads and the menu opens', async ({ page }) => {
  sessionToken();
  await openGarage(page);
  await appMenu(page, 'Add a New Bike');
  await expect(page.getByRole('dialog', { name: 'Add a bike' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
