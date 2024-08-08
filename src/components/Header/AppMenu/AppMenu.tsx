import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import AddBikeModal from './AddBikeModal';
import DeleteBikeModal from './DeleteBikeModal';
import { IAppMenuProps } from '../Header';

export default function AppMenu({logout, bikeList, addBikeOpen, setAddBikeOpen}: IAppMenuProps) {
    const [anchorEl, setAnchorEl] = React.useState<null | SVGSVGElement>(null);
   // const [ addBikeOpen, setAddBikeOpen ] = React.useState<boolean>(false);
    const [ deleteBikeOpen, setDeleteBikeOpen ] = React.useState<boolean>(false);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const iconStyle ={
        color: "#FFF",
        padding: '13px 15px',
        background: 'red',
        borderRadius: 8,
        cursor: 'pointer',
        boxShadow: "0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)"
    }

    interface modalEvent {
        event: Object;
        reason: string;
    }

    const handleModalClose = () => {
        setAddBikeOpen(false);
    }

    const menuItemStyle = {
        width: 300,
        justifyContent: 'flex-end',
        margin: "0px 5px"
    }


    return (
    <div className='appMenuWrapper'>
        <PedalBikeIcon style={iconStyle} onClick={handleClick} />
        <Menu
            id="app-menu"
            anchorEl={anchorEl}
            open={open}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            onClose={() => setAnchorEl(null)}
            MenuListProps={{
            'aria-labelledby': 'basic-button',
            }}
        >
            <MenuItem sx={menuItemStyle} onClick={() => { setAnchorEl(null); setAddBikeOpen(true);}}>Add a New Bike</MenuItem>
            <MenuItem sx={menuItemStyle} disabled>Reorder Bike's in Garage</MenuItem>
            <MenuItem sx={menuItemStyle} disabled={bikeList?.length === 0} onClick={() => { setAnchorEl(null); setDeleteBikeOpen(true);}}>Retire a Bike from Garage</MenuItem>
            <MenuItem sx={{...menuItemStyle, borderTop: '1px solid #CDCDCD'}} onClick={() => { setAnchorEl(null); logout();}}>Logout</MenuItem>
        </Menu>
        <AddBikeModal open={addBikeOpen} closeModal={handleModalClose} />
        <DeleteBikeModal open={deleteBikeOpen} closeModal={() => setDeleteBikeOpen(false)} bikeList={bikeList} />
    </div>
    );
}