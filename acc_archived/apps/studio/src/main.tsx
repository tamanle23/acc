import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerCoreModifierPlugins } from '@acc/ir';
import App from './App';
import './index.css';

import { bootstrapClient } from './bootstrap';

// Initialize canonical isomorphic modifier registry and client adapters
bootstrapClient();
registerCoreModifierPlugins();



ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
