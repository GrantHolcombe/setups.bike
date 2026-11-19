import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { IBike } from '../../App';
import SettingInput from './SettingInput';

export interface ISusMenuProps {
  bikeDetail: IBike,
  detail: string,
  setBikeVal: (name: string, value: number) => void,
  //saves one setting right away (name, value)
  saveBike?: (name: string, value: number) => void,
  //fields whose last save failed
  failed?: string[]
}

const OPTIONS = [
  { count: 0, label: 'None' },
  { count: 1, label: 'Single' },
  { count: 2, label: 'Dual' },
];

export default function SusMenu({bikeDetail, detail, setBikeVal, saveBike, failed = []}: ISusMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | SVGSVGElement>(null);
  const open = Boolean(anchorEl);
  const isComp: boolean = detail.includes("comp");
  const countKey = `${detail}count`;

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    setAnchorEl(event.currentTarget);
  };

  //clicking outside or pressing Escape just closes the menu and keeps the current setting
  const closeMenu = () => setAnchorEl(null);

  //picking None / Single / Dual changes the setting and saves it straight away
  const choose = (count: number) => {
    setBikeVal(countKey, count);
    if (saveBike) saveBike(countKey, count);
    setAnchorEl(null);
  };

  const rawCount = Number(bikeDetail[countKey as keyof IBike]);
  const detailLength = Number.isInteger(rawCount) ? Math.min(2, Math.max(0, rawCount)) : 0;

  const valueOf = (key: string) => bikeDetail[key as keyof IBike] as number | null | undefined;

  return (
    <div className='suspensionCompression'>
        <div className='featureTitle'>{isComp ? 'Compression' : 'Rebound'}</div>
        <SettingsOutlinedIcon onClick={handleClick} />
        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={closeMenu}
        >
            {OPTIONS.map((o) => (
              <MenuItem key={o.count} selected={o.count === detailLength} onClick={() => choose(o.count)}>{o.label}</MenuItem>
            ))}
        </Menu>
        {Array(detailLength).fill(0).map((e, i) => {
        const key = `${detail}${i + 1}`;
        return (
        <span key={key}>
            <label className='susComponentLabel' htmlFor={key}>{i === 1 ? `HS${isComp ? 'C' : 'R'}` : `LS${isComp ? 'C' : 'R'}`}</label>
            <SettingInput name={key} value={valueOf(key)} onChange={setBikeVal} invalid={failed.includes(key)}
              onCommit={(name, value) => { if (saveBike) saveBike(name, value); }} />
        </span>)})}
    </div>
  );
}
