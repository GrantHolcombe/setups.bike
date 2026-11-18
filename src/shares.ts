// Pro feature 2.3: share a read-only snapshot of a bike's settings by link.
// Shared pages show the bike, setup name and settings, never the owner's name or email.
import { API_BASE, ApiError } from './billing';
import { Settings } from './rides';

export interface IShare {
  share_id: string;
  brand: string;
  model: string;
  setup_name: string | null;
  settings: Settings;
  created_at: string;
  // owner only
  bike_id?: number;
  views?: number;
  copies?: number;
}

export const SHARE_PARAM = 's';
export const shareUrl = (id: string) => `https://setups.bike/?${SHARE_PARAM}=${encodeURIComponent(id)}`;

async function call<T>(action: string, extra: object = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/sharedSetups`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code, body.error || `Request failed (${res.status})`);
  return body as T;
}

export const viewShare = (shareId: string) =>
  call<{ share: IShare }>('view', { shareId }).then((r) => r.share);
export const createShare = (token: string, bikeId: number) =>
  call<{ share: IShare; reused?: boolean }>('create', { token, bikeId });
export const listShares = (token: string) =>
  call<{ shares: IShare[] }>('list', { token }).then((r) => r.shares);
export const revokeShare = (token: string, shareId: string) =>
  call<{ revoked: string }>('revoke', { token, shareId });
export const copyShare = (token: string, shareId: string) =>
  call<{ bikeId: number }>('copy', { token, shareId });
