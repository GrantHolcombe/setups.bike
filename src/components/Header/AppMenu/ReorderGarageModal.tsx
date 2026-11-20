import * as React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { useAppContext, IBike } from '../../../App';

interface IReorderGarageProps {
    open: boolean;
    closeModal: Function;
    bikeList?: IBike[];
}

// Reorder the garage. Follows the dialog pattern in docs/STYLE_GUIDE.md.
export default function ReorderGarageModal({ open, closeModal, bikeList }: IReorderGarageProps) {
    const [tempList, setTempList] = React.useState<IBike[]>([]);
    const [hasChange, setHasChange] = React.useState<boolean>(false);
    const { token, setLoading, refreshBikes } = useAppContext();

    React.useEffect(() => {
        //work on copies numbered 1..n by list position: stored positions can have gaps
        //(e.g. after a bike is deleted), and editing the app's own bike objects would
        //change the garage before Save
        if (bikeList && open) {
            setTempList(bikeList.map((b, i) => ({ ...b, garage_order: i + 1 })));
            setHasChange(false);
        }
    }, [bikeList, open]);

    const move = (from: number, to: number) => {
        if (to < 0 || to >= tempList.length) return;
        const temp = [...tempList];
        [temp[from], temp[to]] = [temp[to], temp[from]];
        setTempList(temp.map((b, i) => ({ ...b, garage_order: i + 1 })));
        setHasChange(true);
    };

    const saveOrder = async () => {
        const req = { token, bikeList: tempList.map((b) => ({ bike_id: b.bike_id, garage_order: b.garage_order })) };
        setLoading(true);
        closeModal();
        await fetch('https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/reorderGarage', { method: 'POST', body: JSON.stringify(req) });
        refreshBikes();
    };

    return (
        <Dialog open={open} onClose={() => closeModal()} maxWidth='xs' fullWidth>
            <DialogTitle>Reorder garage</DialogTitle>
            <DialogContent>
                <Typography variant='body2' sx={{ mb: 1, color: 'text.secondary' }}>
                    Quite the quiver. Move bikes up or down to set the order on your garage page.
                </Typography>
                <ol className='reorderList'>
                    {tempList.map((b, i) => {
                        const name = `${b.brand} ${b.model}`;
                        return (
                            <li key={b.bike_id}>
                                <IconButton size='small' aria-label={`Move ${name} up`} disabled={i === 0}
                                    onClick={() => move(i, i - 1)}><KeyboardArrowUp /></IconButton>
                                <IconButton size='small' aria-label={`Move ${name} down`} disabled={i === tempList.length - 1}
                                    onClick={() => move(i, i + 1)}><KeyboardArrowDown /></IconButton>
                                <Typography variant='body2' component='span' sx={{ ml: 1 }}>
                                    <strong>{i + 1}.</strong> {name}
                                </Typography>
                            </li>
                        );
                    })}
                </ol>
            </DialogContent>
            <DialogActions>
                <Button color='inherit' onClick={() => closeModal()}>Cancel</Button>
                <Button variant='contained' disabled={!hasChange} onClick={saveOrder}>Save order</Button>
            </DialogActions>
        </Dialog>
    );
}
