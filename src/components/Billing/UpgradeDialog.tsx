import * as React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert } from '@mui/material';
import { CheckCircleOutline } from '@mui/icons-material';
import { useAppContext } from '../../App';
import { BillingInterval, PRICES, startCheckout } from '../../billing';

export type UpgradeReason = 'menu' | 'limit';

interface IUpgradeDialogProps {
  open: boolean;
  reason: UpgradeReason;
  onClose: () => void;
}

const FEATURES = [
  'Unlimited bikes in your garage',
  'Multiple saved setups per bike',
  'Ride notes for every setup',
  'Suggested starting settings',
  'Share setups with friends',
];

export default function UpgradeDialog({ open, reason, onClose }: IUpgradeDialogProps) {
  const { token, account } = useAppContext();
  const [busy, setBusy] = React.useState<BillingInterval | null>(null);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    if (open) { setBusy(null); setError(''); }
  }, [open]);

  const choose = async (interval: BillingInterval) => {
    setBusy(interval);
    setError('');
    try {
      const { url } = await startCheckout(token, interval);
      window.location.assign(url);
    } catch (err: any) {
      setBusy(null);
      setError(err?.message || "Couldn't start checkout. Please try again.");
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Go Pro</DialogTitle>
      <DialogContent>
        {reason === 'limit' && (
          <Alert severity='info' sx={{ mb: 2 }}>
            The free plan holds {account?.bikeLimit ?? 3} bikes. Go Pro to add more.
          </Alert>
        )}
        {FEATURES.map((f) => (
          <Typography key={f} variant='body2' sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <CheckCircleOutline fontSize='small' sx={{ color: 'goldenrod' }} /> {f}
          </Typography>
        ))}
        <Typography variant='caption' component='p' sx={{ mt: 2, color: 'text.secondary' }}>
          Renews automatically. Cancel any time from Manage subscription; you keep Pro until the
          end of the period you paid for. See our <a href='terms.html' target='_blank' rel='noreferrer'>Terms</a> and{' '}
          <a href='refunds.html' target='_blank' rel='noreferrer'>Refund Policy</a>.
        </Typography>
        {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 3 }}>
        <Button variant='contained' color='primary' disabled={busy !== null} onClick={() => choose('year')}>
          {busy === 'year' ? 'Opening checkout…' : `${PRICES.year.label} · ${PRICES.year.detail}`}
        </Button>
        <Button variant='outlined' color='primary' disabled={busy !== null} onClick={() => choose('month')} sx={{ ml: '0 !important' }}>
          {busy === 'month' ? 'Opening checkout…' : PRICES.month.label}
        </Button>
        <Button color='inherit' disabled={busy !== null} onClick={onClose} sx={{ ml: '0 !important' }}>Not now</Button>
      </DialogActions>
    </Dialog>
  );
}
