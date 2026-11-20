import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

test('signed out, the app shows sign-in and the legal links', () => {
  render(
    <GoogleOAuthProvider clientId='test-client'>
      <App />
    </GoogleOAuthProvider>
  );
  expect(screen.getByRole('button', { name: /clip in/i })).toBeTruthy();
  for (const name of ['Terms', 'Privacy', 'Refunds']) {
    expect(screen.getByRole('link', { name })).toBeTruthy();
  }
});
