import { render } from 'solid-js/web';
import { registerCoreModifierPlugins } from '@acc/ir';
import { PlayheadController } from './lib/playhead/PlayheadController';
import App from './App';
import './index.css';

import { bootstrapClient } from './bootstrap';

// Initialize canonical isomorphic modifier registry and client adapters
bootstrapClient();
registerCoreModifierPlugins();

if (import.meta.env.DEV) {
  (window as any).PlayheadController = PlayheadController;
}

render(() => <App />, document.getElementById('root')!);
