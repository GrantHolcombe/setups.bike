import * as React from 'react';
import { Modal, Box, Typography, Button, Tooltip } from '@mui/material'
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useAppContext, IBike } from '../../../App';
import { useEffect } from 'react';

interface IReorderGarageProps {
    open: boolean;
    closeModal: Function;
    bikeList?: IBike[];
}

export default function ReorderGarageModal({open, closeModal, bikeList}: IReorderGarageProps) {
    const [deleteList, setDeleteList] = React.useState<Number[]>([])
    const [tempList, setTempList] = React.useState<IBike[]>([]);
    const { token, setLoading, refreshBikes } = useAppContext();

    const style = {
        position: 'absolute' as 'absolute',
        top: '225px',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 315,
        bgcolor: 'background.paper',
        boxShadow: 24,
        borderRadius: '8px',
        p: 4,
    };


    const actionStyles = {
        display: 'flex',
        justifyContent: 'flex-end',
        padding: "15px 0px",
        marginTop: "30px",
        borderTop: "1px solid #CDCDCD"
    }

    const handleClose = ():void => {
        setDeleteList([]);
        closeModal();
    }
    useEffect(() => {
        if (bikeList) { setTempList(bikeList) }
    }, [bikeList]);

    const reorder = (isUp: boolean, bike_id: number) => {
        let temp: IBike[] = [...tempList],
            bikeIndex = tempList.findIndex(item => item.bike_id === bike_id);
        if (isUp) {
            if (bikeIndex > 0) {
                console.log(bikeIndex);
                temp[bikeIndex - 1].garage_order = bikeIndex + 1;
                temp[bikeIndex].garage_order = bikeIndex;
                setTempList(temp.sort((a, b) => a.garage_order - b.garage_order));
            }
        }
        else {
            if (bikeIndex < tempList.length - 1) {
                temp[bikeIndex + 1].garage_order = bikeIndex + 1;
                temp[bikeIndex].garage_order = bikeIndex + 2;
                setTempList(temp.sort((a, b) => a.garage_order - b.garage_order));
            }
        }
    }


    const saveOrder = async () => {
        closeModal();
        setLoading(true);
        
        const req = {
            token,
            tempList
        }

        console.log(JSON.stringify(req));
        //const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/DeleteBike'
        //const data = await fetch(url, {method: "POST", body: JSON.stringify(req)})

        refreshBikes();
    }

    return (
        <Modal
            open={open}
            onClose={handleClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                <Typography sx={{ paddingBottom: 1 }} id="modal-modal-title" variant="h6" component="h2">
                    Quite the quiver
                </Typography>
                <Typography variant="subtitle2" sx={{paddingTop: 2, paddingBottom: 1}} component="div">
                    Feel free to move bikes up or down in priority:
                </Typography>
                    {tempList.map((e: IBike, i: Number) => {
                        return(
                            <div key={e.bike_id} style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0px"}}>
                                <Button disabled={e.garage_order == 1} onClick={() => reorder(true, e.bike_id)}><ArrowUpward/></Button>
                                <Typography variant="subtitle2" sx={{paddingTop: 2, paddingBottom: 1}} component="div">
                                    {e.brand} {e.model} {e.garage_order}
                                </Typography>
                                <Button disabled={e.garage_order == tempList.length} onClick={() => reorder(false, e.bike_id)}><ArrowDownward/></Button>
                            </div>
                        )
                    })}
                <Box sx={actionStyles}>
                    <Button color='warning' sx={{marginRight: 2}} variant="outlined" onClick={() => handleClose()}>Cancel</Button>
                    <Button variant="contained" color='secondary' disabled={deleteList.length === 0} onClick={() => saveOrder()}>Remove Selected</Button>
                </Box>
            </Box>
        </Modal>
    );
}