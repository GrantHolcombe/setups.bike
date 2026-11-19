import * as React from 'react';
import { Button } from '@mui/material';
import { EditNote, History, Share } from '@mui/icons-material';
import { IBike, useAppContext } from '../../App';
import { RideHistoryDialog, RideLogDialog } from './RideNotes';
import ShareDialog from './ShareDialog';

// Pro actions on a bike card: log a ride, ride history (2.2) and share (2.3).
// Share also shows for a lapsed Pro user who still has links, so they can remove them.
export default function ProActions({ bike, beforeChange }: { bike: IBike; beforeChange?: () => Promise<void> }) {
  const { account, shares } = useAppContext();
  const [logOpen, setLogOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const isPro = account?.plan === 'pro' && !!account.billingEnabled;
  const hasLinks = shares.some((s) => s.bike_id === bike.bike_id);
  if (!isPro && !hasLinks) return null;

  const sx = { textTransform: 'none', minWidth: 0 } as const;
  return (
    <div className='proActions'>
      {isPro && <Button size='small' startIcon={<EditNote />} sx={sx} onClick={() => setLogOpen(true)}>Log ride</Button>}
      {isPro && <Button size='small' startIcon={<History />} sx={sx} onClick={() => setHistoryOpen(true)}>Rides</Button>}
      <Button size='small' startIcon={<Share />} sx={sx} onClick={() => setShareOpen(true)}>Share</Button>

      <RideLogDialog bike={bike} beforeChange={beforeChange} open={logOpen} onClose={() => setLogOpen(false)}
        onSaved={() => { setLogOpen(false); setVersion((v) => v + 1); setHistoryOpen(true); }} />
      {isPro && (
        <RideHistoryDialog bike={bike} beforeChange={beforeChange} open={historyOpen} version={version} onClose={() => setHistoryOpen(false)}
          onLogRide={() => { setHistoryOpen(false); setLogOpen(true); }} />
      )}
      <ShareDialog bike={bike} beforeChange={beforeChange} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
