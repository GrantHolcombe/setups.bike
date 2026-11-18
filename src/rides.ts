// Pro feature 2.2: ride notes. Each note keeps a snapshot of the bike's settings when it was logged.
import { API_BASE, ApiError } from './billing';
import { SetupField } from './setups';

export const CONDITIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'tacky', label: 'Tacky' },
  { value: 'wet', label: 'Wet' },
  { value: 'muddy', label: 'Muddy' },
  { value: 'loose', label: 'Loose' },
  { value: 'snow', label: 'Snow/ice' },
] as const;

export type Condition = typeof CONDITIONS[number]['value'];
export const conditionLabel = (c?: string | null) => CONDITIONS.find((x) => x.value === c)?.label;

export type Settings = Record<SetupField, number>;

export interface IRideNote {
  ride_note_id: number;
  bike_id: number;
  ride_date: string; // YYYY-MM-DD
  trail: string | null;
  conditions: Condition | null;
  rating: number | null;
  note: string | null;
  setup_name: string | null;
  settings: Settings;
}

export interface IRideFields {
  rideDate: string;
  trail: string;
  conditions: Condition | null;
  rating: number | null;
  note: string;
}

// today's date in the rider's own time zone, as YYYY-MM-DD
export const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// "Tue, Nov 18, 2026" without shifting the day across time zones
export const formatRideDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

async function call<T>(token: string, action: string, extra: object = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/rideNotes`, { method: 'POST', body: JSON.stringify({ token, action, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code, body.error || `Request failed (${res.status})`);
  return body as T;
}

export const listRides = (token: string, bikeId: number) =>
  call<{ notes: IRideNote[] }>(token, 'list', { bikeId }).then((r) => r.notes);
export const addRide = (token: string, bikeId: number, f: IRideFields) =>
  call<{ note: IRideNote }>(token, 'add', { bikeId, ...f });
export const editRide = (token: string, noteId: number, f: IRideFields) =>
  call<{ note: IRideNote }>(token, 'edit', { noteId, ...f });
export const deleteRide = (token: string, noteId: number) =>
  call<{ deleted: number }>(token, 'delete', { noteId });
export const reuseRide = (token: string, noteId: number) =>
  call<{ bikeId: number }>(token, 'reuse', { noteId });
