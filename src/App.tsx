import React, { useState, useEffect, useContext, createContext } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Radio } from 'react-loader-spinner';
import './App.css';
import BikeCard from './components/BikeCard/BikeCard';
import AppMenu from './components/Header/AppMenu/AppMenu';
import Header from './components/Header/Header';
import { Alert, Button, Snackbar } from '@mui/material';
import UpgradeDialog, { UpgradeReason } from './components/Billing/UpgradeDialog';
import { IAccount, getAccount, openBillingPortal } from './billing';
import { IBikeSetup, listSetups } from './setups';
import { IShare, SHARE_PARAM, copyShare, listShares } from './shares';
import SharedSetupView from './components/Shared/SharedSetupView';
import { SPINNER_COLORS } from './components/Spinner';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

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
  front_tokens: number,
  rear_sus_comp_1: number,
  rear_sus_comp_2: number,
  rear_sus_comp_count: number,
  rear_sus_rebound_1: number,
  rear_sus_rebound_2: number,
  rear_sus_rebound_count: number,
  rear_tokens: number,
  garage_order: number,
  //Pro: the saved setup last applied or saved on this bike
  active_setup_id?: number | null
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


//light or dark, following the browser/system setting (matches the CSS tokens in index.css)
const makeTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    ...(mode === 'dark' && { background: { default: '#121212', paper: '#1e1e1e' } }),
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
  account?: IAccount
  refreshAccount: () => Promise<IAccount | undefined>
  openUpgrade: (reason?: UpgradeReason) => void
  manageBilling: () => void
  setups: IBikeSetup[]
  refreshSetups: () => Promise<void>
  //Pro 2.3: the user's own shared links
  shares: IShare[]
  refreshShares: () => Promise<void>
}
export const AppContext = createContext<AppContent>({
  loading: true,
  setLoading: (b) => { },
  token: "",
  refreshBikes: () =>{},
  refreshAccount: async () => undefined,
  openUpgrade: () => {},
  manageBilling: () => {},
  setups: [],
  refreshSetups: async () => {},
  shares: [],
  refreshShares: async () => {}
})
export const useAppContext = () => useContext(AppContext)

//signed-in session kept across page reloads, until the app token expires
const SESSION_KEY = 'setupsBikeSession';
interface ISession {
  token: string,
  profile: IProfile
}

