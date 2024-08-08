import * as React from 'react';
import { Modal, Box, FormGroup, FormControlLabel, Checkbox, Typography, Button, Tooltip } from '@mui/material'
import { DeleteOutline, Delete } from '@mui/icons-material';
import { useAppContext, IBike } from '../../../App';

interface IDeleteBikesProps {
    open: boolean;
    closeModal: Function;
    bikeList?: IBike[];
}

export default function DeleteBikeModal({open, closeModal, bikeList}: IDeleteBikesProps) {
    const [deleteList, setDeleteList] = React.useState<Number[]>([])
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

    const deleteBike = async () => {
        closeModal();
        setLoading(true);
        
        const req = {
            token,
            deleteList: deleteList
        }

        console.log(JSON.stringify(req));
        const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/DeleteBike'
        const data = await fetch(url, {method: "POST", body: JSON.stringify(req)})

        console.log(data.status);
        refreshBikes();
        // const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/deleteBike?' + new URLSearchParams(req).toString();
        // const data = await fetch(url, {method: 'POST'});
        // if (data.status === 200) {
        //     closeModal();
        //     refreshBikes();
        // }
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
                    All Trail's End
                </Typography>
                <Typography variant="subtitle2" sx={{paddingTop: 2, paddingBottom: 1}} component="div">
                    Select bikes to remove from your garage:
                </Typography>
                {bikeList && bikeList.map((e: IBike, i: Number) => {
                    return(
                        <FormGroup>
                            <FormControlLabel sx={{color: deleteList.includes(e.bike_id) ? 'red' : 'inherit'}} control={
                                <Checkbox 
                                    onChange={ () => {
                                        deleteList.includes(e.bike_id) ? 
                                            setDeleteList( deleteList.filter((item) => {return item !== e.bike_id}) ) 
                                            : 
                                            setDeleteList([...deleteList, e.bike_id]) } 
                                    }
                                    checked={deleteList.includes(e.bike_id)}
                                    icon={<DeleteOutline />}
                                    checkedIcon={<Delete color='secondary' />}
                                    />} 
                                    label={`${e.brand} ${e.model}`} 
                                />
                        </FormGroup>
                    )
                })}
                <Box sx={actionStyles}>
                    <Button color='warning' sx={{marginRight: 2}} variant="outlined" onClick={() => handleClose()}>Cancel</Button>
                    <Button variant="contained" color='secondary' disabled={deleteList.length === 0} onClick={() => deleteBike()}>Remove Selected</Button>
                </Box>
            </Box>
        </Modal>
    );
}