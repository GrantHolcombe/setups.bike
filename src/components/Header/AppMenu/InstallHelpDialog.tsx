import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { AddBoxOutlined, IosShare } from '@mui/icons-material';

// iPhone and iPad have no install button, so explain Safari's Share > Add to Home Screen.
export default function InstallHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const step = (n: number, body: React.ReactNode) => (
    <Typography variant='body2' sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
      <strong>{n}.</strong> {body}
    </Typography>
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Add Setups.Bike to your Home Screen</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
          It opens full screen like an app, and you stay signed in.
        </Typography>
        {step(1, <>Tap <IosShare fontSize='small' aria-label='Share' /> <b>Share</b> in the browser's toolbar.</>)}
        {step(2, <>Scroll down and tap <AddBoxOutlined fontSize='small' aria-hidden /> <b>Add to Home Screen</b>.</>)}
        {step(3, <>Tap <b>Add</b>.</>)}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}
