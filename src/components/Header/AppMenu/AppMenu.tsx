import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import { IAppMenuProps } from '../Header';
import { useAppContext } from '../../../App';
import { AddBikeModal, DeleteAccountDialog, DeleteBikeModal, EmailPrefsDialog, InstallHelpDialog, ReorderGarageModal, WhenOpened } from '../../../lazy';
import { promptInstall, useInstallOption } from '../../../pwa';

export default function AppMenu({logout, onAccountDeleted, bikeList, addBikeOpen, setAddBikeOpen}: IAppMenuProps) {
    const { account, openUpgrade, manageBilling } = useAppContext();
    const isPro = account?.plan === 'pro';
    const proUntil = account?.cancelAtPeriodEnd && account.renewsAt
        ? new Date(account.renewsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    //free plan at its bike limit: offer Pro instead of the add form
    const addBike = () => {
        if (account && !account.canAddBike) openUpgrade('limit');
        else setAddBikeOpen(true);
    };
    const [anchorEl, setAnchorEl] = React.useState<null | SVGSVGElement>(null);
    const [ deleteBikeOpen, setDeleteBikeOpen ] = React.useState<boolean>(false);
    const [ reorderGarageOpen, setReorderGarageOpen ] = React.useState<boolean>(false);
    const [ installHelpOpen, setInstallHelpOpen ] = React.useState<boolean>(false);
    const [ emailPrefsOpen, setEmailPrefsOpen ] = React.useState<boolean>(false);
    const [ deleteAccountOpen, setDeleteAccountOpen ] = React.useState<boolean>(false);
    //'prompt' = the browser can install it, 'ios' = show Add to Home Screen steps, null = installed or not possible
    const installOption = useInstallOption();
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
            <MenuItem sx={menuItemStyle} onClick={() => { setAnchorEl(null); addBike();}}>Add a New Bike</MenuItem>
            <MenuItem sx={menuItemStyle} disabled={bikeList !== undefined && bikeList?.length < 2} onClick={() => { setAnchorEl(null); setReorderGarageOpen(true);}}>Reorder Bike's in Garage</MenuItem>
            <MenuItem sx={menuItemStyle} disabled={bikeList?.length === 0} onClick={() => { setAnchorEl(null); setDeleteBikeOpen(true);}}>Retire a Bike from Garage</MenuItem>
            {isPro
                ? <MenuItem sx={{...menuItemStyle, borderTop: '1px solid var(--border)', flexDirection: 'column', alignItems: 'flex-end'}}
                    disabled={!account?.canManageBilling} onClick={() => { setAnchorEl(null); manageBilling();}}>
                    Manage Subscription
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proUntil ? `Pro until ${proUntil}` : 'Pro plan'}</span>
                  </MenuItem>
                : account?.billingEnabled && <MenuItem sx={{...menuItemStyle, borderTop: '1px solid var(--border)', color: 'var(--gold-text)', fontWeight: 600}}
                    onClick={() => { setAnchorEl(null); openUpgrade('menu');}}>Go Pro</MenuItem>}
            {installOption && (
              <MenuItem sx={{...menuItemStyle, borderTop: '1px solid var(--border)'}} onClick={() => {
                  setAnchorEl(null);
                  if (installOption === 'prompt') promptInstall();
                  else setInstallHelpOpen(true);
                }}>{installOption === 'prompt' ? 'Install App' : 'Add to Home Screen'}</MenuItem>
            )}
            {/* account settings, set apart by a line above and below */}
            <MenuItem sx={{...menuItemStyle, borderTop: '1px solid var(--border)'}} onClick={() => { setAnchorEl(null); setEmailPrefsOpen(true);}}>Email preferences</MenuItem>
            <MenuItem sx={{...menuItemStyle, borderBottom: '1px solid var(--border)', color: 'error.main'}} onClick={() => { setAnchorEl(null); setDeleteAccountOpen(true);}}>Delete account</MenuItem>
            <MenuItem sx={menuItemStyle} onClick={() => { setAnchorEl(null); logout();}}>Logout</MenuItem>
        </Menu>
        <WhenOpened open={addBikeOpen}><AddBikeModal open={addBikeOpen} closeModal={handleModalClose} /></WhenOpened>
        <WhenOpened open={deleteBikeOpen}><DeleteBikeModal open={deleteBikeOpen} closeModal={() => setDeleteBikeOpen(false)} bikeList={bikeList} /></WhenOpened>
        <WhenOpened open={emailPrefsOpen}><EmailPrefsDialog open={emailPrefsOpen} onClose={() => setEmailPrefsOpen(false)} /></WhenOpened>
        <WhenOpened open={deleteAccountOpen}>
          <DeleteAccountDialog open={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)}
            onDeleted={() => { setDeleteAccountOpen(false); onAccountDeleted(); }} bikeCount={bikeList?.length || 0} />
        </WhenOpened>
        <WhenOpened open={installHelpOpen}><InstallHelpDialog open={installHelpOpen} onClose={() => setInstallHelpOpen(false)} /></WhenOpened>
        <WhenOpened open={reorderGarageOpen}><ReorderGarageModal open={reorderGarageOpen} closeModal={() => setReorderGarageOpen(false)} bikeList={bikeList} /></WhenOpened>
    </div>
    );
}