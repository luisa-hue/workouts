import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import IconPage from './screens/IconPage';
import './styles.css';
import { applyTheme, loadTheme } from './lib/theme';
import { applyIcon, loadIcon } from './lib/app-icon';

applyTheme(loadTheme());
applyIcon(loadIcon());

// /#icon is a public page for choosing the Home Screen icon (no login), used from Safari.
const iconPage = window.location.hash === '#icon';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {iconPage ? <IconPage /> : <App />}
  </StrictMode>,
);
