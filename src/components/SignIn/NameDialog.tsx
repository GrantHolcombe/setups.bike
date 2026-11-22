import * as React from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { saveName } from '../../signin';

interface INameDialogProps {
  open: boolean;
  token: string;
  // the name was saved; token is the fresh app token carrying it
  onSaved: (token: string) => void;
  onSkip: () => void;
}

// Asked once of new email sign-ups (Google gives us a name; email sign-in doesn't).
export default function NameDialog({ open, token, onSaved, onSkip }: INameDialogProps) {
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const save = async () => {
    if (!first.trim()) { setError('Enter your first name.'); return; }
    setBusy(true);
    setError('');
    try {
      onSaved(await saveName(token, first, last));
    } catch (err: any) {
      setError(err?.message || 'Could not save that. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onSkip} maxWidth='xs' fullWidth>
      <DialogTitle>Welcome to Setups.Bike!</DialogTitle>
      <Box component='form' noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <DialogContent>
          <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
            What should we call you?
          </Typography>
          <TextField fullWidth autoFocus label='First name' autoComplete='given-name' value={first}
            onChange={(e) => setFirst(e.target.value)} disabled={busy} sx={{ mb: 2 }} inputProps={{ maxLength: 100 }} />
          <TextField fullWidth label='Last name (optional)' autoComplete='family-name' value={last}
            onChange={(e) => setLast(e.target.value)} disabled={busy} inputProps={{ maxLength: 100 }} />
          {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button color='inherit' disabled={busy} onClick={onSkip}>Not now</Button>
          <Button type='submit' variant='contained' disabled={busy}>Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
