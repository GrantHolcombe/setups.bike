import * as React from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, TextField, Typography,
} from '@mui/material';
import { requestEmailCode, verifyEmailCode } from '../../signin';
import type { ISignupSource } from '../../signupSource';

interface ISignInDialogProps {
  open: boolean;
  onClose: () => void;
  // starts Google sign-in (the dialog closes first)
  onGoogle: () => void;
  // email sign-in finished
  onSignedIn: (token: string, isNew: boolean) => void;
  signupSource: ISignupSource;
}

const GoogleMark = () => (
  <svg width='18' height='18' viewBox='0 0 48 48' aria-hidden='true'>
    <path fill='#EA4335' d='M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z' />
    <path fill='#4285F4' d='M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z' />
    <path fill='#FBBC05' d='M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z' />
    <path fill='#34A853' d='M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z' />
  </svg>
);

// "Clip In": Continue with Google, or get a one-time code by email (card "Sign-in 2").
// Follows the dialog pattern in docs/STYLE_GUIDE.md. Never says whether an address has an account.
export default function SignInDialog({ open, onClose, onGoogle, onSignedIn, signupSource }: ISignInDialogProps) {
  const [step, setStep] = React.useState<'start' | 'code'>('start');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    if (open) { setStep('start'); setCode(''); setError(''); setResent(false); }
  }, [open]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async (again = false) => {
    if (!validEmail) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError('');
    try {
      await requestEmailCode(email.trim());
      setStep('code');
      setCode('');
      setResent(again);
    } catch (err: any) {
      setError(err?.message || 'Could not send the code. Please try again.');
    }
    setBusy(false);
  };

  const verify = async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) { setError('Enter the 6-digit code from the email.'); return; }
    setBusy(true);
    setError('');
    try {
      const { token, isNew } = await verifyEmailCode(email.trim(), digits, signupSource);
      onSignedIn(token, isNew);
    } catch (err: any) {
      setError(err?.status === 401
        ? "That code didn't work. Check the latest email, or send a new code."
        : err?.message || 'Could not sign in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='xs' fullWidth>
      <DialogTitle>{step === 'start' ? 'Clip in' : 'Check your email'}</DialogTitle>
      <DialogContent>
        {step === 'start' ? (
          <>
            <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
              Sign in or create your free garage.
            </Typography>
            <Button fullWidth variant='outlined' color='inherit' startIcon={<GoogleMark />} disabled={busy}
              onClick={() => { onClose(); onGoogle(); }} sx={{ textTransform: 'none', fontSize: '1rem' }}>
              Continue with Google
            </Button>
            <Divider sx={{ my: 2, color: 'text.secondary', fontSize: '0.875rem' }}>or</Divider>
            <Box component='form' noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
              <TextField fullWidth label='Email' type='email' autoComplete='email' value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={busy} inputProps={{ inputMode: 'email' }} />
              <Button fullWidth type='submit' variant='contained' sx={{ mt: 2 }} disabled={busy}>
                Email me a code
              </Button>
            </Box>
            <Typography variant='caption' component='p' sx={{ mt: 2, color: 'text.secondary', '& a': { color: 'var(--gold-text)' } }}>
              No password needed: we'll email you a 6-digit code. By continuing you agree to
              the <a href='/terms.html'>Terms</a> and <a href='/privacy.html'>Privacy Policy</a>.
            </Typography>
          </>
        ) : (
          <Box component='form' noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
              {resent ? 'We sent a new code to ' : 'We sent a 6-digit code to '}
              <strong>{email.trim()}</strong>. It works for 10 minutes.
            </Typography>
            <TextField fullWidth autoFocus label='Code' value={code} disabled={busy}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 7 }} />
            <Button fullWidth type='submit' variant='contained' sx={{ mt: 2 }} disabled={busy}>
              Sign in
            </Button>
          </Box>
        )}
        {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        {step === 'code' && (
          <>
            <Button color='inherit' disabled={busy} onClick={() => { setStep('start'); setError(''); }}>Change email</Button>
            <Button disabled={busy} onClick={() => send(true)}>Send a new code</Button>
          </>
        )}
        {step === 'start' && <Button color='inherit' disabled={busy} onClick={onClose}>Cancel</Button>}
      </DialogActions>
    </Dialog>
  );
}
