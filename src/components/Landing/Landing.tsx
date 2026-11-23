import { Button } from '@mui/material';
import './Landing.css';

interface ILandingProps {
  // opens the sign-in dialog (Google or an emailed code)
  onSignIn: () => void;
}

const REMEMBERS = [
  ['Tire pressure', 'front and rear'],
  ['Fork and shock pressure', 'in whatever units you run'],
  ['Compression and rebound clicks', 'low- and high-speed, if your damper has both'],
  ['Volume tokens', 'front and rear'],
  ['Every bike in your garage', 'in the order you want them'],
];

// What a signed-out visitor sees: what the app does, Free vs Pro, and the sign-in button.
// It records the rider's own settings and never suggests any (see docs/ROADMAP.md, 2.4).
export default function Landing({ onSignIn }: ILandingProps) {
  const clipIn = (
    <Button variant='contained' size='large' onClick={onSignIn}>Clip In</Button>
  );

  return (
    <main className='landing'>
      <section className='landingHero'>
        <div className='landingIntro'>
          <h1>Tire pressure and suspension settings, saved for every bike.</h1>
          <p className='landingLead'>
            Forgot your rebound clicks again? Write down what each bike is dialed to, and it's
            on your phone at the trailhead next time.
          </p>
          <div className='landingCta'>
            {clipIn}
            <span className='landingNote'>Free. Sign in with Google or your email.</span>
          </div>
        </div>
        <picture className='landingShot'>
          <source srcSet='img/landing/card-dark.webp' media='(prefers-color-scheme: dark)' />
          <img src='img/landing/card-light.webp' width={362} height={538} loading='eager'
            alt="A bike card in Setups.Bike: a Specialized Stumpjumper Evo with tire pressures, fork and shock pressure, compression and rebound clicks, and volume tokens, on a saved setup called Dry" />
        </picture>
      </section>

      <section className='landingSection'>
        <h2>What it remembers</h2>
        <ul className='landingList'>
          {REMEMBERS.map(([what, detail]) => (
            <li key={what}><strong>{what}</strong><span>{detail}</span></li>
          ))}
        </ul>
      </section>

      <section className='landingSection'>
        <h2>Free and Pro</h2>
        <div className='landingPlans'>
          <div className='landingPlan'>
            <h3>Free</h3>
            <p className='landingPrice'>$0</p>
            <ul>
              <li>Up to 3 bikes</li>
              <li>All the settings above</li>
              <li>Works on any phone; add it to your home screen</li>
            </ul>
          </div>
          <div className='landingPlan pro'>
            <h3>Pro</h3>
            <p className='landingPrice'>$2.99<span>/month</span> or $24<span>/year</span></p>
            <ul>
              <li>Unlimited bikes</li>
              <li>Saved setups per bike: "Dry", "Wet", "Bike park"</li>
              <li>Ride notes, each with a snapshot of that day's settings</li>
              <li>Share a setup with a link; friends can copy it into their garage</li>
            </ul>
          </div>
        </div>
      </section>

      <section className='landingSection landingEnd'>
        {clipIn}
        <span className='landingNote'>Sign in with Google or your email.</span>
        <p className='landingNote'>Your numbers, your bike. Setups.Bike keeps the settings you choose.</p>
      </section>
    </main>
  );
}
