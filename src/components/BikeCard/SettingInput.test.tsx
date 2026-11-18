import { render, screen, fireEvent, within } from '@testing-library/react';
import SettingInput from './SettingInput';
import SusMenu from './SusMenu';

const setup = (value: number) => {
  const onChange = jest.fn();
  const onCommit = jest.fn();
  render(<SettingInput name='front_tire' value={value} onChange={onChange} onCommit={onCommit} />);
  return { input: screen.getByRole('spinbutton') as HTMLInputElement, onChange, onCommit };
};

describe('SettingInput', () => {
  test('a 0 empties when you click in, so you can just type', () => {
    const { input } = setup(0);
    fireEvent.focus(input);
    expect(input.value).toBe('');
  });

  test('a non-zero value is kept when you click in', () => {
    const { input } = setup(22);
    fireEvent.focus(input);
    expect(input.value).toBe('22');
  });

  test('typing after the 0 is cleared saves the typed value', () => {
    const { input, onCommit } = setup(0);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('front_tire', 25);
    expect(input.value).toBe('25');
  });

  test('leaving it empty puts the last value back', () => {
    const { input, onCommit } = setup(0);
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(input.value).toBe('0');
    expect(onCommit).toHaveBeenCalledWith('front_tire', 0);
  });

  test('clearing a real value and leaving keeps the old value', () => {
    const { input, onCommit } = setup(22);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('22');
    expect(onCommit).toHaveBeenCalledWith('front_tire', 22);
  });

  test('the down arrow stops at 0', () => {
    const { input } = setup(0);
    fireEvent.blur(input);
    const event = fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(event).toBe(false); // default action prevented
    expect(input.min).toBe('0');
  });

  test('the down arrow still works above 0', () => {
    const { input } = setup(3);
    expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(true);
  });

  test('minus, decimals and exponents cannot be typed', () => {
    const { input } = setup(5);
    for (const key of ['-', '.', 'e', '+']) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
  });

  test('a pasted negative or decimal is cleaned to digits', () => {
    const { input, onCommit } = setup(5);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-12' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('front_tire', 12);
  });
});

describe('SusMenu (compression / rebound cog)', () => {
  const bike: any = { front_sus_comp_count: 2, front_sus_comp_1: 4, front_sus_comp_2: 6 };

  const renderMenu = () => {
    const setBikeVal = jest.fn();
    const saveBike = jest.fn();
    const view = render(<SusMenu bikeDetail={bike} detail='front_sus_comp_' setBikeVal={setBikeVal} saveBike={saveBike} />);
    fireEvent.click(view.container.querySelector('svg')!);
    return { setBikeVal, saveBike };
  };

  test('clicking outside the menu keeps the current setting', () => {
    const { setBikeVal, saveBike } = renderMenu();
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Dual')).toBeTruthy();
    // MUI closes the menu on a backdrop click
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
    expect(setBikeVal).not.toHaveBeenCalled();
    expect(saveBike).not.toHaveBeenCalled();
  });

  test('pressing Escape keeps the current setting', () => {
    const { setBikeVal, saveBike } = renderMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(setBikeVal).not.toHaveBeenCalled();
    expect(saveBike).not.toHaveBeenCalled();
  });

  test('choosing an option sets it and saves straight away', () => {
    const { setBikeVal, saveBike } = renderMenu();
    fireEvent.click(screen.getByText('Single'));
    expect(setBikeVal).toHaveBeenCalledWith('front_sus_comp_count', 1);
    expect(saveBike).toHaveBeenCalledWith('front_sus_comp_count', 1);
  });

  test('shows two inputs for Dual', () => {
    render(<SusMenu bikeDetail={bike} detail='front_sus_comp_' setBikeVal={jest.fn()} saveBike={jest.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });
});
