import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { registerServiceWorker } from './pwa';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <GoogleOAuthProvider clientId='347941074448-vqvn1gsthtvt4jj8u7ojnoqme16jh0h5.apps.googleusercontent.com'>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </GoogleOAuthProvider>
);

// offline app shell and update notices (production builds only)
registerServiceWorker();

