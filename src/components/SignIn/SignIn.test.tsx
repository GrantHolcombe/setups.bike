import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignInDialog from './SignInDialog';
import NameDialog from './NameDialog';
import CodeInput from './CodeInput';

const box = (n: number) => screen.getByLabelText(`Digit ${n} of 6`) as HTMLInputElement;
const paste = (el: HTMLElement, text: string) => fireEvent.paste(el, { clipboardData: { getData: () => text } });

// A token the app can decode: {"app_user_id":9,"first_name":"","last_name":"","email_address":"r@x.co"}
const TOKEN = 'h.' + btoa(JSON.stringify({ app_user_id: 9, first_name: '', last_name: '', email_address: 'r@x.co' })) + '.s';

const reply = (status: number, body: object) => Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response);
let calls: any[] = [];
const mockFetch = (...responses: Array<[number, object]>) => {
  calls = [];
  global.fetch = jest.fn((url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const [status, body] = responses.shift() || [500, {}];
    return reply(status, body);
  }) as any;
};

const props = () => ({ open: true, onClose: jest.fn(), onGoogle: jest.fn(), onSignedIn: jest.fn(), signupSource: { utm_source: 'sticker' } });

test('Sign in: Continue with Google closes the dialog and starts Google', () => {
  const p = props();
  render(<SignInDialog {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(p.onClose).toHaveBeenCalled();
  expect(p.onGoogle).toHaveBeenCalled();
});

test('Sign in: email, code, signed in (with the signup source)', async () => {
  const p = props();
  mockFetch([200, { sent: true }], [200, { token: TOKEN, isNew: true }]);
  render(<SignInDialog {...p} />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' r@x.co ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByRole('heading', { name: 'Check your email' });
  expect(calls[0].body).toEqual({ provider: 'email', action: 'requestCode', email: 'r@x.co' });
  expect(screen.getByText('r@x.co')).toBeTruthy();

  // pasting the whole code signs in straight away
  paste(box(1), '123 456');
  await waitFor(() => expect(p.onSignedIn).toHaveBeenCalledWith(TOKEN, true));
  expect(calls[1].body).toEqual({ provider: 'email', email: 'r@x.co', code: '123456', utm_source: 'sticker' });
});

test('Sign in: a bad address is caught before sending; a wrong code says so', async () => {
  const p = props();
  mockFetch([200, { sent: true }], [401, { error: 'Sign-in could not be verified' }]);
  render(<SignInDialog {...p} />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(calls.length).toBe(0);

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'r@x.co' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByLabelText('Digit 1 of 6');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter the 6-digit code from the email.')).toBeTruthy();
  paste(box(1), '000000');
  await screen.findByText(/That code didn't work/);
  expect(p.onSignedIn).not.toHaveBeenCalled();
});

test('Sign in: too many codes shows the server message', async () => {
  mockFetch([429, { error: 'Too many codes requested. Wait a few minutes and try again.' }]);
  render(<SignInDialog {...props()} />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'r@x.co' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByText(/Too many codes requested/);
});

test('Name: saving returns the new token; blank first name is refused', async () => {
  const onSaved = jest.fn();
  mockFetch([200, { token: 'new-token' }]);
  render(<NameDialog open token={TOKEN} onSaved={onSaved} onSkip={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter your first name.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Casey' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('new-token'));
  expect(calls[0].body).toEqual({ action: 'setName', token: TOKEN, firstName: 'Casey', lastName: '' });
});

describe('CodeInput: six boxes', () => {
  const setup = () => {
    const onChange = jest.fn(); const onComplete = jest.fn();
    render(<CodeInput onChange={onChange} onComplete={onComplete} />);
    return { onChange, onComplete };
  };

  test('typing fills one box at a time, moves along, and completes on the sixth', () => {
    const { onComplete } = setup();
    expect(document.activeElement).toBe(box(1));
    '482915'.split('').forEach((d, i) => fireEvent.change(box(i + 1), { target: { value: d } }));
    expect([1, 2, 3, 4, 5, 6].map((n) => box(n).value).join('')).toBe('482915');
    expect(onComplete).toHaveBeenCalledWith('482915');
  });

  test('a pasted code fills every box, even pasted into a later box or with spaces and dashes', () => {
    const { onComplete } = setup();
    paste(box(4), ' 48-29 15 ');
    expect([1, 2, 3, 4, 5, 6].map((n) => box(n).value).join('')).toBe('482915');
    expect(onComplete).toHaveBeenCalledWith('482915');
    expect(document.activeElement).toBe(box(6));
  });

  test('a phone autofill (whole code arriving in the first box) also fills them all', () => {
    const { onComplete } = setup();
    fireEvent.change(box(1), { target: { value: '482915' } });
    expect(onComplete).toHaveBeenCalledWith('482915');
  });

  test('letters are ignored; a partial paste fills from where it lands', () => {
    const { onChange, onComplete } = setup();
    fireEvent.change(box(1), { target: { value: 'a' } });
    expect(box(1).value).toBe('');
    paste(box(1), '12');
    expect(box(1).value + box(2).value).toBe('12');
    expect(document.activeElement).toBe(box(3));
    expect(onChange).toHaveBeenLastCalledWith('12');
    expect(onComplete).not.toHaveBeenCalled();
  });

  test('Backspace clears the box, then steps back to the previous one', () => {
    const { onChange } = setup();
    paste(box(1), '123');
    fireEvent.keyDown(box(4), { key: 'Backspace' });
    expect(box(3).value).toBe('');
    expect(document.activeElement).toBe(box(3));
    fireEvent.keyDown(box(3), { key: 'Backspace' });
    expect(box(2).value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith('1');
  });
});
