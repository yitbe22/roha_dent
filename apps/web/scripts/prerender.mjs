// Renders every public route to static HTML so content, meta tags and JSON-LD are in the source.
// Output layout matches Cloudflare Pages "clean URLs": /about → about.html (served at /about, no trailing slash).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, 'dist/client');
const template = readFileSync(join(client, 'index.html'), 'utf8');
const { render, PUBLIC_ROUTES } = await import(pathToFileURL(join(root, 'dist/server/entry-server.js')).href);
// Same source as the app (content/site.ts reads VITE_SITE_URL from .env.production), so canonical
// links, JSON-LD, the sitemap and robots.txt always name one host.
const { loadEnv } = await import('vite');
const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const siteUrl = (env.VITE_SITE_URL || 'https://rohadent.com').replace(/\/$/, '');

const fill = (head, html) => template.replace('<!--app-head-->', head).replace('<!--app-html-->', html);
const write = (file, content) => {
  const out = join(client, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
};

const images = {}; // path → the page's share image, listed in the sitemap for image search
for (const { path } of PUBLIC_ROUTES) {
  const { html, head } = render(path);
  write(path === '/' ? 'index.html' : `${path.slice(1)}.html`, fill(head, html));
  const img = /<meta property="og:image" content="([^"]+)"/.exec(head)?.[1];
  if (img) images[path] = img; // already XML-escaped by renderHead
  console.log(`  prerendered ${path}`);
}

const nf = render('/__not-found__');
write('404.html', fill(nf.head, nf.html));

// SPA shell for client-only routes (/admin, /booking/:token)
write('app.html', fill('<title>Roha Speciality Dental Center</title>\n    <meta name="robots" content="noindex" />', ''));

const today = new Date().toISOString().slice(0, 10);
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${PUBLIC_ROUTES.map(
    (r) => `  <url><loc>${siteUrl}${r.path === '/' ? '/' : r.path}</loc><lastmod>${today}</lastmod><priority>${r.priority.toFixed(1)}</priority>${
      images[r.path] ? `<image:image><image:loc>${images[r.path]}</image:loc></image:image>` : ''
    }</url>`,
  ).join('\n')}\n</urlset>\n`,
);
// robots.txt (copied from public/) points at this build's sitemap.
const robotsFile = join(client, 'robots.txt');
writeFileSync(robotsFile, readFileSync(robotsFile, 'utf8').replace(/^Sitemap:.*$/m, `Sitemap: ${siteUrl}/sitemap.xml`));
console.log(`  wrote 404.html, app.html, sitemap.xml (${PUBLIC_ROUTES.length} urls), robots.txt → ${siteUrl}`);
