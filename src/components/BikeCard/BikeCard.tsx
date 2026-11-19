import './BikeCard.css';
import { useEffect, useRef, useState } from 'react';
import React from 'react';
import SusMenu from './SusMenu';
import TokenInput from './TokenInput/TokenInput';
import SetupPicker from './SetupPicker';
import SettingInput from './SettingInput';
import ProActions from './ProActions';
import useBikeSaver from './useBikeSaver';
import { IBike, useAppContext } from '../../App';

export interface IBikeCardProps {
  thisBike: IBike
}

function BikeCard({thisBike}: IBikeCardProps) {
  const [bike, setBike] = useState<IBike>(thisBike);
  const { token } = useAppContext();
  const saver = useBikeSaver(thisBike.bike_id, token);
  const { unsaved } = saver;
  // what the server has, so leaving a field without changing it doesn't save anything
  const saved = useRef<Record<string, number>>({ ...(thisBike as any) });

  //take the server's version when the garage reloads (e.g. after applying a saved setup),
  //keeping any edits that haven't been saved yet
  useEffect(() => {
    saved.current = { ...(thisBike as any) };
    setBike({ ...thisBike, ...unsaved() });
  }, [thisBike, unsaved]);

  //functional update, so two changes in a row (type, then leave the field) both stick
  const setBikeVal = (target: string, value: number) => {
    setBike((prev) => ({ ...prev, [target]: value }));
  }

  //queue one setting to save; the saver batches quick changes into one request
  const commit = (name: string, value: number) => {
    if (Number(saved.current[name] ?? 0) === Number(value)) return;
    saved.current[name] = value;
    saver.queue({ [name]: value });
  };

  const setTokens = (name: 'front_tokens' | 'rear_tokens') => (count: number) => {
    setBikeVal(name, count);
    commit(name, count);
  };

  return (
    <div className="cardContainer" onFocusCapture={saver.dismiss}>
      <div>
        <div className='modelHeader'>
          {bike.model}
          <SaveStatus state={saver.state} onRetry={() => saver.flush()} />
        </div>
        <div className='brandHeader'>{bike.brand}</div>
        <SetupPicker bike={bike} beforeChange={saver.flush} />
        <ProActions bike={bike} beforeChange={saver.flush} />
      </div>
      <div className='cardBody'>
        <div className='tireSection front'>
          <div className='componentLabel'>Front Tire</div>
          <SettingInput name='front_tire' value={bike.front_tire} onChange={setBikeVal} onCommit={commit} invalid={saver.failed.includes('front_tire')} />
        </div>
        <div className='tireSection rear'>
          <div className='componentLabel'>Rear Tire</div>
          <SettingInput name='rear_tire' value={bike.rear_tire} onChange={setBikeVal} onCommit={commit} invalid={saver.failed.includes('rear_tire')} />
        </div>
      </div>
      <div className='cardBody rowTwo'>
        <div className='suspensionPressureSection front'>
          <div className='pressureRow'>
            <div className='componentLabel'>Fork</div>
            <SettingInput name='front_sus_pressure' value={bike.front_sus_pressure} onChange={setBikeVal} onCommit={commit} invalid={saver.failed.includes('front_sus_pressure')} />
          </div>
          <div className='suspensionCompression'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} failed={saver.failed} detail='front_sus_comp_'/>
          </div>
          <div className='suspensionRebound'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} failed={saver.failed} detail='front_sus_rebound_'/>
          </div>
          <TokenInput count={bike.front_tokens} onChange={setTokens('front_tokens')} invalid={saver.failed.includes('front_tokens')} />
        </div>
        <div className='suspensionPressureSection rear'>
          <div className='pressureRow'>
            <div className='componentLabel'>Shock</div>
            <SettingInput name='rear_sus_pressure' value={bike.rear_sus_pressure} onChange={setBikeVal} onCommit={commit} invalid={saver.failed.includes('rear_sus_pressure')} />
            <div className='suspensionCompression'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} failed={saver.failed} detail='rear_sus_comp_'/>
            </div>
            <div className='suspensionRebound'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} failed={saver.failed} detail='rear_sus_rebound_'/>
            </div>
            <TokenInput count={bike.rear_tokens} onChange={setTokens('rear_tokens')} invalid={saver.failed.includes('rear_tokens')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Small save note next to the bike name, instead of the full-screen spinner.
function SaveStatus({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'error') {
    return (
      <span className='saveStatus error' role='status'>
        Couldn't save · <button type='button' className='linkButton' onClick={onRetry}>Retry</button>
      </span>
    );
  }
  return <span className='saveStatus' role='status'>{state === 'saving' ? 'Saving…' : 'Saved'}</span>;
}

export default BikeCard;
