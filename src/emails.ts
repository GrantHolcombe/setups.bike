import { API_BASE, ApiError } from './billing';

// News and offers by email (sent through Resend). The preference lives in the database;
// the emailPrefs Lambda keeps the Resend contact in step.
export type EmailPrefVia = 'prompt' | 'settings';

export async function setMarketingEmails(token: string, on: boolean, via: EmailPrefVia): Promise<boolean> {
  const res = await fetch(`${API_BASE}/emailPrefs`, {
    method: 'POST',
    body: JSON.stringify({ token, action: 'set', on, via }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code, body.error || 'Could not save your email preference');
  return body.marketingEmails === true;
}
