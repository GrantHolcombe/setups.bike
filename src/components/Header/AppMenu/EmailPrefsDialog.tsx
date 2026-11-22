import * as React from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, Typography,
} from '@mui/material';
import { useAppContext } from '../../../App';
import { setMarketingEmails } from '../../../emails';

// Bike menu > Email preferences: turn news and offers by email on or off.
// Follows the dialog pattern in docs/STYLE_GUIDE.md. Saves as soon as the switch changes.
export default function EmailPrefsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, account, refreshAccount } = useAppContext();
  const [on, setOn] = React.useState(account?.marketingEmails === true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (open) { setOn(account?.marketingEmails === true); setError(''); }
  }, [open, account?.marketingEmails]);

  const change = async (next: boolean) => {
    setOn(next);
    setBusy(true);
    setError('');
    try {
      setOn(await setMarketingEmails(token, next, 'settings'));
      await refreshAccount();
    } catch (err: any) {
      setOn(!next);
      setError(err?.message || 'Could not save that. Please try again.');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Email preferences</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
          New features and the occasional offer, a few times a year. Every email has an unsubscribe
          link, and account emails (like Pro receipts) aren't affected.
        </Typography>
        <FormControlLabel
          control={<Switch checked={on} disabled={busy} inputProps={{ role: 'switch' }} onChange={(e) => change(e.target.checked)} />}
          label='News and offers by email'
        />
        {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button color='inherit' onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
