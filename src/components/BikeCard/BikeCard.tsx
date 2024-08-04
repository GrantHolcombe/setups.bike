import './BikeCard.css';
import { useContext, useEffect, useState, useRef } from 'react';
import React from 'react';
import SusMenu from './SusMenu';
import TokenInput from './TokenInput/TokenInput';
import { AppContext, IBike, useAppContext } from '../../App';
import axios from 'axios';

export interface IBikeCardProps {
  thisBike: IBike
}

function BikeCard({thisBike}: IBikeCardProps) {
  const [bike, setBike] = useState<IBike>(thisBike);
  const {loading, setLoading} = useAppContext();

  const setBikeVal = (target: any, value: number) => {
    let update: any = {...bike}

    target = target as keyof typeof update
    console.log( typeof update[target]);
    //const detailVal = bikeDetail[detailLengthTarget] ;
    update[target] = value;
    setBike(update);
  }

  //update bike lambda call
  const updateBike = (e: React.FocusEvent<HTMLInputElement>) => {
    setLoading(true);
    axios.post(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/updateBike`, JSON.stringify({}), { params: bike
  })
    .then(response => {
      console.log(response);
      setLoading(false);
    })
    .catch(err => console.warn(err));
  }

  //useEffect(() => { updateBike() }, [hasChange]);

  return (
    <div className="cardContainer">
      <div>
        <div className='modelHeader'>{bike.model}</div>
        <div className='brandHeader'>{bike.brand}</div>
      </div>
      <div className='cardBody'>
        <div className='tireSection front'>
          <div className='componentLabel'>Front Tire</div>
          <input type='number' className='componentInput' value={bike.front_tire} onBlur={(e) => { updateBike(e)}} onChange={(e) => setBikeVal('front_tire', parseInt(e.currentTarget.value))}/>
        </div>
        <div className='tireSection rear'>
          <div className='componentLabel'>Rear Tire</div>
          <input type='number' className='componentInput' value={bike.rear_tire} onBlur={(e) => { updateBike(e)}} onChange={(e) => setBikeVal('rear_tire', parseInt(e.currentTarget.value))}/>
        </div>
      </div>
      <div className='cardBody rowTwo'>
        <div className='suspensionPressureSection front'>
          <div className='pressureRow'>
            <div className='componentLabel'>Fork</div>
            <input type='number' className='componentInput' value={bike.front_sus_pressure} onBlur={(e) => { updateBike(e)}} onChange={(e) => setBikeVal('front_sus_pressure', parseInt(e.currentTarget.value))}/>
          </div>
          <div className='suspensionCompression'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={(e) => { updateBike(e)}} detail='front_sus_comp_'/>
          </div>
          <div className='suspensionRebound'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={(e) => { updateBike(e)}} detail='front_sus_rebound_'/>
          </div>
          <TokenInput />
        </div>
        <div className='suspensionPressureSection rear'>
          <div className='pressureRow'>
            <div className='componentLabel'>Shock</div>
            <input type='number' className='componentInput' value={bike.rear_sus_pressure} onBlur={(e) => { updateBike(e)}} onChange={(e) => setBikeVal('rear_sus_pressure', parseInt(e.currentTarget.value))}/>
            <div className='suspensionCompression'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={(e) => { updateBike(e)}} detail='rear_sus_comp_'/>
            </div>
            <div className='suspensionRebound'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} saveBike={(e) => { updateBike(e)}} detail='rear_sus_rebound_'/>
            </div>
            <TokenInput />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BikeCard;
