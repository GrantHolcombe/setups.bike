import React, { useState, useEffect, useContext, createContext } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Radio } from 'react-loader-spinner';
import './App.css';
import BikeCard from './components/BikeCard/BikeCard';
import AppMenu from './components/Header/AppMenu/AppMenu';
import Header from './components/Header/Header';
import { Button } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

export interface IUser {
  credentialStr: string;
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

export interface IJWT {
  "app_user_id": number,
  "first_name": string,
  "last_name": string,
  "email_address": string
}


const theme = createTheme({
  palette: {
    primary: {
      main: '#daa530',
    },
    secondary: {
      main: '#FF0000',
    },
  },
  components: {
    // Name of the component
    MuiButton: {
      styleOverrides: {
        // Name of the slot
        root: ({ ownerState }) => ({
          ...(ownerState.variant === 'contained' &&
            ownerState.color === 'primary' && {
              color: '#fff',
            }),
        }),
      },
    },
  },
});

export type AppContent = {
  loading: boolean
  setLoading:(b:boolean) => void
  token: string
  refreshBikes: () => void
}
export const AppContext = createContext<AppContent>({
  loading: true,
  setLoading: (b) => { },
  token: "",
  refreshBikes: () =>{}
})
export const useAppContext = () => useContext(AppContext)

function App() {
  const [user, setUser] = useState<IUser>();
  const [profile, setProfile] = useState<IProfile>();
  const [isAauthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [jwt, setJwt] = useState<string>("");
  const [bikes, setBikes] = useState<Array<IBike>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  //get googleAPI data once user logs in
  useEffect(
    () => {
        if (user) {
            axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.credentialStr}`, {
                    headers: {
                        Authorization: `Bearer ${user.credentialStr}`,
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
    if(profile && jwt == "") {
      const reqObj = {
        userId: parseInt(profile.id),
        firstName: profile.given_name,
        lastName: profile.family_name,
        emailAddress: profile.email
      }
      addUser(reqObj);
    }
  }, [profile]);

  useEffect(() => {
    if(jwt != "") getBikes();
  }, [jwt]);

  //add user lambda call
  const addUser = (reqObj: object) => {

    axios.post(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/addUser`,
      JSON.stringify({}), 
      { params: reqObj })
      .then(response => {
        setJwt(response.data.token);
      })
      .catch(err => console.warn(err));
  }
  
  const getBikes = async () => {
    const decodedJwt = jwtDecode<IJWT>(jwt);
    const reqObj = {
      //return this from auth call
      userId: decodedJwt.app_user_id,
    }
    axios.get(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/getBikes`,{ params: reqObj})
                .then((res) => {
                    setBikes(res.data);
                    setIsLoading(false);
                })
                .catch((err) => console.log(err));
  }
  
  
  //login button
  const login = useGoogleLogin({
    onSuccess: (codeResponse: any) => { setUser({credentialStr: codeResponse.access_token});},
    onError: (error?: any) => console.log('Login Failed:', error)
  });

  //logout button
  const logout = () => {
    googleLogout();
    setIsAuthenticated(false);
    setJwt("");
    setBikes([]);
  };

  return (
    <ThemeProvider theme={theme}>
    <AppContext.Provider value={{ loading: isLoading, setLoading: setIsLoading, token: jwt, refreshBikes: getBikes}}>
      <Radio
        visible={isLoading}
        height="80px"
        width="80px"
        colors={["#4fa94d", "#4fa94d", "#4fa94d"]}
        ariaLabel="radio-loading"
        wrapperStyle={{boxSizing: "border-box", height: "100%", zIndex: "999", width: "100vw", padding: "35vh 35vw", position: "fixed", top: "0", left: "0", background: "rgba(0, 0, 0, 0.5)" }}
        wrapperClass="test"
      />
      <Header isAuth={isAauthenticated} profile={profile} bikeList={bikes} logout={logout}/>
      {isAauthenticated && profile && bikes ? 
        <div className='bikeInputForm'>
          <div className='cardWrapper'>
            {bikes.map((e, i) => {
              return <BikeCard key={i} thisBike={ bikes[i] }/>
            })}
          </div>
        </div>
        :
        <div className='login'>
          <br />
          <br />
          <p>All of your supspension settings in one place!</p>
          <Button variant={'contained'} onClick={() => { setIsLoading(true); login();}}>Clip in</Button>
        </div>
        
      }
    </AppContext.Provider>
    </ThemeProvider>
  )
}

export default App;
