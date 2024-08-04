import * as React from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';

export interface IAppMenuProps {
    open: boolean;
    closeModal: Function;
}

export default function AddBikeModal({open, closeModal}: IAppMenuProps) {
 
    const style = {
        position: 'absolute' as 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        border: '1px solid #CDCDCD',
        boxShadow: 24,
        borderRadius: '8px',
        p: 4,
    };
    
    return (
        <Modal
            open={open}
            onClose={() => closeModal()}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
        <Box sx={style}>
            content
        </Box>
        </Modal>
    );
}