import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { AddBoxOutlined, IosShare } from '@mui/icons-material';

// keeps an icon sitting on the text line like a word
const iconSx = { fontSize: '1.15em', verticalAlign: 'text-bottom', mx: 0.25 };

// iPhone and iPad have no install button, so explain Safari's Share > Add to Home Screen.
export default function InstallHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // number in its own column; the step itself flows as normal text with inline icons
  const step = (n: number, body: React.ReactNode) => (
    <Box sx={{ display: 'flex', gap: 1, py: 0.75 }}>
      <Typography variant='body2' component='span' sx={{ fontWeight: 700, minWidth: '1.25em' }}>{n}.</Typography>
      <Typography variant='body2' component='span'>{body}</Typography>
    </Box>
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Add Setups.Bike to your Home Screen</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
          It opens full screen like an app, and you stay signed in.
        </Typography>
        {step(1, <>Tap <IosShare sx={iconSx} aria-label='Share' /><b>Share</b> in the browser's toolbar</>)}
        {step(2, <>Scroll down and tap <AddBoxOutlined sx={iconSx} aria-hidden /><b>Add to Home Screen</b></>)}
        {step(3, <>Tap <b>Add</b></>)}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}
