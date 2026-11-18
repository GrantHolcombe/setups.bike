// Calls to the plan and billing endpoints. Requests are kept "simple" (no custom headers,
// text body) so the browser doesn't need a CORS preflight, like the app's other calls.
export const API_BASE = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test';

export type BillingInterval = 'month' | 'year';

export interface IAccount {
  plan: 'free' | 'pro';
  planSource: 'stripe' | 'apple' | 'google' | null;
  planStatus: string | null;
  interval: BillingInterval | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
  bikes: number;
  //false while Pro is still being rolled out to this user: no limit, no Go Pro
  billingEnabled: boolean;
  bikeLimit: number | null;
  canAddBike: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code, body.error || `Request failed (${res.status})`);
  return body as T;
}

export const getAccount = (token: string) =>
  call<IAccount>(`account?token=${encodeURIComponent(token)}`);

// Both return a Stripe URL; the caller sends the browser there.
export const startCheckout = (token: string, interval: BillingInterval) =>
  call<{ url: string }>('checkout', { method: 'POST', body: JSON.stringify({ token, interval }) });

export const openBillingPortal = (token: string) =>
  call<{ url: string }>('portal', { method: 'POST', body: JSON.stringify({ token }) });

export const PRICES = {
  month: { label: '$2.99 / month', detail: 'Billed monthly' },
  year: { label: '$24 / year', detail: 'Save 33% vs monthly' },
};
