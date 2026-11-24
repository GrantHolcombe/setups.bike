import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { registerServiceWorker } from './pwa';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Google sign-in client: the live one by default; `npm start` uses the localhost-only dev client
// from .env.development, so the live client can stay https-only (required to publish it).
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID
  || '347941074448-vqvn1gsthtvt4jj8u7ojnoqme16jh0h5.apps.googleusercontent.com';

root.render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </GoogleOAuthProvider>
);

// offline app shell and update notices (production builds only)
registerServiceWorker();

