import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { App } from './App';
import { createI18n } from './i18n';
import { HeadCollector, renderHead, type HeadData } from './lib/seo';

export { PUBLIC_ROUTES } from './routes';

export function render(url: string) {
  let head: HeadData | undefined;
  const html = renderToString(
    <StrictMode>
      <HeadCollector.Provider value={{ set: (h) => (head = h) }}>
        <I18nextProvider i18n={createI18n('en')}>
          <StaticRouter location={url}>
            <App />
          </StaticRouter>
        </I18nextProvider>
      </HeadCollector.Provider>
    </StrictMode>,
  );
  return { html, head: renderHead(head) };
}
