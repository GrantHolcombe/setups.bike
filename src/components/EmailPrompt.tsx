import * as React from 'react';
import { Alert, Button, Snackbar } from '@mui/material';
import { useAppContext } from '../App';
import { setMarketingEmails } from '../emails';

// Asked once, of anyone who has never chosen (new sign-ups): would they like news by email?
// Either answer is saved, so it never comes back; it can be changed later in the bike menu.
export default function EmailPrompt({ onDone }: { onDone: () => void }) {
  const { token, refreshAccount } = useAppContext();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const answer = async (on: boolean) => {
    setBusy(true);
    setError('');
    try {
      await setMarketingEmails(token, on, 'prompt');
      onDone();
      refreshAccount();
    } catch (err: any) {
      setError(err?.message || 'Could not save that. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity='info' color='success' variant='filled' icon={false} sx={{ maxWidth: 520, alignItems: 'center' }}
        action={
          <>
            <Button color='inherit' size='small' disabled={busy} onClick={() => answer(false)}>No thanks</Button>
            <Button color='inherit' size='small' disabled={busy} onClick={() => answer(true)} sx={{ fontWeight: 700 }}>Yes please</Button>
          </>
        }>
        <b>Want news from Setups.Bike?</b> New features and the occasional offer, a few times a year.
        Unsubscribe anytime.
        {error && <div style={{ marginTop: 4 }}>{error}</div>}
      </Alert>
    </Snackbar>
  );
}
