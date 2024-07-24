import React, { useState, useEffect, useContext } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios';
import './App.css';

export interface IUser {
  /** Should the name be rendered in bold */
  credential: string;
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

  //get googleAPI data once user logs in
  useEffect(
    () => {
        if (user) {
            axios
                .get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.credential}`, {
                    headers: {
                        Authorization: `Bearer ${user.credential}`,
                        Accept: 'application/json'
                    }
                })
                .then((res) => {
                    //set FE profile data
                    setProfile(res.data);
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
      console.log(profile)
      const reqObj = {
        userId: parseInt(profile.id),
        firstName: profile.given_name,
        lastName: profile.family_name,
        emailAddress: profile.email
      }
      addUser(reqObj);
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
  const getUsers = () => {
    axios.get(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/getUsers`, {
                    
                })
                .then((res) => {
                    console.log(res.data);
                    
                })
                .catch((err) => console.log(err));
  }
    //getUsers(); //useful for debuging a simpler api call
  
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
            <p>Here are your rides settings</p>
            <TireInput name='Front' />
            <div>* Add Fork?</div>
            <TireInput name='Rear' />
            <div>* Add Shock?</div>
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
