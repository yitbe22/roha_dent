import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { App } from './App';
import { createI18n } from './i18n';
import './styles.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <I18nextProvider i18n={createI18n('en')}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>
);

// Prerendered pages hydrate; the SPA shell (app.html: /admin, /booking/*) renders fresh.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
