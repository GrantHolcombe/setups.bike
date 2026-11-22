import * as React from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { useAppContext } from '../../../App';
import { deleteAccount } from '../../../signin';

interface IDeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
  // the account is gone: sign out and say so
  onDeleted: () => void;
  bikeCount: number;
}

// Bike menu > Delete account (card "Sign-in 4"). Typing "delete" is the only way to enable the
// button, so it can't happen by accident. Follows the dialog pattern in docs/STYLE_GUIDE.md.
export default function DeleteAccountDialog({ open, onClose, onDeleted, bikeCount }: IDeleteAccountDialogProps) {
  const { token, account } = useAppContext();
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => { if (open) { setTyped(''); setError(''); } }, [open]);

  const confirmed = typed.trim().toLowerCase() === 'delete';
  const paidPro = account?.plan === 'pro' && account.planSource === 'stripe' && account.planStatus !== 'canceled';

  const remove = async () => {
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount(token);
      onDeleted();
    } catch (err: any) {
      setError(err?.message || "Your account wasn't deleted. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Delete your account?</DialogTitle>
      <Box component='form' noValidate onSubmit={(e) => { e.preventDefault(); remove(); }}>
        <DialogContent>
          <Typography variant='body2' sx={{ mb: 1 }}>
            This permanently deletes your account and everything in it:
          </Typography>
          <Box component='ul' sx={{ mt: 0, mb: 2, pl: 3, typography: 'body2' }}>
            <li>{bikeCount === 0 ? 'Your garage' : bikeCount === 1 ? 'Your bike and its settings' : `All ${bikeCount} bikes and their settings`}</li>
            <li>Saved setups, ride notes and any share links</li>
            <li>Your sign-in and email preferences</li>
          </Box>
          {paidPro && (
            <Alert severity='warning' sx={{ mb: 2 }}>
              Your Pro subscription is cancelled right away, and deleting doesn't refund it. To ask
              for a refund first, see the <a href='/refunds.html' style={{ color: 'inherit' }}>Refund Policy</a>.
            </Alert>
          )}
          <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
            This can't be undone. To confirm, type <strong>delete</strong> below.
          </Typography>
          <TextField fullWidth autoFocus label='Type "delete" to confirm' value={typed} disabled={busy}
            onChange={(e) => setTyped(e.target.value)} autoComplete='off'
            inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }} />
          {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button color='inherit' disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type='submit' variant='contained' color='error' disabled={!confirmed || busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
