import * as React from 'react';
import {
  Alert, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Menu, MenuItem, Rating, TextField, Typography,
} from '@mui/material';
import { MoreVert } from '@mui/icons-material';
import { IBike, useAppContext } from '../../App';
import {
  CONDITIONS, Condition, IRideFields, IRideNote, addRide, conditionLabel, deleteRide, editRide,
  formatRideDate, listRides, localToday, reuseRide,
} from '../../rides';
import SettingsSummary from './SettingsSummary';
import Spinner from '../Spinner';

const blank = (): IRideFields => ({ rideDate: localToday(), trail: '', conditions: null, rating: null, note: '' });
const fieldsOf = (n: IRideNote): IRideFields => ({
  rideDate: n.ride_date, trail: n.trail || '', conditions: n.conditions, rating: n.rating, note: n.note || '',
});

interface ILogProps {
  bike: IBike;
  // saves the card's pending edits first, so the ride keeps the latest settings
  beforeChange?: () => Promise<void>;
  open: boolean;
  // set when editing an existing note
  editing?: IRideNote | null;
  onClose: () => void;
  onSaved: (note: IRideNote) => void;
}

// Log a ride (or edit one). New notes keep the bike's current settings with them.
export function RideLogDialog({ bike, beforeChange, open, editing, onClose, onSaved }: ILogProps) {
  const { token } = useAppContext();
  const [f, setF] = React.useState<IRideFields>(blank());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (open) { setF(editing ? fieldsOf(editing) : blank()); setError(''); setBusy(false); }
  }, [open, editing]);

  const set = (patch: Partial<IRideFields>) => { setF((prev) => ({ ...prev, ...patch })); setError(''); };

  const submit = async () => {
    if (!f.trail.trim() && !f.note.trim() && !f.rating && !f.conditions) {
      setError('Add a trail, rating, conditions or a note');
      return;
    }
    setBusy(true);
    try {
      if (!editing) await beforeChange?.();
      const { note } = editing ? await editRide(token, editing.ride_note_id, f) : await addRide(token, bike.bike_id, f);
      onSaved(note);
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || 'Could not save this ride. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='xs' fullWidth>
      <DialogTitle>{editing ? 'Edit ride' : 'Log a ride'}</DialogTitle>
      <DialogContent>
        <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
          {editing
            ? 'The settings saved with this ride stay as they were.'
            : `Saves with ${bike.brand} ${bike.model}'s current settings.`}
        </Typography>
        <TextField type='date' label='Ride date' variant='standard' fullWidth InputLabelProps={{ shrink: true }}
          inputProps={{ max: localToday() }} value={f.rideDate} onChange={(e) => set({ rideDate: e.target.value })} sx={{ mb: 2 }} />
        <TextField label='Trail or place' variant='standard' fullWidth inputProps={{ maxLength: 80 }}
          value={f.trail} onChange={(e) => set({ trail: e.target.value })} sx={{ mb: 2 }} />
        <Typography variant='caption' component='div' sx={{ color: 'text.secondary', mb: 0.5 }}>Conditions</Typography>
        <div className='rideChips'>
          {CONDITIONS.map((c) => (
            <Chip key={c.value} label={c.label} size='small' color={f.conditions === c.value ? 'primary' : 'default'}
              variant={f.conditions === c.value ? 'filled' : 'outlined'}
              onClick={() => set({ conditions: f.conditions === c.value ? null : (c.value as Condition) })} />
          ))}
        </div>
        <Typography variant='caption' component='div' sx={{ color: 'text.secondary', mt: 2 }}>How did it ride?</Typography>
        <Rating value={f.rating} onChange={(_e, v) => set({ rating: v })} />
        <TextField label='Notes' variant='standard' fullWidth multiline minRows={2} maxRows={8}
          inputProps={{ maxLength: 2000 }} value={f.note} onChange={(e) => set({ note: e.target.value })}
          placeholder='Fork felt harsh on roots, try one click less compression' sx={{ mt: 2 }} />
        {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button color='inherit' disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant='contained' disabled={busy} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save' : 'Log ride'}</Button>
      </DialogActions>
    </Dialog>
  );
}

interface IHistoryProps {
  bike: IBike;
  beforeChange?: () => Promise<void>;
  open: boolean;
  onClose: () => void;
  onLogRide: () => void;
  // bumps when a ride is logged from outside, so the list reloads
  version: number;
}

type Confirm = { kind: 'reuse' | 'delete'; note: IRideNote } | null;

// The bike's ride history, newest ride first.
export function RideHistoryDialog({ bike, beforeChange, open, onClose, onLogRide, version }: IHistoryProps) {
  const { token, refreshBikes, setLoading } = useAppContext();
  const [notes, setNotes] = React.useState<IRideNote[] | null>(null);
  const [error, setError] = React.useState('');
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [menu, setMenu] = React.useState<{ anchor: HTMLElement; note: IRideNote } | null>(null);
  const [editing, setEditing] = React.useState<IRideNote | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);

  const load = React.useCallback(async () => {
    setError('');
    try {
      setNotes(await listRides(token, bike.bike_id));
    } catch (err: any) {
      setNotes([]);
      setError(err?.message || 'Could not load rides.');
    }
  }, [token, bike.bike_id]);

  React.useEffect(() => { if (open) { setNotes(null); setExpanded(null); load(); } }, [open, version, load]);

  const doConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try {
      if (c.kind === 'delete') {
        await deleteRide(token, c.note.ride_note_id);
        setNotes((prev) => (prev || []).filter((n) => n.ride_note_id !== c.note.ride_note_id));
      } else {
        setLoading(true);
        await beforeChange?.();
        await reuseRide(token, c.note.ride_note_id);
        onClose();
        refreshBikes();
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth scroll='paper'>
        <DialogTitle>Rides · {bike.model}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
          {notes === null && <div className='rideLoading'><Spinner /></div>}
          {notes?.length === 0 && !error && (
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
              No rides logged yet. Log a ride to remember how this setup felt.
            </Typography>
          )}
          {notes?.map((n) => (
            <div key={n.ride_note_id} className='rideItem'>
              <div className='rideItemHead'>
                <div>
                  <div className='rideItemDate'>{formatRideDate(n.ride_date)}</div>
                  <div className='rideItemMeta'>
                    {n.trail && <span>{n.trail}</span>}
                    {n.conditions && <Chip label={conditionLabel(n.conditions)} size='small' variant='outlined' />}
                    {n.rating && <Rating value={n.rating} size='small' readOnly />}
                  </div>
                </div>
                <IconButton size='small' aria-label='Ride actions' onClick={(e) => setMenu({ anchor: e.currentTarget, note: n })}>
                  <MoreVert fontSize='small' />
                </IconButton>
              </div>
              {n.note && <Typography variant='body2' className='rideItemNote'>{n.note}</Typography>}
              <Button size='small' sx={{ textTransform: 'none', px: 0 }}
                onClick={() => setExpanded(expanded === n.ride_note_id ? null : n.ride_note_id)}>
                {expanded === n.ride_note_id ? 'Hide settings' : `Settings${n.setup_name ? ` (${n.setup_name})` : ''}`}
              </Button>
              <Collapse in={expanded === n.ride_note_id} unmountOnExit>
                <SettingsSummary settings={n.settings} />
              </Collapse>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button color='inherit' onClick={onClose}>Close</Button>
          <Button variant='contained' onClick={onLogRide}>Log a ride</Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setEditing(menu!.note); setMenu(null); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setConfirm({ kind: 'reuse', note: menu!.note }); setMenu(null); }}>Use these settings again</MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setConfirm({ kind: 'delete', note: menu!.note }); setMenu(null); }}>Delete</MenuItem>
      </Menu>

      <RideLogDialog bike={bike} beforeChange={beforeChange} open={!!editing} editing={editing} onClose={() => setEditing(null)}
        onSaved={(note) => { setEditing(null); setNotes((prev) => (prev || []).map((n) => (n.ride_note_id === note.ride_note_id ? note : n))); }} />

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth='xs' fullWidth>
        <DialogTitle>{confirm?.kind === 'delete' ? 'Delete this ride?' : 'Use these settings again?'}</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            {confirm?.kind === 'delete'
              ? 'This removes the ride note. It can’t be undone.'
              : `This replaces ${bike.model}'s current settings with the ones from ${confirm ? formatRideDate(confirm.note.ride_date) : ''}. Save the current ones as a setup first if you want to keep them.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color='inherit' onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant='contained' color={confirm?.kind === 'delete' ? 'error' : 'primary'} onClick={doConfirm}>
            {confirm?.kind === 'delete' ? 'Delete' : 'Use settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
