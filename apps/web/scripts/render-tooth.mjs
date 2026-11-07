// Renders the hero tooth once and saves it as public/img/tooth.webp (the phone image).
// Usage: start `npx vite --port 5179` in apps/web, then `node scripts/render-tooth.mjs`.
// Needs `sharp` available (e.g. `npx -y -p sharp node scripts/render-tooth.mjs` style setups).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const url = process.env.TOOTH_URL ?? 'http://localhost:5179/scripts/tooth-still.html';
const out = new URL('../public/img/tooth.png', import.meta.url);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 });
p.on('console', (m) => console.log('[page]', m.text()));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.toothPng, null, { timeout: 60000 });
const data = await p.evaluate(() => window.toothPng);
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await b.close();
console.log('wrote', out.pathname);
