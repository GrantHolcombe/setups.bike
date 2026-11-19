// App.tsx pulls in axios, which jest (CRA) can't parse; these tests never call it
jest.mock('axios', () => ({ __esModule: true, default: {} }));
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppContext, AppContent } from '../../App';
import BikeCard from './BikeCard';
import { SAVE_DELAY_MS, SAVED_SHOWN_MS } from './useBikeSaver';

const bike: any = {
  bike_id: 7, brand: 'Giant', model: 'Trance', front_tire: 20, rear_tire: 22, front_sus_pressure: 97,
  rear_sus_pressure: 195, front_tokens: 2, rear_tokens: 1, front_sus_comp_count: 0, rear_sus_comp_count: 0,
  front_sus_rebound_count: 0, rear_sus_rebound_count: 0,
};

const ctx = (): AppContent => ({
  loading: false, setLoading: jest.fn(), token: 'tok', refreshBikes: jest.fn(),
  account: { plan: 'free', billingEnabled: true } as any, refreshAccount: jest.fn(), openUpgrade: jest.fn(),
  manageBilling: jest.fn(), setups: [], refreshSetups: jest.fn(), shares: [], refreshShares: jest.fn(),
});

let calls: string[] = [];
let failNext = 0;
beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  failNext = 0;
  (global as any).fetch = jest.fn(async (url: string) => {
    calls.push(url);
    if (failNext > 0) { failNext--; return { ok: false, status: 500, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => ({}) };
  });
});
afterEach(() => { jest.useRealTimers(); delete (global as any).fetch; });

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);
const settle = async () => { await act(async () => { jest.advanceTimersByTime(SAVE_DELAY_MS + 50); }); await act(async () => {}); };
const renderCard = () => render(<AppContext.Provider value={ctx()}><BikeCard thisBike={bike} /></AppContext.Provider>);

test('loading a bike sends no saves', async () => {
  renderCard();
  await settle();
  expect(calls).toHaveLength(0);
});

test('three quick token clicks become one save with only that field', async () => {
  renderCard();
  const add = screen.getAllByLabelText('Add a token')[0];
  fireEvent.click(add); fireEvent.click(add); fireEvent.click(add);
  expect(screen.getByText('Saving…')).toBeTruthy();
  await settle();
  expect(calls).toHaveLength(1);
  expect(params(calls[0])).toEqual({ bike_id: '7', token: 'tok', front_tokens: '5' });
  expect(screen.getByText('Saved')).toBeTruthy();
});

test('"Saved" goes away after a moment', async () => {
  renderCard();
  fireEvent.click(screen.getAllByLabelText('Add a token')[0]);
  await settle();
  expect(screen.getByText('Saved')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(SAVED_SHOWN_MS + 50); });
  expect(screen.queryByText('Saved')).toBeNull();
});

test('"Saved" clears when you move into another field', async () => {
  renderCard();
  fireEvent.click(screen.getAllByLabelText('Add a token')[0]);
  await settle();
  expect(screen.getByText('Saved')).toBeTruthy();
  fireEvent.focus(screen.getAllByRole('spinbutton')[0]);
  expect(screen.queryByText('Saved')).toBeNull();
});

test('an error stays up until retried', async () => {
  renderCard();
  failNext = 1;
  fireEvent.click(screen.getAllByLabelText('Add a token')[0]);
  await settle();
  fireEvent.focus(screen.getAllByRole('spinbutton')[0]);
  await act(async () => { jest.advanceTimersByTime(SAVED_SHOWN_MS * 3); });
  expect(screen.getByText(/Couldn't save/)).toBeTruthy();
});

test('changes to different fields in a burst are merged', async () => {
  renderCard();
  fireEvent.click(screen.getAllByLabelText('Add a token')[1]);
  const fork = screen.getAllByRole('spinbutton').find((i) => (i as HTMLInputElement).name === 'front_sus_pressure')!;
  fireEvent.focus(fork);
  fireEvent.change(fork, { target: { value: '101' } });
  fireEvent.blur(fork);
  await settle();
  expect(calls).toHaveLength(1);
  expect(params(calls[0])).toMatchObject({ rear_tokens: '2', front_sus_pressure: '101' });
});

test('leaving a field without changing it saves nothing', async () => {
  renderCard();
  const tire = screen.getAllByRole('spinbutton').find((i) => (i as HTMLInputElement).name === 'front_tire')!;
  fireEvent.focus(tire);
  fireEvent.blur(tire);
  await settle();
  expect(calls).toHaveLength(0);
});

test('a failed save shows Retry and keeps the change', async () => {
  renderCard();
  failNext = 1;
  fireEvent.click(screen.getAllByLabelText('Remove a token')[0]);
  await settle();
  expect(screen.getByText(/Couldn't save/)).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByText('Retry')); });
  await act(async () => {});
  expect(calls).toHaveLength(2);
  expect(params(calls[1])).toMatchObject({ front_tokens: '1' });
  expect(screen.getByText('Saved')).toBeTruthy();
});

test('the field whose save failed is outlined until a save works', async () => {
  renderCard();
  failNext = 1;
  const fork = screen.getAllByRole('spinbutton').find((i) => (i as HTMLInputElement).name === 'front_sus_pressure')!;
  const tire = screen.getAllByRole('spinbutton').find((i) => (i as HTMLInputElement).name === 'front_tire')!;
  fireEvent.focus(fork);
  fireEvent.change(fork, { target: { value: '110' } });
  fireEvent.blur(fork);
  await settle();
  expect(fork.className).toContain('saveFailed');
  expect(fork.getAttribute('aria-invalid')).toBe('true');
  expect(tire.className).not.toContain('saveFailed');
  await act(async () => { fireEvent.click(screen.getByText('Retry')); });
  await act(async () => {});
  expect(fork.className).not.toContain('saveFailed');
});

test('a failed token save outlines the token counter', async () => {
  const view = renderCard();
  failNext = 1;
  fireEvent.click(screen.getAllByLabelText('Add a token')[1]);
  await settle();
  const outlined = view.container.querySelectorAll('.controls.saveFailed');
  expect(outlined).toHaveLength(1);
  expect(outlined[0].textContent).toContain('(2)'); // the rear counter (was 1)
});

test('pending changes are sent when the card goes away', async () => {
  const view = renderCard();
  fireEvent.click(screen.getAllByLabelText('Add a token')[0]);
  view.unmount();
  expect(calls).toHaveLength(1);
  expect(params(calls[0])).toMatchObject({ front_tokens: '3' });
});

test('the token count follows a reloaded bike (an applied setup)', async () => {
  const view = renderCard();
  expect(screen.getAllByText(/Token Count/)[0].textContent).toContain('(2)');
  view.rerender(<AppContext.Provider value={ctx()}><BikeCard thisBike={{ ...bike, front_tokens: 4 }} /></AppContext.Provider>);
  expect(screen.getAllByText(/Token Count/)[0].textContent).toContain('(4)');
  await settle();
  expect(calls).toHaveLength(0);
});
