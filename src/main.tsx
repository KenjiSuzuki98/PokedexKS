import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore } from './storage/store';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={createStore()} />
  </StrictMode>,
);
