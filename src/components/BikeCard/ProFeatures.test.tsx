// App.tsx pulls in axios, which jest (CRA) can't parse; these tests never call it
jest.mock('axios', () => ({ __esModule: true, default: {} }));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppContext, AppContent } from '../../App';
import { RideLogDialog, RideHistoryDialog } from './RideNotes';
import ShareDialog from './ShareDialog';
import ProActions from './ProActions';
import SettingsSummary from './SettingsSummary';
import SharedSetupView from '../Shared/SharedSetupView';

const bike: any = { bike_id: 7, brand: 'Giant', model: 'Trance', front_tire: 20 };
const settings: any = {
  front_tire: 20, rear_tire: 22, front_sus_pressure: 97, rear_sus_pressure: 180,
  front_sus_comp_count: 2, front_sus_comp_1: 4, front_sus_comp_2: 6,
  front_sus_rebound_count: 1, front_sus_rebound_1: 8, front_sus_rebound_2: 99,
  rear_sus_comp_count: 0, rear_sus_rebound_count: 1, rear_sus_rebound_1: 5,
  front_tokens: 2, rear_tokens: 1,
};

const ctx = (over: Partial<AppContent> = {}): AppContent => ({
  loading: false, setLoading: jest.fn(), token: 'tok', refreshBikes: jest.fn(),
  account: { plan: 'pro', billingEnabled: true } as any,
  refreshAccount: jest.fn(), openUpgrade: jest.fn(), manageBilling: jest.fn(),
  setups: [], refreshSetups: jest.fn(), shares: [], refreshShares: jest.fn(async () => {}), ...over,
});

const withCtx = (ui: JSX.Element, over: Partial<AppContent> = {}) =>
  render(<AppContext.Provider value={ctx(over)}>{ui}</AppContext.Provider>);

const mockFetch = (body: object, status = 200) => {
  const f = jest.fn(async () => ({ ok: status < 400, status, json: async () => body }));
  (global as any).fetch = f;
  return f;
};
const sent = (f: jest.Mock, i = 0) => JSON.parse(f.mock.calls[i][1].body);

afterEach(() => { delete (global as any).fetch; });

describe('SettingsSummary', () => {
  test('shows only the adjusters the bike uses', () => {
    render(<SettingsSummary settings={settings} />);
    expect(screen.getByText('LSC 4 · HSC 6')).toBeTruthy();
    expect(screen.getByText('LSR 8')).toBeTruthy(); // single: no HSR 99
    expect(screen.queryByText(/HSR/)).toBeNull();
    expect(screen.getAllByText('Compression')).toHaveLength(1); // rear has none
  });
});

describe('ProActions', () => {
  test('hidden on the free plan with no links', () => {
    const { container } = withCtx(<ProActions bike={bike} />, { account: { plan: 'free', billingEnabled: true } as any });
    expect(container.innerHTML).toBe('');
  });

  test('a lapsed user with links still sees Share, but not ride notes', () => {
    withCtx(<ProActions bike={bike} />, {
      account: { plan: 'free', billingEnabled: true } as any,
      shares: [{ share_id: 'abcdefghijklmnop', bike_id: 7 } as any],
    });
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.queryByText('Log ride')).toBeNull();
  });

  test('Pro sees all three', () => {
    withCtx(<ProActions bike={bike} />);
    ['Log ride', 'Rides', 'Share'].forEach((t) => expect(screen.getByText(t)).toBeTruthy());
  });
});

