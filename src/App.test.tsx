import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

test('signed out, the app shows the landing page, sign-in and the legal links', () => {
  render(
    <GoogleOAuthProvider clientId='test-client'>
      <App />
    </GoogleOAuthProvider>
  );
  // landing page: headline, what it remembers, plans, and a sign-in button at the top and bottom
  expect(screen.getByRole('heading', { level: 1, name: /saved for every bike/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'What it remembers' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Free and Pro' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /clip in/i })).toHaveLength(2);
  expect(screen.getAllByText(/sign in with google or your email/i)).toHaveLength(2);
  for (const name of ['Terms', 'Privacy', 'Refunds']) {
    expect(screen.getByRole('link', { name })).toBeTruthy();
  }
});
