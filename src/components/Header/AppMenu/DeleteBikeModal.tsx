import * as React from 'react';
import {
    Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup, Typography,
} from '@mui/material';
import { Delete, DeleteOutline } from '@mui/icons-material';
import { useAppContext, IBike } from '../../../App';

interface IDeleteBikesProps {
    open: boolean;
    closeModal: Function;
    bikeList?: IBike[];
}

// Retire (delete) bikes. Follows the dialog pattern in docs/STYLE_GUIDE.md.
export default function DeleteBikeModal({ open, closeModal, bikeList }: IDeleteBikesProps) {
    const [deleteList, setDeleteList] = React.useState<number[]>([]);
    const { token, setLoading, refreshBikes } = useAppContext();

    const handleClose = (): void => {
        setDeleteList([]);
        closeModal();
    };

    const toggle = (id: number) =>
        setDeleteList((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

    const deleteBike = async () => {
        const ids = deleteList;
        setDeleteList([]);
        closeModal();
        setLoading(true);
        const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/DeleteBike';
        await fetch(url, { method: 'POST', body: JSON.stringify({ token, deleteList: ids }) });
        refreshBikes();
    };

    const n = deleteList.length;
    return (
        <Dialog open={open} onClose={handleClose} maxWidth='xs' fullWidth>
            <DialogTitle>Retire bikes</DialogTitle>
            <DialogContent>
                <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
                    All trail's end. Pick the bikes to remove. Their saved setups, ride notes and share
                    links are removed too, and this can't be undone.
                </Typography>
                <FormGroup>
                    {bikeList?.map((b) => {
                        const checked = deleteList.includes(b.bike_id);
                        return (
                            <FormControlLabel key={b.bike_id} label={`${b.brand} ${b.model}`}
                                sx={{ color: checked ? 'error.main' : 'inherit' }}
                                control={<Checkbox checked={checked} onChange={() => toggle(b.bike_id)}
                                    icon={<DeleteOutline />} checkedIcon={<Delete />} color='error' />} />
                        );
                    })}
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Button color='inherit' onClick={handleClose}>Cancel</Button>
                <Button variant='contained' color='error' disabled={n === 0} onClick={deleteBike}>
                    {n > 1 ? `Remove ${n} bikes` : 'Remove bike'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
