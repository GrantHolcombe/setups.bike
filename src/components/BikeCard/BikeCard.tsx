import './BikeCard.css';
import { FC, useEffect, useState } from 'react';
import React from 'react';
import SusMenu from './SusMenu';
import TokenInput from './TokenInput/TokenInput';
import { IBike } from '../../App';



const mockBike = {
  bike_id: 123,
  app_user_id: 22,
  brand: "Ibis",
  model: "Ripbro",
  front_tire: 19,
  rear_tire: 21,
  front_sus_pressure: 97,
  rear_sus_pressure: 210,
  front_sus_comp_1: 6,
  front_sus_comp_2: 12,
  front_sus_comp_count: 2,
  front_sus_rebound_1: 4,
  front_sus_rebound_2: 5,
  front_sus_rebound_count: 1,
  rear_sus_comp_1: 10,
  rear_sus_comp_2: 11,
  rear_sus_comp_count: 1,
  rear_sus_rebound_1: 9,
  rear_sus_rebound_2: 7,
  rear_sus_rebound_count: 2,
}

function BikeCard() {
  const [bike, setBike] = useState<IBike>(mockBike);

  const setBikeVal = (target: any, value: number) => {
    let update: any = {...bike}

    target = target as keyof typeof update
    console.log( typeof update[target]);
    //const detailVal = bikeDetail[detailLengthTarget] ;
    update[target] = value;
    setBike(update);
  }

  return (
    <div className="cardContainer">
      <div>
        <div className='modelHeader'>{bike.model}</div>
        <div className='brandHeader'>{bike.brand}</div>
      </div>
      <div className='cardBody'>
        <div className='tireSection front'>
          <div className='componentLabel'>Front Tire</div>
          <input className='componentInput' value={bike.front_tire} onChange={(e) => setBikeVal('front_tire', parseInt(e.currentTarget.value))}/>
        </div>
        <div className='tireSection rear'>
          <div className='componentLabel'>Rear Tire</div>
          <input className='componentInput' value={bike.rear_tire} onChange={(e) => setBikeVal('rear_tire', parseInt(e.currentTarget.value))}/>
        </div>
      </div>
      <div className='cardBody rowTwo'>
        <div className='suspensionPressureSection front'>
          <div className='pressureRow'>
            <div className='componentLabel'>Fork</div>
            <input className='componentInput' value={bike.front_sus_pressure} onChange={(e) => setBikeVal('front_sus_pressure', parseInt(e.currentTarget.value))}/>
          </div>
          <div className='suspensionCompression'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} detail='front_sus_comp_'/>
          </div>
          <div className='suspensionRebound'>
            <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} detail='front_sus_rebound_'/>
          </div>
          <TokenInput />
        </div>
        <div className='suspensionPressureSection rear'>
          <div className='pressureRow'>
            <div className='componentLabel'>Shock</div>
            <input className='componentInput' value={bike.rear_sus_pressure} onChange={(e) => setBikeVal('rear_sus_pressure', parseInt(e.currentTarget.value))}/>
            <div className='suspensionCompression'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} detail='rear_sus_comp_'/>
            </div>
            <div className='suspensionRebound'>
              <SusMenu bikeDetail={bike} setBikeVal={setBikeVal} detail='rear_sus_rebound_'/>
            </div>
            <TokenInput />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BikeCard;
