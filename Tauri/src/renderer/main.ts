// Import Tauri API bridge FIRST to set up window.visperAPI
import './lib/tauri-api';

import { mount } from 'svelte';
import App from './App.svelte';
import './styles/global.css';

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
