import * as React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useAppContext } from '../../../App';

export interface IAppMenuProps {
    open: boolean;
    closeModal: Function;
}

const EMPTY = { brand: '', model: '' };

// Add a bike. Follows the dialog pattern in docs/STYLE_GUIDE.md.
export default function AddBikeModal({ open, closeModal }: IAppMenuProps) {
    const [newBike, setNewBike] = React.useState(EMPTY);
    const { token, setLoading, refreshBikes, openUpgrade } = useAppContext();
    const valid = newBike.brand.trim().length > 0 && newBike.model.trim().length > 0;

    const cancel = () => { setNewBike(EMPTY); closeModal(); };

    const saveNewBike = async () => {
        if (!valid) return;
        closeModal();
        setLoading(true);
        const req = { token, brand: newBike.brand.trim(), model: newBike.model.trim() };
        const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/AddBike?' + new URLSearchParams(req).toString();
        try {
            const data = await fetch(url, { method: 'POST' });
            if (data.status === 200) {
                refreshBikes();
                setNewBike(EMPTY);
                return;
            }
            setLoading(false);
            //free plan is full: offer Pro (the typed bike is kept for after upgrading)
            if (data.status === 403) openUpgrade('limit');
            else console.warn('addBike failed', data.status);
        } catch (err) {
            setLoading(false);
            console.warn(err);
        }
    };

    const submitOnEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') saveNewBike(); };

    return (
        <Dialog open={open} onClose={cancel} maxWidth='xs' fullWidth>
            <DialogTitle>Add a bike</DialogTitle>
            <DialogContent>
                <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
                    Add a steed to the stable!
                </Typography>
                <TextField autoFocus fullWidth autoComplete='off' id='bikeBrand' label='Brand' variant='standard'
                    inputProps={{ maxLength: 255 }} sx={{ mb: 1 }} value={newBike.brand} onKeyDown={submitOnEnter}
                    onChange={(e) => setNewBike((b) => ({ ...b, brand: e.target.value }))} />
                <TextField fullWidth autoComplete='off' id='bikeModel' label='Model' variant='standard'
                    inputProps={{ maxLength: 255 }} value={newBike.model} onKeyDown={submitOnEnter}
                    helperText={valid ? ' ' : 'Enter a brand and model to save'}
                    onChange={(e) => setNewBike((b) => ({ ...b, model: e.target.value }))} />
            </DialogContent>
            <DialogActions>
                <Button color='inherit' onClick={cancel}>Cancel</Button>
                <Button variant='contained' disabled={!valid} onClick={saveNewBike}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
