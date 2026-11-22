import * as React from 'react';
import { Alert, Button, Typography } from '@mui/material';
import { IShare, viewShare } from '../../shares';
import SettingsSummary from '../BikeCard/SettingsSummary';
import Spinner from '../Spinner';
import './SharedSetupView.css';

interface ISharedSetupViewProps {
  shareId: string;
  signedIn: boolean;
  // true when the header's welcome message sits above this page (signed in)
  belowWelcome: boolean;
  copying: boolean;
  copyError: string;
  onCopy: () => void;
  onClose: () => void;
}

// The public page for a shared link (setups.bike/?s=<id>). Works without signing in.
export default function SharedSetupView({ shareId, signedIn, belowWelcome, copying, copyError, onCopy, onClose }: ISharedSetupViewProps) {
  const [share, setShare] = React.useState<IShare | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let live = true;
    viewShare(shareId)
      .then((s) => { if (live) setShare(s); })
      .catch((err) => { if (live) setError(err?.message || 'Could not load this setup.'); });
    return () => { live = false; };
  }, [shareId]);

  return (
    <div className={`sharedSetup${belowWelcome ? '' : ' clearHeader'}`}>
      {!share && !error && <div className='sharedSetupLoading'><Spinner size={80} /></div>}
      {error && (
        <>
          <Alert severity='info' color='success' sx={{ mb: 2 }}>{error}</Alert>
          <Button variant='contained' onClick={onClose}>{signedIn ? 'Go to my garage' : 'Go to Setups.Bike'}</Button>
        </>
      )}
      {share && (
        <div className='cardContainer sharedSetupCard'>
          <Typography variant='overline' sx={{ color: 'text.secondary' }}>Shared setup</Typography>
          <div className='modelHeader'>{share.model}</div>
          <div className='brandHeader'>{share.brand}</div>
          {share.setup_name && <Typography variant='subtitle2' sx={{ mt: 1 }}>{share.setup_name}</Typography>}
          <SettingsSummary settings={share.settings} />
          <Typography variant='caption' component='p' className='sharedSetupNote' sx={{ mt: 2, mb: 3, lineHeight: 1.6 }}>
            Shared by another rider for their bike, weight and riding. It isn't a recommendation from
            Setups.Bike. Check against your suspension maker's guide before you ride.
          </Typography>
          {copyError && <Alert severity='error' sx={{ mb: 2 }}>{copyError}</Alert>}
          <div className='sharedSetupActions'>
            <Button variant='contained' disabled={copying} onClick={onCopy}>
              {copying ? 'Copying…' : signedIn ? 'Copy to my garage' : 'Sign in to copy to your garage'}
            </Button>
            <Button color='inherit' disabled={copying} onClick={onClose}>{signedIn ? 'Back to my garage' : 'No thanks'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