describe('RideLogDialog', () => {
  test('will not save an empty ride', () => {
    const f = mockFetch({});
    withCtx(<RideLogDialog bike={bike} open onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByText('Log ride'));
    expect(screen.getByText('Add a trail, rating, conditions or a note')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  test('sends the trail, one condition and the note', async () => {
    const f = mockFetch({ note: { ride_note_id: 1 } });
    const onSaved = jest.fn();
    withCtx(<RideLogDialog bike={bike} open onClose={jest.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Trail or place'), { target: { value: 'Duthie' } });
    fireEvent.click(screen.getByText('Wet'));
    fireEvent.click(screen.getByText('Tacky')); // picking another replaces it
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Good grip' } });
    fireEvent.click(screen.getByText('Log ride'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent(f)).toMatchObject({ action: 'add', bikeId: 7, trail: 'Duthie', conditions: 'tacky', note: 'Good grip', token: 'tok' });
    expect(sent(f).rideDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('RideHistoryDialog', () => {
  const note = { ride_note_id: 3, bike_id: 7, ride_date: '2026-11-01', trail: 'Tiger', conditions: 'muddy', rating: 4, note: 'Slick', setup_name: 'Trail', settings };

  test('lists rides with their details and settings', async () => {
    mockFetch({ notes: [note] });
    withCtx(<RideHistoryDialog bike={bike} open version={0} onClose={jest.fn()} onLogRide={jest.fn()} />);
    expect(await screen.findByText('Tiger')).toBeTruthy();
    expect(screen.getByText('Muddy')).toBeTruthy();
    expect(screen.getByText('Slick')).toBeTruthy();
    expect(screen.getByText(/Nov 1, 2026/)).toBeTruthy(); // no time-zone shift to Oct 31
    fireEvent.click(screen.getByText('Settings (Trail)'));
    expect(screen.getByText('LSC 4 · HSC 6')).toBeTruthy();
  });

  test('"Use these settings again" asks first, then applies and reloads the garage', async () => {
    const f = mockFetch({ notes: [note] });
    const refreshBikes = jest.fn();
    withCtx(<RideHistoryDialog bike={bike} open version={0} onClose={jest.fn()} onLogRide={jest.fn()} />, { refreshBikes });
    fireEvent.click(await screen.findByLabelText('Ride actions'));
    fireEvent.click(screen.getByText('Use these settings again'));
    expect(screen.getByText(/replaces Trance's current settings/)).toBeTruthy();
    f.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ bikeId: 7 }) }));
    fireEvent.click(screen.getByText('Use settings'));
    await waitFor(() => expect(refreshBikes).toHaveBeenCalled());
    expect(sent(f, 1)).toMatchObject({ action: 'reuse', noteId: 3 });
  });
});

describe('ShareDialog', () => {
  test('makes a link and lists it with its stats', async () => {
    const f = mockFetch({ share: { share_id: 'abcdefghijklmnop' } });
    const refreshShares = jest.fn(async () => {});
    const { rerender } = withCtx(<ShareDialog bike={bike} open onClose={jest.fn()} />, { refreshShares });
    expect(screen.getByText(/Your name and email are never shown/)).toBeTruthy();
    fireEvent.click(screen.getByText('Make a link to the current settings'));
    await waitFor(() => expect(refreshShares).toHaveBeenCalled());
    expect(sent(f)).toMatchObject({ action: 'create', bikeId: 7 });
    rerender(<AppContext.Provider value={ctx({ shares: [{ share_id: 'abcdefghijklmnop', bike_id: 7, views: 3, copies: 1, created_at: '2026-11-18T00:00:00Z' } as any] })}>
      <ShareDialog bike={bike} open onClose={jest.fn()} />
    </AppContext.Provider>);
    expect((screen.getByDisplayValue('https://setups.bike/?s=abcdefghijklmnop'))).toBeTruthy();
    expect(screen.getByText(/3 views · 1 copies/)).toBeTruthy();
  });

  test('a lapsed user can remove links but not make new ones', () => {
    withCtx(<ShareDialog bike={bike} open onClose={jest.fn()} />, {
      account: { plan: 'free', billingEnabled: true } as any,
      shares: [{ share_id: 'abcdefghijklmnop', bike_id: 7, created_at: '2026-11-18T00:00:00Z' } as any],
    });
    expect(screen.queryByText('Make a link to the current settings')).toBeNull();
    expect(screen.getByLabelText('Remove link')).toBeTruthy();
  });
});

describe('SharedSetupView (public page)', () => {
  test('shows the shared bike, the disclaimer and a sign-in button when signed out', async () => {
    const f = mockFetch({ share: { share_id: 'abcdefghijklmnop', brand: 'Giant', model: 'Trance', setup_name: 'Park', settings } });
    const onCopy = jest.fn();
    render(<SharedSetupView shareId='abcdefghijklmnop' signedIn={false} copying={false} copyError='' onCopy={onCopy} onClose={jest.fn()} />);
    expect(await screen.findByText('Trance')).toBeTruthy();
    expect(screen.getByText('Park')).toBeTruthy();
    expect(screen.getByText(/isn't a recommendation from/)).toBeTruthy();
    expect(sent(f)).toEqual({ action: 'view', shareId: 'abcdefghijklmnop' }); // no token sent
    fireEvent.click(screen.getByText('Sign in to copy to your garage'));
    expect(onCopy).toHaveBeenCalled();
  });

  test('a removed link says so', async () => {
    mockFetch({ error: "This shared setup doesn't exist or was removed", code: 'NOT_FOUND' }, 404);
    render(<SharedSetupView shareId='abcdefghijklmnop' signedIn copying={false} copyError='' onCopy={jest.fn()} onClose={jest.fn()} />);
    expect(await screen.findByText(/doesn't exist or was removed/)).toBeTruthy();
    expect(screen.getByText('Go to my garage')).toBeTruthy();
  });
});
