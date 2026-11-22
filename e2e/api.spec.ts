import { test, expect } from '@playwright/test';
import { API } from './helpers';

// Quick checks straight against the API: no browser and no sign-in, so they run even before
// `npm run e2e:login`.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('API without a valid token', () => {
  const bad = 'not-a-real-token';

  for (const path of ['getBikes', 'account']) {
    test(`GET /${path} is 401`, async ({ request }) => {
      const res = await request.get(`${API}/${path}`, { params: { token: bad } });
      expect(res.status()).toBe(401);
    });
  }

  for (const path of ['DeleteBike', 'reorderGarage', 'updateBike', 'bikeSetups', 'rideNotes', 'checkout', 'portal', 'emailPrefs']) {
    test(`POST /${path} is 401`, async ({ request }) => {
      const res = await request.post(`${API}/${path}`, { data: { token: bad, action: 'list' } });
      expect(res.status()).toBe(401);
    });
  }

  test('sign-in refuses a Google token it cannot verify', async ({ request }) => {
    const res = await request.post(`${API}/addUser`, { params: { accessToken: bad }, data: {} });
    expect(res.status()).toBe(401);
  });

  test('sign-in refuses a method that does not exist yet', async ({ request }) => {
    // apple and email are planned (cards "Sign-in 2" and "Sign-in 3"); until then they're unknown
    for (const provider of ['apple', 'nope']) {
      const res = await request.post(`${API}/addUser`, { data: { provider, token: bad } });
      expect(res.status(), provider).toBe(400);
    }
  });

  test('the Resend webhook refuses unsigned requests', async ({ request }) => {
    const res = await request.post(`${API}/resendWebhook`, { data: { type: 'contact.updated', data: { email: 'x@example.com', unsubscribed: false } } });
    expect(res.status()).toBe(401);
  });

  test('an unknown share link is NOT_FOUND', async ({ request }) => {
    const res = await request.post(`${API}/sharedSetups`, { data: { action: 'view', shareId: 'zzzzzzzzzzzzzzzz' } });
    expect(res.status()).toBe(404);
    expect((await res.json()).code).toBe('NOT_FOUND');
  });
});
