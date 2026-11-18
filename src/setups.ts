// Pro feature 2.1: named setups (presets) per bike. Names and settings are always the
// user's own; the app never suggests values.
import { API_BASE, ApiError } from './billing';

// The 18 settings a setup stores (same names as the bike's columns).
export const SETUP_FIELDS = [
  'front_tire', 'front_sus_pressure', 'front_sus_comp_1', 'front_sus_comp_2',
  'front_sus_comp_count', 'front_sus_rebound_1', 'front_sus_rebound_2', 'front_sus_rebound_count',
  'front_tokens', 'rear_tire', 'rear_sus_pressure', 'rear_sus_comp_1', 'rear_sus_comp_2',
  'rear_sus_comp_count', 'rear_sus_rebound_1', 'rear_sus_rebound_2', 'rear_sus_rebound_count',
  'rear_tokens',
] as const;

export type SetupField = typeof SETUP_FIELDS[number];

export type IBikeSetup = {
  bike_setup_id: number;
  bike_id: number;
  name: string;
  updated_at: string;
} & Record<SetupField, number>;

// Optional name ideas. They only fill in the name box; they never carry settings.
export const NAME_IDEAS = ['Trail', 'Bike park', 'XC', 'Wet', 'Race'];

// True when the bike's current settings are exactly the preset's.
export const matchesSetup = (bike: Record<string, any>, setup: IBikeSetup) =>
  SETUP_FIELDS.every((f) => Number(bike[f] ?? 0) === Number(setup[f] ?? 0));

async function call<T>(token: string, action: string, extra: object = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/bikeSetups`, {
    method: 'POST',
    body: JSON.stringify({ token, action, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code, body.error || `Request failed (${res.status})`);
  return body as T;
}

export const listSetups = (token: string) =>
  call<{ setups: IBikeSetup[] }>(token, 'list').then((r) => r.setups);
export const saveSetup = (token: string, bikeId: number, name: string) =>
  call<{ setup: IBikeSetup }>(token, 'save', { bikeId, name });
export const updateSetup = (token: string, setupId: number) =>
  call<{ setup: IBikeSetup }>(token, 'update', { setupId });
export const applySetup = (token: string, setupId: number) =>
  call<{ bikeId: number; setupId: number }>(token, 'apply', { setupId });
export const renameSetup = (token: string, setupId: number, name: string) =>
  call<{ setup: IBikeSetup }>(token, 'rename', { setupId, name });
export const deleteSetup = (token: string, setupId: number) =>
  call<{ deleted: number }>(token, 'delete', { setupId });
