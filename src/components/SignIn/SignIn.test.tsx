import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignInDialog from './SignInDialog';
import NameDialog from './NameDialog';

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

  fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123 456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
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
  await screen.findByLabelText('Code');
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
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
