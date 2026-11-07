// Renders the booking band's 3D aligner and glass tooth once, as transparent WebP images.
// Usage: start `npx vite --port 5179` in apps/web, then `node scripts/render-deco.mjs`.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const url = process.env.DECO_URL ?? 'http://localhost:5179/scripts/deco-still.html';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('console', (m) => console.log('[page]', m.text()));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.deco, null, { timeout: 120000 });
const deco = await p.evaluate(() => window.deco);
await b.close();
for (const [k, data] of Object.entries(deco)) {
  const out = fileURLToPath(new URL(`../public/img/deco-${k}.webp`, import.meta.url));
  await sharp(Buffer.from(data.split(',')[1], 'base64')).trim().webp({ quality: 82, alphaQuality: 90 }).toFile(out);
  console.log('wrote', out);
}
