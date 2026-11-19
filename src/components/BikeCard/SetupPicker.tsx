import * as React from 'react';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  ListItemIcon, Menu, MenuItem, Snackbar, TextField, Typography,
} from '@mui/material';
import { Check, ExpandMore, Tune } from '@mui/icons-material';
import { IBike, useAppContext } from '../../App';
import {
  IBikeSetup, NAME_IDEAS, applySetup, deleteSetup, matchesSetup, renameSetup, saveSetup, updateSetup,
} from '../../setups';

interface ISetupPickerProps {
  bike: IBike;
  // saves the card's pending edits first, so setups read and overwrite the latest values
  beforeChange?: () => Promise<void>;
}

type NameDialog = { mode: 'save' | 'rename'; value: string; error?: string } | null;

// Pro feature 2.1: switch between, save, update, rename and delete named setups for a bike.
// Names and settings are the user's own; nothing here suggests values.
export default function SetupPicker({ bike, beforeChange }: ISetupPickerProps) {
  const { account, token, setups, refreshSetups, refreshBikes, setLoading } = useAppContext();
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const [nameDialog, setNameDialog] = React.useState<NameDialog>(null);
  const [confirm, setConfirm] = React.useState<{ kind: 'switch' | 'delete'; setup: IBikeSetup } | null>(null);
  const [error, setError] = React.useState('');

  if (!(account?.plan === 'pro' && account.billingEnabled)) return null;

  const mine = setups.filter((s) => s.bike_id === bike.bike_id);
  const active = mine.find((s) => s.bike_setup_id === bike.active_setup_id);
  const edited = !!active && !matchesSetup(bike, active);
  // current settings aren't stored in any of this bike's setups
  const unsaved = !mine.some((s) => matchesSetup(bike, s));

  const label = active
    ? `${active.name}${edited ? ' (edited)' : ''}`
    : mine.length > 0 ? 'Choose a setup' : 'Save this setup';

  const run = async (work: () => Promise<unknown>, reloadBikes = true) => {
    setAnchor(null);
    setLoading(true);
    try {
      await beforeChange?.();
      await work();
      await refreshSetups();
      if (reloadBikes) refreshBikes();
      else setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const switchTo = (setup: IBikeSetup) => {
    if (setup.bike_setup_id === active?.bike_setup_id && !edited) { setAnchor(null); return; }
    if (unsaved && mine.length > 0) { setAnchor(null); setConfirm({ kind: 'switch', setup }); return; }
    run(() => applySetup(token, setup.bike_setup_id));
  };

  const submitName = async () => {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) { setNameDialog({ ...nameDialog, error: 'Give this setup a name' }); return; }
    if (name.length > 40) { setNameDialog({ ...nameDialog, error: 'Keep it to 40 characters' }); return; }
    const mode = nameDialog.mode;
    setLoading(true);
    try {
      await beforeChange?.();
      if (mode === 'save') await saveSetup(token, bike.bike_id, name);
      else if (active) await renameSetup(token, active.bike_setup_id, name);
      setNameDialog(null);
      await refreshSetups();
      if (mode === 'save') refreshBikes(); else setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setNameDialog({ ...nameDialog, error: err?.message || 'Could not save that name' });
    }
  };

  return (
    <div className='setupPicker'>
      <Button size='small' variant='outlined' color='primary' startIcon={<Tune />} endIcon={<ExpandMore />}
        onClick={(e) => setAnchor(e.currentTarget)} sx={{ textTransform: 'none', maxWidth: '100%' }}>
        <span className='setupPickerLabel'>{label}</span>
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {mine.map((s) => (
          <MenuItem key={s.bike_setup_id} onClick={() => switchTo(s)}>
            <ListItemIcon>{s.bike_setup_id === active?.bike_setup_id ? <Check fontSize='small' /> : null}</ListItemIcon>
            {s.name}
          </MenuItem>
        ))}
        {mine.length > 0 && <Divider />}
        {active && edited && (
          <MenuItem onClick={() => run(() => updateSetup(token, active.bike_setup_id))}>Update "{active.name}" with current settings</MenuItem>
        )}
        <MenuItem onClick={() => { setAnchor(null); setNameDialog({ mode: 'save', value: '' }); }}>Save current settings as new setup…</MenuItem>
        {active && (
          <MenuItem onClick={() => { setAnchor(null); setNameDialog({ mode: 'rename', value: active.name }); }}>Rename "{active.name}"…</MenuItem>
        )}
        {active && (
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { setAnchor(null); setConfirm({ kind: 'delete', setup: active }); }}>
            Delete "{active.name}"…
          </MenuItem>
        )}
      </Menu>

      <Dialog open={!!nameDialog} onClose={() => setNameDialog(null)} maxWidth='xs' fullWidth>
        <DialogTitle>{nameDialog?.mode === 'rename' ? 'Rename setup' : 'Save as new setup'}</DialogTitle>
        <DialogContent>
          {nameDialog?.mode === 'save' && (
            <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
              Saves {bike.brand} {bike.model}'s current settings under this name.
            </Typography>
          )}
          <TextField autoFocus fullWidth variant='standard' label='Setup name' inputProps={{ maxLength: 40 }}
            value={nameDialog?.value ?? ''} error={!!nameDialog?.error} helperText={nameDialog?.error || ' '}
            onChange={(e) => nameDialog && setNameDialog({ ...nameDialog, value: e.target.value, error: undefined })}
            onKeyDown={(e) => { if (e.key === 'Enter') submitName(); }} />
          {nameDialog?.mode === 'save' && (
            <div className='setupNameIdeas'>
              {NAME_IDEAS.filter((n) => !mine.some((s) => s.name.toLowerCase() === n.toLowerCase())).map((n) => (
                <Chip key={n} label={n} size='small' variant='outlined'
                  onClick={() => setNameDialog({ ...nameDialog, value: n, error: undefined })} />
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button color='inherit' onClick={() => setNameDialog(null)}>Cancel</Button>
          <Button variant='contained' onClick={submitName}>{nameDialog?.mode === 'rename' ? 'Rename' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth='xs' fullWidth>
        <DialogTitle>{confirm?.kind === 'delete' ? `Delete "${confirm.setup.name}"?` : `Switch to "${confirm?.setup.name}"?`}</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            {confirm?.kind === 'delete'
              ? "This removes the saved setup. Your bike's current settings stay as they are."
              : "Your current settings aren't saved in any setup, so switching will replace them. Save them first if you want to keep them."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color='inherit' onClick={() => setConfirm(null)}>Cancel</Button>
          {confirm?.kind === 'switch' && (
            <Button onClick={() => { setConfirm(null); setNameDialog({ mode: 'save', value: '' }); }}>Save first</Button>
          )}
          <Button variant='contained' color={confirm?.kind === 'delete' ? 'error' : 'primary'} onClick={() => {
            const c = confirm; setConfirm(null);
            if (!c) return;
            if (c.kind === 'delete') run(() => deleteSetup(token, c.setup.bike_setup_id));
            else run(() => applySetup(token, c.setup.bike_setup_id));
          }}>{confirm?.kind === 'delete' ? 'Delete' : 'Switch anyway'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity='error' variant='filled' onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </div>
  );
}
