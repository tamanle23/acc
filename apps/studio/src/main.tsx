import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerClientModifierPlugins } from '@acc/ir/plugins/clientRegistry';
import App from './App';
import './index.css';

// Initialize isomorphic client modifier registry
registerClientModifierPlugins();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
