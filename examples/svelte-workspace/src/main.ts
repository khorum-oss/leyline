import { mount } from 'svelte';
import App from './App.svelte';
import '@leyline-examples/scenario/styles.css';

mount(App, { target: document.getElementById('root') as HTMLElement });
