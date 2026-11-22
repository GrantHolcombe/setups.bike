import { jwtDecode } from 'jwt-decode';
import { API_BASE, ApiError } from './billing';
import type { ISignupSource } from './signupSource';
import type { IJWT, IProfile } from './App';

// Email sign-in with a one-time code, and setting a name (card "Sign-in 2"). The addUser Lambda
// does all of it; see lambdas/SetupDotBikes_AddUser/providers/email.js.

async function post(body: Record<string, unknown>, fallback: string) {
  const res = await fetch(`${API_BASE}/addUser`, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code, data.error || fallback);
  return data;
}

// Sends a 6-digit code to the address. The answer is the same whether or not it has an account.
export async function requestEmailCode(email: string): Promise<void> {
  await post({ provider: 'email', action: 'requestCode', email }, 'Could not send the code');
}

// Signs in with the code. isNew: the account was just created (it has no name yet).
export async function verifyEmailCode(
  email: string, code: string, signupSource: ISignupSource,
): Promise<{ token: string; isNew: boolean }> {
  const data = await post({ provider: 'email', email, code, ...signupSource }, 'Could not sign in');
  return { token: data.token, isNew: data.isNew === true };
}

// Saves the name and returns a fresh app token (the token carries the name).
export async function saveName(token: string, firstName: string, lastName = ''): Promise<string> {
  return (await post({ action: 'setName', token, firstName, lastName }, 'Could not save your name')).token;
}

// Deletes the signed-in account and everything it owns (card "Sign-in 4"; deleteAccount Lambda).
export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/deleteAccount`, {
    method: 'POST',
    body: JSON.stringify({ token, confirm: 'delete' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code, data.error || "Your account wasn't deleted. Please try again.");
}

// The header's profile for someone who didn't sign in with Google: built from the app token.
export function profileFromToken(token: string): IProfile {
  const t = jwtDecode<IJWT>(token);
  const first = t.first_name || '';
  const last = t.last_name || '';
  return {
    id: String(t.app_user_id),
    email: t.email_address,
    verified_email: true,
    name: `${first} ${last}`.trim(),
    given_name: first,
    family_name: last,
    picture: '',
    hd: '',
  };
}
