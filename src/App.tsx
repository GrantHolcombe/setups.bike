import React, { useState, useEffect, useContext, createContext } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './App.css';
import BikeCard from './components/BikeCard/BikeCard';
import Header from './components/Header/Header';
import { Alert, Button, Snackbar } from '@mui/material';
import type { UpgradeReason } from './components/Billing/UpgradeDialog';
import { IAccount, getAccount, openBillingPortal } from './billing';
import { IBikeSetup, listSetups } from './setups';
import { IShare, SHARE_PARAM, copyShare, listShares } from './shares';
import { LoadingOverlay } from './components/Spinner';
import { EmailPrompt, NameDialog, SharedSetupView, SignInDialog, UpgradeDialog, WhenOpened, preloadParts } from './lazy';
import { profileFromToken } from './signin';
import { applyUpdate, useUpdateAvailable } from './pwa';
import { readSignupSource } from './signupSource';
import Landing from './components/Landing/Landing';
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
      // dark text on gold fills (7.6:1); white on gold was 2.2:1
      contrastText: '#1c1c1c',
    },
    secondary: {
      main: '#FF0000',
    },
  },
  components: {
    // Dropdown menus don't lock page scrolling. MUI's lock sets overflow: hidden on the page,
    // which made iPhone Safari jump to the top while a menu was open. Dialogs keep their lock.
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    MuiMenu: { defaultProps: { disableScrollLock: true } },
    // Gold used as text or an outline follows --gold-text (deeper in light mode, bright in dark)
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.color === 'primary' && ownerState.variant !== 'contained' && {
            color: 'var(--gold-text)',
          }),
          ...(ownerState.color === 'primary' && ownerState.variant === 'outlined' && {
            borderColor: 'var(--gold-text)',
          }),
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.color === 'primary' && ownerState.variant === 'outlined' && {
            color: 'var(--gold-text)',
            borderColor: 'var(--gold-text)',
          }),
        }),
      },
    },
    // focused text fields: label and underline
    MuiInputLabel: {
      styleOverrides: { root: { '&.Mui-focused': { color: 'var(--gold-text)' } } },
    },
    MuiInput: {
      styleOverrides: { underline: { '&:after': { borderBottomColor: 'var(--gold-text)' } } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--gold-text)' } } },
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

//query string for the older GET/POST Lambdas that read their input from the URL
//(skips missing values, as axios's `params` did)
const queryString = (params: Record<string, unknown>) =>
  new URLSearchParams(Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)])).toString();

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

