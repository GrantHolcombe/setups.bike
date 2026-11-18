import * as React from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import { ContentCopy, DeleteOutline, IosShare } from '@mui/icons-material';
import { IBike, useAppContext } from '../../App';
import { createShare, revokeShare, shareUrl } from '../../shares';

interface IShareDialogProps {
  bike: IBike;
  open: boolean;
  onClose: () => void;
}

// Pro feature 2.3: make a read-only link to this bike's current settings, and list or
// remove the bike's existing links. Removing a link works without Pro.
export default function ShareDialog({ bike, open, onClose }: IShareDialogProps) {
  const { token, account, shares, refreshShares } = useAppContext();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [latest, setLatest] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setError(''); setLatest(null); setCopied(null); } }, [open]);

  const isPro = account?.plan === 'pro' && account.billingEnabled;
  const mine = shares.filter((s) => s.bike_id === bike.bike_id);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { share } = await createShare(token, bike.bike_id);
      setLatest(share.share_id);
      await refreshShares();
    } catch (err: any) {
      setError(err?.message || 'Could not make a link. Please try again.');
    }
    setBusy(false);
  };

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(id));
      setCopied(id);
    } catch {
      setError('Copy didn’t work here. Select the link and copy it.');
    }
  };

  const nativeShare = (id: string) =>
    navigator.share?.({ title: `${bike.brand} ${bike.model} setup`, url: shareUrl(id) }).catch(() => {});

  const revoke = async (id: string) => {
    setError('');
    try {
      await revokeShare(token, id);
      if (latest === id) setLatest(null);
      await refreshShares();
    } catch (err: any) {
      setError(err?.message || 'Could not remove that link.');
    }
  };

  const linkRow = (id: string, detail?: string) => (
    <div key={id} className='shareRow'>
      <TextField size='small' fullWidth value={shareUrl(id)} InputProps={{ readOnly: true }}
        onFocus={(e) => e.target.select()} helperText={copied === id ? 'Copied' : detail || ' '} />
      <Tooltip title='Copy link'><IconButton onClick={() => copy(id)}><ContentCopy fontSize='small' /></IconButton></Tooltip>
      {typeof navigator.share === 'function' && (
        <Tooltip title='Share'><IconButton onClick={() => nativeShare(id)}><IosShare fontSize='small' /></IconButton></Tooltip>
      )}
      <Tooltip title='Remove link'><IconButton onClick={() => revoke(id)}><DeleteOutline fontSize='small' /></IconButton></Tooltip>
    </div>
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Share {bike.model}</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
          Anyone with the link can see this bike's brand, model and current settings, and copy them
          into their own garage. Your name and email are never shown. Later changes to the bike don't
          change a link; make a new one instead.
        </Typography>
        {isPro && (
          <Button variant='contained' disabled={busy} onClick={create} sx={{ mb: 2 }}>
            {busy ? 'Making link…' : 'Make a link to the current settings'}
          </Button>
        )}
        {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
        {mine.length > 0 && (
          <>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>Links for this bike</Typography>
            {mine.map((s) => linkRow(s.share_id, [
              s.share_id === latest ? 'New link' : `Made ${new Date(s.created_at).toLocaleDateString()}`,
              s.setup_name ? `"${s.setup_name}"` : '',
              `${s.views ?? 0} views`,
              `${s.copies ?? 0} copies`,
            ].filter(Boolean).join(' · ')))}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color='inherit' onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
