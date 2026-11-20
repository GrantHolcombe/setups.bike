import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { AddBoxOutlined, IosShare } from '@mui/icons-material';

// keeps an icon sitting on the text line like a word
const iconSx = { fontSize: '1.15em', verticalAlign: 'text-bottom', mx: 0.25 };

// iPhone and iPad have no install button, so explain Safari's Share > Add to Home Screen.
export default function InstallHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Add Setups.Bike to your Home Screen</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
          It opens full screen like an app, and you stay signed in.
        </Typography>
        <Box component='ol' sx={{ typography: 'body2', m: 0, pl: 3, '& li': { py: 0.75 }, '& li::marker': { fontWeight: 700 } }}>
          <li>Tap <IosShare sx={iconSx} aria-label='Share' /><b>Share</b> in the browser's toolbar</li>
          <li>Scroll down and tap <AddBoxOutlined sx={iconSx} aria-hidden /><b>Add to Home Screen</b></li>
          <li>Tap <b>Add</b></li>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}
