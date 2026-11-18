import './BikeCard.css';
import { useContext, useEffect, useState, useRef } from 'react';
import React from 'react';
import SusMenu from './SusMenu';
import TokenInput from './TokenInput/TokenInput';
import SetupPicker from './SetupPicker';
import SettingInput from './SettingInput';
import ProActions from './ProActions';
import { AppContext, IBike, useAppContext } from '../../App';
import axios from 'axios';

export interface IBikeCardProps {
  thisBike: IBike
}

function BikeCard({thisBike}: IBikeCardProps) {
  const [bike, setBike] = useState<IBike>(thisBike);
  const {loading, setLoading, token} = useAppContext();

  //take the server's version when the garage reloads (e.g. after applying a saved setup)
  useEffect(() => { setBike(thisBike); }, [thisBike]);

  //functional update, so two changes in a row (type, then leave the field) both stick
  const setBikeVal = (target: string, value: number) => {
    setBike((prev) => ({ ...prev, [target]: value }));
  }

  //update bike lambda call; overrides carry a value that was set this instant, before
  //React has applied it to `bike`
  const updateBike = (overrides: Partial<IBike> = {}) => {
    setLoading(true);
    axios.post(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/updateBike`, JSON.stringify({}), { params: { ...bike, ...overrides, token }
  })
    .then(response => {
      setLoading(false);
    })
    .catch(err => {
      setLoading(false);
      console.warn(err);
    });
  }

  const commit = (name: string, value: number) => updateBike({ [name]: value });

  //useEffect(() => { updateBike() }, [hasChange]);

  return (
    <div className="cardContainer">
      <div>
        <div className='modelHeader'>{bike.model}</div>
        <div className='brandHeader'>{bike.brand}</div>
        <SetupPicker bike={bike} />
        <ProActions bike={bike} />
      </div>
      <div className='cardBody'>
        <div className='tireSection front'>
          <div className='componentLabel'>Front Tire</div>
          <SettingInput name='front_tire' value={bike.front_tire} onChange={setBikeVal} onCommit={commit} />
        </div>
        <div className='tireSection rear'>
          <div className='componentLabel'>Rear Tire</div>
          <SettingInput name='rear_tire' value={bike.rear_tire} onChange={setBikeVal} onCommit={commit} />
        </div>
      </div>
      <div className='cardBody rowTwo'>
        <div className='suspensionPressureSection front'>
          <div className='pressureRow'>
            <div className='componentLabel'>Fork</div>
            <SettingInput name='front_sus_pressure' value={bike.front_sus_pressure} onChange={setBikeVal} onCommit={commit} />
          </div>
          <div className='suspensionCompression'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} detail='front_sus_comp_'/>
          </div>
          <div className='suspensionRebound'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} detail='front_sus_rebound_'/>
          </div>
          <TokenInput count={bike.front_tokens} refreshCard={() => updateBike()} updateCount={(count:number) => setBikeVal('front_tokens', count)} />
        </div>
        <div className='suspensionPressureSection rear'>
          <div className='pressureRow'>
            <div className='componentLabel'>Shock</div>
            <SettingInput name='rear_sus_pressure' value={bike.rear_sus_pressure} onChange={setBikeVal} onCommit={commit} />
            <div className='suspensionCompression'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} detail='rear_sus_comp_'/>
            </div>
            <div className='suspensionRebound'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={commit} detail='rear_sus_rebound_'/>
            </div>
            <TokenInput count={bike.rear_tokens} refreshCard={() => updateBike()} updateCount={(count:number) => setBikeVal('rear_tokens', count)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BikeCard;
