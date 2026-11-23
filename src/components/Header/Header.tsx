import { Avatar } from '@mui/material';
import AppMenu from './AppMenu/AppMenu';
import './Header.css';
import { IProfile, IBike } from '../../App';


export interface IAppMenuProps {
    logout: Function;
    // the account was deleted from the menu: sign out and say so
    onAccountDeleted: () => void;
    isAuth?: boolean;
    profile?: IProfile;
    bikeList?: IBike[];
    addBikeOpen: boolean;
    setAddBikeOpen: Function;
  }

  interface IWelcome {
    welcomeProfile?: IProfile
    hasBikes?: boolean | undefined;
  }

const WelcomeMsg = ({welcomeProfile, hasBikes}: IWelcome) => {
    return (
        <div className='welcomeHeading'>
            <Avatar alt={welcomeProfile?.name} src={welcomeProfile?.picture} />
            <h2>{welcomeProfile?.given_name ? `Welcome back, ${welcomeProfile.given_name}!` : 'Welcome!'}</h2>
            <p>{hasBikes ? "Here's your garage." : "There's nothing here yet!"}</p>
        </div>
    )
}
export default function Header({logout, onAccountDeleted, isAuth, profile, bikeList, addBikeOpen, setAddBikeOpen}: IAppMenuProps) {
    const headerBarStyle = {
        background: "goldenrod",
        position: 'absolute' as 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '150px'
    }
    
    return (
        <div>
            <div style={headerBarStyle}>
                {/* the white logo artwork as one SVG (traced from Setups.png, so the lettering looks the
                    same on every device) on the red tile from Header.css; preloaded in index.html */}
                <img src='img/logos/setups-logo.svg' className='logo' alt='Setups.Bike' width={175} height={175}
                    {...{ fetchpriority: 'high' }} />
                {isAuth && <AppMenu bikeList={bikeList} addBikeOpen={addBikeOpen} setAddBikeOpen={setAddBikeOpen} logout={logout} onAccountDeleted={onAccountDeleted} />}
            </div>
            {isAuth && <WelcomeMsg welcomeProfile={profile} hasBikes={bikeList ? bikeList.length > 0 : false} />}
        </div>
    );
}