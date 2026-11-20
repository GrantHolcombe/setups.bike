import { render, screen, fireEvent } from '@testing-library/react';
import { AppContext, AppContent } from '../../../App';
import AddBikeModal from './AddBikeModal';
import DeleteBikeModal from './DeleteBikeModal';
import ReorderGarageModal from './ReorderGarageModal';

// App.tsx pulls in axios, which jest (CRA) can't parse; these tests never call it (jest hoists this)
jest.mock('axios', () => ({ __esModule: true, default: {} }));

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
