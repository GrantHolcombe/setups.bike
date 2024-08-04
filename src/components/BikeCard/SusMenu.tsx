import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { IBike } from '../../App';

export interface ISusMenuProps {
  bikeDetail: IBike,
  detail: string,
  setBikeVal: Function,
  saveBike?: (a:any) => void
}

export default function SusMenu({bikeDetail, detail, setBikeVal, saveBike}: ISusMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | SVGSVGElement>(null);
    const open = Boolean(anchorEl);
    let isComp: boolean = detail.includes("comp");  

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = (val: number) => {
    setBikeVal((detail + 'count'), val);
    setAnchorEl(null);
  };

  const bikeUpdae = (e:any) => {
    if(saveBike) saveBike(e);
  }

  const valUpdate = (e: any, index: number) => {
    const detailValTarget = `${detail + index}` as keyof typeof bikeDetail
    const detailVal = bikeDetail[detailValTarget] ;

    setBikeVal(`${detail + index}`, parseInt(e.target.value));
  }

  const detailLengthTarget = `${detail + 'count'}` as keyof typeof bikeDetail
  const detailLength = bikeDetail[detailLengthTarget] ;

  const getDetailVal = (detail:string, index: number) => {
    const detailValTarget = `${detail}` as keyof typeof bikeDetail
    const detailVal = bikeDetail[detailValTarget] ;
    return detailVal
  }

  return (
    <div className='suspensionCompression'>
        <div className='featureTitle'>{isComp ? 'Compression' : 'Rebound'}</div>
        <SettingsOutlinedIcon onClick={handleClick} />
        <Menu
            id="basic-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
            'aria-labelledby': 'basic-button',
            }}
        >
            <MenuItem onClick={() => handleClose(0)}>None</MenuItem>
            <MenuItem onClick={() => handleClose(1)}>Single</MenuItem>
            <MenuItem onClick={() => handleClose(2)}>Dual</MenuItem>
        </Menu>
        {Array(detailLength).fill(0).map((e,i) => {
        return (
        <span>
            <label className='susComponentLabel' htmlFor={detail+`1`}>{i === 1 ? `HS${isComp ? 'C' : 'R'}` : `LS${isComp ? 'C' : 'R'}`}</label>
            <input type='number' className='componentInput' name={detail+`${i+1}`} value={getDetailVal(detail+`${i+1}`, i + 1)} onBlur={(e) =>{ console.log(e); if(saveBike) saveBike(e);} } onChange={(event) => valUpdate(event, (i + 1)) }/>
        </span>)})}
    </div>
  );
}