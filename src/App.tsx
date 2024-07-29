import React, { useState, useEffect, useContext } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios';
import './App.css';
import BikeCard from './components/BikeCard/BikeCard';

export interface IUser {
  credential: string;
}

export interface IBike {
  bike_id: number,
  app_user_id: number,
  brand: string,
  model: string,
  front_tire: number,
  rear_tire: number,
  front_sus_pressure: number,
  rear_sus_pressure: number,
  front_sus_comp_1: number,
  front_sus_comp_2: number,
  front_sus_comp_count: number,
  front_sus_rebound_1: number,
  front_sus_rebound_2: number,
  front_sus_rebound_count: number,
  rear_sus_comp_1: number,
  rear_sus_comp_2: number,
  rear_sus_comp_count: number,
  rear_sus_rebound_1: number,
  rear_sus_rebound_2: number,
  rear_sus_rebound_count: number,
}

type tireInputProps = {
  name: string
}

export interface IProfile {
    "id": string,
    "email": string,
    "verified_email": boolean,
    "name": string,
    "given_name": string,
    "family_name": string,
    "picture": string,
    "hd": string
}



function App() {
  const [user, setUser] = useState<IUser>();
  const [profile, setProfile] = useState<IProfile>();
  const [isAauthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [bikes, setBikes] = useState<Array<IBike>>();

  //get googleAPI data once user logs in
  useEffect(
    () => {
        if (user) {
            axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.credential}`, {
                    headers: {
                        Authorization: `Bearer ${user.credential}`,
                        Accept: 'application/json'
                    }
                })
                .then((res) => {
                    //set FE profile data
                    setProfile(res.data);
                    console.log(res.data);
                    //toggles login/app screens
                    setIsAuthenticated(true);
                })
                .catch((err) => console.log(err));
        }
    },
    [ user ]
  );

  //after setting the FE profile data, create a user in DB
  //TODO errors gracefuly after creating initial row, clean that up maybe in the query
  useEffect(() => {
    if(profile) {
      const reqObj = {
        userId: parseInt(profile.id),
        firstName: profile.given_name,
        lastName: profile.family_name,
        emailAddress: profile.email
      }
      addUser(reqObj);
      getBikes();
      console.log(bikes);
    }
  }, [profile]);

  //add user lambda call
  const addUser = (reqObj: object) => {
    axios.post(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/addUser`, JSON.stringify({}), { params: reqObj
  })
    .then(response => console.log(response.status))
    .catch(err => console.warn(err));
  }
  //get users lambda call, just a test
  const getBikes = () => {
    axios.get(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/getBikes`,{ params: reqObj})
                .then((res) => {
                    console.log(res.data);
                    setBikes(res.data);
                })
                .catch((err) => console.log(err));
  }
  const reqObj = {
      //return this from auth call
      userId: 4,
    }
    addUser(reqObj);
  
  //login button
  const login = useGoogleLogin({
    onSuccess: (codeResponse: any) => { console.log(codeResponse.access_token); setUser({credential: codeResponse.access_token}); console.log(user?.credential);},
    onError: (error?: any) => console.log('Login Failed:', error)
  });

  //logout button
  const logout = () => {
    googleLogout();
    setIsAuthenticated(false);
  };

  const TireInput: React.FC<tireInputProps> = ({name}) => {
    return (
    <div>
      <label htmlFor='${name}Tire'>{name} Tire:</label>
      <input type='number' name='${name}Tire' id='param${name}Tire' />
    </div>
  )};

  return (
      <div>
        <img src='img/logos/Setups.png' className='logo' />
        {
          isAauthenticated && profile ? 
          <div className='bikeInputForm'>
            <h2>Welcome back, {profile.given_name}!</h2>
            <p>Here's your { bikes?.[0].brand } { bikes?.[0].model } settings</p>
            <BikeCard />
            <button onClick={() => logout()}>logout</button>
          </div>
          :
          <div className='login'>
            <br />
            <br />
            <p>All of your supspension settings in one place!</p>
            <button onClick={() => login()}>Clip in</button>
          </div>
          
        }
      </div>
  )
}

export default App;