const loadSession = (): ISession | null => {
  try {
    const session: ISession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session?.token || !session.profile) return null;
    const { exp } = jwtDecode<{ exp?: number }>(session.token);
    //treat tokens that expire within a minute as already expired
    if (!exp || exp * 1000 < Date.now() + 60_000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

const saveSession = (session: ISession | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    //storage blocked (private mode etc.): the session just won't survive a reload
  }
}

const savedSession = loadSession();

//Stripe sends people back with ?checkout=success|cancel or ?portal=return; read it once and
//tidy the address bar so a reload doesn't repeat the message
const returnedFrom = (() => {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  const portal = params.get('portal');
  if (checkout || portal) window.history.replaceState(null, '', window.location.pathname);
  return { checkout, portal };
})();

//a shared setup link: setups.bike/?s=<id>
const initialShareId = new URLSearchParams(window.location.search).get(SHARE_PARAM);

function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const theme = React.useMemo(() => makeTheme(prefersDark ? 'dark' : 'light'), [prefersDark]);
  const [user, setUser] = useState<IUser>();
  const [profile, setProfile] = useState<IProfile | undefined>(savedSession?.profile);
  const [isAauthenticated, setIsAuthenticated] = useState<boolean>(!!savedSession);
  const [jwt, setJwt] = useState<string>(savedSession?.token || "");
  const [bikes, setBikes] = useState<Array<IBike>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addBikeOpen, setAddBikeOpen] = useState<boolean>(false);
  const [account, setAccount] = useState<IAccount>();
  const [upgrade, setUpgrade] = useState<{ open: boolean, reason: UpgradeReason }>({ open: false, reason: 'menu' });
  const [notice, setNotice] = useState<{ severity: 'success' | 'info' | 'error', text: string } | null>(null);

  const [setups, setSetups] = useState<IBikeSetup[]>([]);
  const [shares, setShares] = useState<IShare[]>([]);
  const [sharedId, setSharedId] = useState<string | null>(initialShareId);
  const [pendingCopy, setPendingCopy] = useState<boolean>(false);
  const [copying, setCopying] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string>('');

  //Pro 2.3: the user's shared links (kept after Pro lapses so they can still be removed)
  const refreshShares = async (): Promise<void> => {
    if (!jwt) return;
    try {
      setShares(await listShares(jwt));
    } catch (err) {
      console.warn(err);
      setShares([]);
    }
  };

  const closeShared = () => {
    setSharedId(null);
    setCopyError('');
    setPendingCopy(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const copySharedToGarage = async () => {
    if (!sharedId) return;
    if (!jwt) {
      //sign in first; the copy runs once the app token arrives
      setPendingCopy(true);
      login();
      return;
    }
    setPendingCopy(false);
    setCopying(true);
    setCopyError('');
    try {
      await copyShare(jwt, sharedId);
      closeShared();
      setNotice({ severity: 'success', text: 'Copied to your garage.' });
      setIsLoading(true);
      getBikes();
    } catch (err: any) {
      if (err?.code === 'FREE_LIMIT') openUpgrade('limit');
      if (err?.status === 401) logout();
      setCopyError(err?.message || 'Could not copy this setup. Please try again.');
    }
    setCopying(false);
  };

  useEffect(() => {
    if (jwt && pendingCopy) copySharedToGarage();
  }, [jwt, pendingCopy]);

  //Pro: every saved setup for every bike, loaded once and refreshed after changes
  const refreshSetups = async (): Promise<void> => {
    if (!jwt) return;
    try {
      setSetups(await listSetups(jwt));
    } catch (err) {
      console.warn(err);
      setSetups([]);
    }
  };

  //plan, bike count and limit for the signed-in user
  const refreshAccount = async (): Promise<IAccount | undefined> => {
    if (!jwt) return undefined;
    try {
      const a = await getAccount(jwt);
      setAccount(a);
      if (a.plan === 'pro' && a.billingEnabled) refreshSetups();
      else setSetups([]);
      if (a.billingEnabled) refreshShares();
      else setShares([]);
      return a;
    } catch (err: any) {
      console.warn(err);
      if (err?.status === 401) logout();
      return undefined;
    }
  };

  const openUpgrade = (reason: UpgradeReason = 'menu') => setUpgrade({ open: true, reason });

  const manageBilling = async () => {
    setIsLoading(true);
    try {
      const { url } = await openBillingPortal(jwt);
      window.location.assign(url);
    } catch (err: any) {
      setIsLoading(false);
      setNotice({ severity: 'error', text: err?.message || "Couldn't open billing. Please try again." });
    }
  };

  //after checkout, Stripe tells our webhook a moment later; check a few times until Pro shows up
  useEffect(() => {
    if (!jwt || !returnedFrom.checkout) return;
    if (returnedFrom.checkout === 'cancel') {
      setNotice({ severity: 'info', text: 'Checkout cancelled. You have not been charged.' });
    } else if (returnedFrom.checkout === 'success') {
      setNotice({ severity: 'info', text: 'Payment received. Setting up Pro…' });
      let tries = 0;
      const check = async () => {
        const a = await refreshAccount();
        if (a?.plan === 'pro') {
          setNotice({ severity: 'success', text: "You're on Pro. Thanks for supporting Setups.Bike!" });
        } else if (++tries < 8) {
          setTimeout(check, 2000);
        } else {
          setNotice({ severity: 'info', text: 'Payment received. Pro will appear in a minute; refresh if it doesn’t.' });
        }
      };
      check();
    }
    returnedFrom.checkout = null;
  }, [jwt]);

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
    if(profile && user && jwt == "") {
      const reqObj = {
        //addUser checks this with Google and takes the name and email from Google, not from the fields below
        accessToken: user.credentialStr,
        userId: parseInt(profile.id),
        firstName: profile.given_name,
        lastName: profile.family_name,
        emailAddress: profile.email
      }
      addUser(reqObj);
    }
  }, [profile]);

  useEffect(() => {
    if(jwt != "") {
      if (profile) saveSession({ token: jwt, profile });
      setIsLoading(true);
      getBikes();
    }
  }, [jwt]);

  //add user lambda call
  const addUser = (reqObj: object) => {

    axios.post(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/addUser`,
      JSON.stringify({}), 
      { params: reqObj })
      .then(response => {
        setJwt(response.data.token);
      })
      .catch(err => {
        console.warn(err);
        logout();
      });
  }

  const getBikes = async () => {
    const decodedJwt = jwtDecode<IJWT>(jwt);
    const reqObj = {
      //getBikes reads the user from the token; userId is only for the older Lambda
      token: jwt,
      userId: decodedJwt.app_user_id,
    }
    axios.get(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/getBikes`, { params: reqObj})
                .then((res) => {
                    setBikes(res.data.sort((a: IBike, b: IBike) => a.garage_order - b.garage_order));
                    setIsLoading(false);
                    //keeps the bike count and limit current after adds and deletes
                    refreshAccount();
                })
                .catch((err) => {
                  console.log(err);
                  //expired or invalid token: back to the sign-in screen
                  if (err.response?.status === 401) logout();
                });
  }
  
  
  //login button
  const login = useGoogleLogin({
    onSuccess: (codeResponse: any) => { setUser({credentialStr: codeResponse.access_token});},
    onError: (error?: any) => console.log('Login Failed:', error)
  });

  //logout button
  const logout = () => {
    googleLogout();
    saveSession(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    setUser(undefined);
    setProfile(undefined);
    setJwt("");
    setBikes([]);
    setAccount(undefined);
    setSetups([]);
    setShares([]);
  };

  const pastDue = account?.plan === 'pro' && account.planStatus === 'past_due';

  return (
    <ThemeProvider theme={theme}>
    <AppContext.Provider value={{ loading: isLoading, setLoading: setIsLoading, token: jwt, refreshBikes: getBikes, account, refreshAccount, openUpgrade, manageBilling, setups, refreshSetups, shares, refreshShares }}>
      <Radio
        visible={isLoading}
        height="80px"
        width="80px"
        colors={SPINNER_COLORS}
        ariaLabel="radio-loading"
        wrapperStyle={{boxSizing: "border-box", height: "100%", zIndex: "1400", width: "100vw", padding: "35vh 35vw", position: "fixed", top: "0", left: "0", background: "rgba(0, 0, 0, 0.5)" }}
        wrapperClass="test"
      />
      <Header isAuth={isAauthenticated} profile={profile} bikeList={bikes} addBikeOpen={addBikeOpen} setAddBikeOpen={setAddBikeOpen} logout={logout}/>
      {sharedId ?
        <SharedSetupView shareId={sharedId} signedIn={!!jwt} belowWelcome={isAauthenticated} copying={copying} copyError={copyError}
          onCopy={copySharedToGarage} onClose={closeShared} />
      : isAauthenticated && profile && bikes ? 
        <div className='bikeInputForm'>
          {pastDue && (
            <Alert severity='warning' sx={{ maxWidth: 600, mx: 'auto', mb: 2 }}
              action={account?.canManageBilling ? <Button color='inherit' size='small' onClick={manageBilling}>Update card</Button> : undefined}>
              Your last Pro payment didn't go through. Update your card to keep Pro.
            </Alert>
          )}
          <div className='cardWrapper'>
            {bikes.map((e, i) => {
              return <BikeCard key={e.bike_id} thisBike={ e }/>
            })}
            {!isLoading && bikes.length === 0 && <Button className='swing ctaAdd' variant='contained' color='primary' onClick={() => setAddBikeOpen(true)}>Add a Bike</Button>}
          </div>
        </div>
        :
        <div style={{display: isLoading ? 'none' : 'flex'}} className='login'>
          <br />
          <br />
          <p>All of your supspension settings in one place!</p>
          <Button variant={'contained'} onClick={() => { setIsLoading(true); login();}}>Clip in</Button>
        </div>

      }
      <UpgradeDialog open={upgrade.open} reason={upgrade.reason} onClose={() => setUpgrade({ ...upgrade, open: false })} />
      <Snackbar open={!!notice} autoHideDuration={notice?.severity === 'success' ? 6000 : null} onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)} variant='filled'>{notice.text}</Alert> : <span />}
      </Snackbar>
      <footer className='legalFooter'>
        <a href='terms.html'>Terms</a> · <a href='privacy.html'>Privacy</a> · <a href='refunds.html'>Refunds</a>
      </footer>
    </AppContext.Provider>
    </ThemeProvider>
  )
}

export default App;
