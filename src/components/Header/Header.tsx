import { Avatar } from '@mui/material';
import AppMenu from './AppMenu/AppMenu';
import './Header.css';
import { IProfile } from '../../App';


export interface IAppMenuProps {
    logout: Function;
    isAuth?: boolean;
    profile?: IProfile;
  }
  interface IWelcome {
    welcomeProfile?: IProfile
  }

const WelcomeMsg = ({welcomeProfile}: IWelcome) => {
    return (
        <div className='welcomeHeading'>
            <Avatar alt={welcomeProfile?.name} src={welcomeProfile?.picture} />
            <h2>Welcome back, {welcomeProfile?.given_name}!</h2>
            <p>Here's your garage.</p>
        </div>
    )
}
export default function Header({logout, isAuth, profile}: IAppMenuProps) {
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
                {isAuth && <AppMenu logout={logout} />}
            </div>
            {isAuth && <WelcomeMsg welcomeProfile={profile} />}
        </div>
    );
}