//first-touch sign-up source from this visit's link (memory only; see src/signupSource.ts)
const signupSource = readSignupSource(window.location.search, SHARE_PARAM);

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
  //the one-time "news by email?" prompt was answered this visit (hides it right away)
  const [emailPromptDone, setEmailPromptDone] = useState(false);
  //"Clip In": Google or an emailed code
  const [signInOpen, setSignInOpen] = useState(false);
  //new email sign-ups have no name; asked once per visit until they give one
  const [nameSkipped, setNameSkipped] = useState(false);
  const [upgrade, setUpgrade] = useState<{ open: boolean, reason: UpgradeReason }>({ open: false, reason: 'menu' });
  const updateReady = useUpdateAvailable();
  const [offline, setOffline] = useState<boolean>(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
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
      setSignInOpen(true);
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
    // runs once when sign-in finishes; copySharedToGarage is a new function every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // only when the token changes (on sign-in), not every time refreshAccount is recreated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  //get googleAPI data once user logs in
  useEffect(
    () => {
        if (user) {
            fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.credentialStr}`, {
                    headers: {
                        Authorization: `Bearer ${user.credentialStr}`,
                        Accept: 'application/json'
                    }
                })
                .then((res) => {
                    if (!res.ok) throw new Error(`userinfo ${res.status}`);
                    return res.json();
                })
                .then((data) => {
                    //set FE profile data
                    setProfile(data);
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
    if(profile && user && jwt === "") {
      const reqObj = {
        //addUser checks this with Google and takes the name and email from Google, not from the fields below
        accessToken: user.credentialStr,
        userId: parseInt(profile.id),
        firstName: profile.given_name,
        lastName: profile.family_name,
        emailAddress: profile.email,
        ...signupSource
      }
      addUser(reqObj);
    }
    // only when Google returns a profile, so sign-in runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  //garage is showing: fetch the dialogs and Pro features in the background, so opening one is instant
  useEffect(() => {
    if (isAauthenticated && bikes) preloadParts();
  }, [isAauthenticated, bikes]);

  //back online with a signed-in garage that never loaded: try again
  useEffect(() => {
    if (!offline && jwt !== "" && !bikes) getBikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  useEffect(() => {
    if(jwt !== "") {
      if (profile) saveSession({ token: jwt, profile });
      setIsLoading(true);
      getBikes();
    }
    // load the garage once per new token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  //add user lambda call
  const addUser = (reqObj: Record<string, unknown>) => {

    fetch(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/addUser?${queryString(reqObj)}`,
      { method: 'POST', body: JSON.stringify({}) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`addUser ${res.status}`);
        setJwt((await res.json()).token);
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
    fetch(`https://l7s3m81i09.execute-api.us-west-1.amazonaws.com/test/getBikes?${queryString(reqObj)}`)
                .then(async (res) => {
                    //expired or invalid token: back to the sign-in screen
                    if (res.status === 401) { logout(); return; }
                    if (!res.ok) { console.warn('getBikes failed', res.status); return; }
                    const data = await res.json();
                    setBikes(data.sort((a: IBike, b: IBike) => a.garage_order - b.garage_order));
                    setIsLoading(false);
                    //keeps the bike count and limit current after adds and deletes
                    refreshAccount();
                })
                .catch((err) => {
                  //fetch only rejects when the request never got an answer (no connection):
                  //stop the spinner; the offline banner explains, and it retries when back online
                  console.log(err);
                  setIsLoading(false);
                  setOffline(!navigator.onLine);
                });
  }
  
  
  //login button
  const login = useGoogleLogin({
    onSuccess: (codeResponse: any) => { setUser({credentialStr: codeResponse.access_token});},
    onError: (error?: any) => console.log('Login Failed:', error)
  });

  //email sign-in finished (SignInDialog); Google sign-in goes through login() above
  const emailSignedIn = (token: string) => {
    setSignInOpen(false);
    setProfile(profileFromToken(token));
    setIsAuthenticated(true);
    setJwt(token);
  };

  //the name was saved (NameDialog): the new token carries it
  const nameSaved = (token: string) => {
    setProfile(profileFromToken(token));
    setJwt(token);
  };

  const needsName = (() => {
    if (!isAauthenticated || !jwt) return false;
    try { return !jwtDecode<IJWT>(jwt).first_name; } catch { return false; }
  })();

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
      <LoadingOverlay visible={isLoading} />
      <Header isAuth={isAauthenticated} profile={profile} bikeList={bikes} addBikeOpen={addBikeOpen} setAddBikeOpen={setAddBikeOpen} logout={logout}
        onAccountDeleted={() => { logout(); setNotice({ severity: 'success', text: 'Your account has been deleted.' }); }}/>
      {offline && (
        <Alert severity='info' sx={{ maxWidth: 600, mx: 'auto', mb: 2, position: 'relative', zIndex: 1 }}>
          You're offline. Changes can't be saved until you're back online.
        </Alert>
      )}
      {sharedId ?
        <React.Suspense fallback={<LoadingOverlay visible />}>
        <SharedSetupView shareId={sharedId} signedIn={!!jwt} belowWelcome={isAauthenticated} copying={copying} copyError={copyError}
          onCopy={copySharedToGarage} onClose={closeShared} />
        </React.Suspense>
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
        <div style={{display: isLoading ? 'none' : 'block'}}>
          <Landing onSignIn={() => setSignInOpen(true)} />
        </div>

      }
      <WhenOpened open={signInOpen}>
        <SignInDialog open={signInOpen} onClose={() => { setSignInOpen(false); setPendingCopy(false); }}
          onGoogle={() => { setIsLoading(true); login(); }} onSignedIn={emailSignedIn} signupSource={signupSource} />
      </WhenOpened>
      <WhenOpened open={needsName && !nameSkipped}>
        <NameDialog open={needsName && !nameSkipped} token={jwt} onSaved={nameSaved} onSkip={() => setNameSkipped(true)} />
      </WhenOpened>
      {/* asked once of anyone who has never chosen (new sign-ups), after the name question */}
      {isAauthenticated && !sharedId && account?.marketingEmails === null && !emailPromptDone && (!needsName || nameSkipped) && (
        <React.Suspense fallback={null}><EmailPrompt onDone={() => setEmailPromptDone(true)} /></React.Suspense>
      )}
      <WhenOpened open={upgrade.open}>
        <UpgradeDialog open={upgrade.open} reason={upgrade.reason} onClose={() => setUpgrade({ ...upgrade, open: false })} />
      </WhenOpened>
      <Snackbar open={updateReady} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity='info' variant='filled'
          action={<Button color='inherit' size='small' onClick={applyUpdate}>Reload</Button>}>
          A new version of Setups.Bike is ready.
        </Alert>
      </Snackbar>
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
