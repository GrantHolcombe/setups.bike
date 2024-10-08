import * as React from 'react';
import { Modal, Box, TextField, Typography, Button, Tooltip } from '@mui/material'
import { useAppContext } from '../../../App';

export interface IAppMenuProps {
    open: boolean;
    closeModal: Function;
}
interface INewBike {
    brand: string;
    model: string;
}

export default function AddBikeModal({open, closeModal}: IAppMenuProps) {
    const [newBike, setNewBike] = React.useState<INewBike>({brand: "", model: ""})
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

    const inputStyle = {
        width: '100%',
        marginTop: 1,
    }
    
    const saveValidation = ():boolean => {
        //return true if either string is empty
        return newBike.brand.length === 0 || newBike.model.length === 0
    }

    const saveNewBike = async () => {
        closeModal();
        setLoading(true);
        const req = {
            token,
            brand: newBike.brand,
            model: newBike.model
        }
        const url = 'https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/AddBike?' + new URLSearchParams(req).toString();
        const data = await fetch(url, {method: 'POST'});
        if (data.status === 200) {
            refreshBikes();
            setNewBike({brand:"",model:""});
        }
    }

    return (
        <Modal
            open={open}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                <Typography sx={{ paddingBottom: 1 }} id="modal-modal-title" variant="h6" component="h2">
                    Add a Steed to the Stable!
                </Typography>
                <TextField sx={inputStyle} autoComplete='off' id="bikeBrand" label="Brand" variant="standard" value={newBike.brand} onChange={e => {setNewBike({brand: e.target.value, model: {...newBike}.model})}} />
                <TextField sx={inputStyle} autoComplete='off' id="bikeModel" label="Model" variant="standard" value={newBike.model} onChange={e => {setNewBike({brand: {...newBike}.brand, model: e.target.value})}} />
                <Box sx={actionStyles}>
                    <Button color='error' sx={{marginRight: 2}} variant="outlined" onClick={() => { setNewBike({brand:"",model:""}); closeModal()}}>Cancel</Button>
                    {saveValidation() ? 
                        <Tooltip title="Both fields require some input in order to save" arrow placement='bottom-start'>
                            <span><Button disabled variant="outlined">Save</Button></span>
                        </Tooltip>
                    :
                        <Button variant="contained" onClick={saveNewBike}>Save</Button>
                    }
                </Box>
            </Box>
        </Modal>
    );
}