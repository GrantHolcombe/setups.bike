import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppContext, AppContent } from '../../../App';
import AddBikeModal from './AddBikeModal';
import DeleteBikeModal from './DeleteBikeModal';
import ReorderGarageModal from './ReorderGarageModal';
import DeleteAccountDialog from './DeleteAccountDialog';


const ctx = (): AppContent => ({
  loading: false, setLoading: jest.fn(), token: 'tok', refreshBikes: jest.fn(), account: undefined,
  refreshAccount: jest.fn(), openUpgrade: jest.fn(), manageBilling: jest.fn(), setups: [], refreshSetups: jest.fn(),
  shares: [], refreshShares: jest.fn(),
});
const withCtx = (ui: JSX.Element) => render(<AppContext.Provider value={ctx()}>{ui}</AppContext.Provider>);
const bikes: any[] = [
  { bike_id: 1, brand: 'Giant', model: 'Trance', garage_order: 1 },
  { bike_id: 2, brand: 'Specialized', model: 'P.4', garage_order: 2 },
  { bike_id: 3, brand: 'Santa Cruz', model: 'Nomad', garage_order: 5 },
];

test('Add a bike: Save waits for both brand and model', () => {
  withCtx(<AddBikeModal open closeModal={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Add a bike' })).toBeTruthy();
  const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Giant' } });
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Trance' } });
  expect(save.disabled).toBe(false);
});

test('Retire bikes: the red button counts the bikes picked', () => {
  withCtx(<DeleteBikeModal open closeModal={jest.fn()} bikeList={bikes} />);
  expect((screen.getByRole('button', { name: 'Remove bike' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Giant Trance'));
  fireEvent.click(screen.getByLabelText('Santa Cruz Nomad'));
  const remove = screen.getByRole('button', { name: 'Remove 2 bikes' }) as HTMLButtonElement;
  expect(remove.disabled).toBe(false);
  expect(remove.className).toContain('Error');
});

test('Reorder garage: labelled up/down buttons, ends disabled, Save after a move', () => {
  withCtx(<ReorderGarageModal open closeModal={jest.fn()} bikeList={bikes} />);
  const up = (name: string) => screen.getByRole('button', { name: `Move ${name} up` }) as HTMLButtonElement;
  const down = (name: string) => screen.getByRole('button', { name: `Move ${name} down` }) as HTMLButtonElement;
  expect(up('Giant Trance').disabled).toBe(true);
  expect(down('Santa Cruz Nomad').disabled).toBe(true);
  const save = screen.getByRole('button', { name: 'Save order' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(up('Santa Cruz Nomad'));
  expect(save.disabled).toBe(false);
  // positions are renumbered 1..n by list order (the stored 5 had a gap)
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    '1. Giant Trance', '2. Santa Cruz Nomad', '3. Specialized P.4',
  ]);
});

describe('Delete account', () => {
  const proCtx = (): AppContent => ({ ...ctx(), account: { plan: 'pro', planSource: 'stripe', planStatus: 'active' } as any });

  test('the red button stays off until "delete" is typed (any case, extra spaces ok)', () => {
    withCtx(<DeleteAccountDialog open onClose={jest.fn()} onDeleted={jest.fn()} bikeCount={3} />);
    expect(screen.getByRole('heading', { name: 'Delete your account?' })).toBeTruthy();
    expect(screen.getByText('All 3 bikes and their settings')).toBeTruthy();
    const del = screen.getByRole('button', { name: 'Delete my account' }) as HTMLButtonElement;
    const field = screen.getByLabelText('Type "delete" to confirm');
    expect(del.disabled).toBe(true);
    fireEvent.change(field, { target: { value: 'delet' } });
    expect(del.disabled).toBe(true);
    fireEvent.change(field, { target: { value: 'yes' } });
    expect(del.disabled).toBe(true);
    fireEvent.change(field, { target: { value: ' DELETE ' } });
    expect(del.disabled).toBe(false);
    expect(del.className).toContain('Error');
    // no paid Pro: no subscription warning
    expect(screen.queryByText(/subscription is cancelled/)).toBeNull();
  });

  test('a paid Pro user is told the subscription is cancelled without a refund', () => {
    render(<AppContext.Provider value={proCtx()}><DeleteAccountDialog open onClose={jest.fn()} onDeleted={jest.fn()} bikeCount={1} /></AppContext.Provider>);
    expect(screen.getByText(/subscription is cancelled right away/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Refund Policy' })).toBeTruthy();
    expect(screen.getByText('Your bike and its settings')).toBeTruthy();
  });

  test('confirming calls deleteAccount, then onDeleted; a failure keeps the dialog with the message', async () => {
    const onDeleted = jest.fn();
    const calls: any[] = [];
    let status = 500;
    global.fetch = jest.fn((url: any, init: any) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(status < 300 ? { deleted: true } : { error: 'Server said no' }) } as Response);
    }) as any;
    withCtx(<DeleteAccountDialog open onClose={jest.fn()} onDeleted={onDeleted} bikeCount={2} />);
    fireEvent.change(screen.getByLabelText('Type "delete" to confirm'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await screen.findByText('Server said no');
    expect(onDeleted).not.toHaveBeenCalled();
    status = 200;
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls[1].url).toMatch(/\/deleteAccount$/);
    expect(calls[1].body).toEqual({ token: 'tok', confirm: 'delete' });
  });
});
