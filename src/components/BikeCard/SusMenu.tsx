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
  //the cog also opens with Enter or Space, for keyboard users
  const handleKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setAnchorEl(event.currentTarget);
    }
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
        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={closeMenu}
        >
            {OPTIONS.map((o) => (
              <MenuItem key={o.count} selected={o.count === detailLength} onClick={() => choose(o.count)}>{o.label}</MenuItem>
            ))}
        </Menu>
        {/* one row: the cog on the left, then low- and high-speed side by side on the right
            (lined up with the Fork and Shock values) */}
        <div className='adjusterRow'>
          <SettingsOutlinedIcon className='adjusterCog' onClick={handleClick} onKeyDown={handleKey} role='button' tabIndex={0} aria-hidden={false}
            aria-label={`${isComp ? 'Compression' : 'Rebound'} adjusters`} aria-haspopup='menu' />
          <div className='adjusters'>
          {Array(detailLength).fill(0).map((e, i) => {
            const key = `${detail}${i + 1}`;
            const inputId = `${key}-${bikeDetail.bike_id}`; //unique across bike cards
            return (
            <div key={key} className='adjuster'>
              <label className='susComponentLabel' htmlFor={inputId}>{i === 1 ? `HS${isComp ? 'C' : 'R'}` : `LS${isComp ? 'C' : 'R'}`}</label>
              <SettingInput id={inputId} name={key} value={valueOf(key)} onChange={setBikeVal} invalid={failed.includes(key)}
                onCommit={(name, value) => { if (saveBike) saveBike(name, value); }} />
            </div>)})}
          </div>
        </div>
    </div>
  );
}
