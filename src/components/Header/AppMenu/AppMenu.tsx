import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import AddBikeModal from './AddBikeModal';
import { IAppMenuProps } from '../Header';

export default function AppMenu({logout}: IAppMenuProps) {
    const [anchorEl, setAnchorEl] = React.useState<null | SVGSVGElement>(null);
    const [ addBikeOpen, setAddBikeOpen ] = React.useState<boolean>(false);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const iconStyle ={
        color: "#FFF",
        padding: '13px 15px',
        background: 'red',
        borderRadius: 50
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
            <MenuItem sx={menuItemStyle} disabled>Retire a Bike from Garage</MenuItem>
            <MenuItem sx={{...menuItemStyle, borderTop: '1px solid #CDCDCD'}} onClick={() => { setAnchorEl(null); logout();}}>Logout</MenuItem>
        </Menu>
        <AddBikeModal open={addBikeOpen} closeModal={handleModalClose} />
    </div>
    );
}