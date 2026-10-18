import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerCoreModifierPlugins } from '@acc/ir';
import App from './App';
import './index.css';

// Initialize canonical isomorphic modifier registry
registerCoreModifierPlugins();



ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
