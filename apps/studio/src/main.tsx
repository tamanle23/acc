import { render } from 'solid-js/web';
import { registerCoreModifierPlugins } from '@acc/ir';
import App from './App';
import './index.css';

import { bootstrapClient } from './bootstrap';

// Initialize canonical isomorphic modifier registry and client adapters
bootstrapClient();
registerCoreModifierPlugins();

render(() => <App />, document.getElementById('root')!);
