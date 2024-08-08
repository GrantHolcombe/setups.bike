import { Avatar } from '@mui/material';
import AppMenu from './AppMenu/AppMenu';
import './Header.css';
import { IProfile, IBike } from '../../App';


export interface IAppMenuProps {
    logout: Function;
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
            <h2>Welcome back, {welcomeProfile?.given_name}!</h2>
            <p>{hasBikes ? "Here's your garage." : "There's nothing here yet!"}</p>
        </div>
    )
}
export default function Header({logout, isAuth, profile, bikeList, addBikeOpen, setAddBikeOpen}: IAppMenuProps) {
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
                <img src='img/logos/Setups.png' className='logo' />
                {isAuth && <AppMenu bikeList={bikeList} addBikeOpen={addBikeOpen} setAddBikeOpen={setAddBikeOpen} logout={logout} />}
            </div>
            {isAuth && <WelcomeMsg welcomeProfile={profile} hasBikes={bikeList ? bikeList.length > 0 : false} />}
        </div>
    );
}