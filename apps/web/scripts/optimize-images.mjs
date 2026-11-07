// Resizes the stock photos (see public/img/CREDITS.md) into public/img/ as WebP.
// Usage: node apps/web/scripts/optimize-images.mjs <folder with the original .jpg downloads>
// Originals are named by the keys below (f1.jpg, addis.jpg, …). `sharp` is a root devDependency.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('Pass the folder that holds the original downloads.');
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// key → [output path under public/, width, height, crop position, optional pre-crop in source pixels]
const jobs = {
  // Full-length seated photo: crop to head and shoulders first (original is 2000×3000).
  f1: ['img/dentists/dr-selam-bekele.webp', 800, 1000, 'north', { left: 220, top: 260, width: 1000, height: 1250 }],
  m2: ['img/dentists/dr-dawit-alemu.webp', 800, 1000, 'north'],
  f2: ['img/dentists/dr-meron-tadesse.webp', 800, 1000, 'north'],
  m1: ['img/dentists/dr-yonas-girma.webp', 800, 1000, 'north'],
  addis: ['img/branches/addis-ababa.webp', 1600, 1000, 'centre'],
  gonder: ['img/branches/gonder.webp', 1600, 1000, 'centre'],
  scaling: ['img/services/scaling.webp', 1200, 800, 'centre'],
  whitening: ['img/services/teeth-whitening.webp', 1200, 800, 'centre'],
  aligner: ['img/services/braces-invisible.webp', 1200, 800, 'centre'],
  rootcanal: ['img/services/root-canal.webp', 1200, 800, 'centre'],
  emax: ['img/services/emax-crown.webp', 1200, 800, 'centre'],
  ceramic: ['img/services/ceramic-crown.webp', 1200, 800, 'centre'],
  denture: ['img/services/removable-denture.webp', 1200, 800, 'centre'],
};

for (const [key, [out, w, h, position, extract]] of Object.entries(jobs)) {
  const file = join(pub, out);
  mkdirSync(dirname(file), { recursive: true });
  let img = sharp(join(src, `${key}.jpg`));
  if (extract) img = img.extract(extract);
  const full = await img.resize(w, h, { fit: 'cover', position }).webp({ quality: 78 }).toBuffer();
  await sharp(full).toFile(file);
  // Half-width copy for cards and avatars (used via srcset; see src/lib/img.ts).
  await sharp(full).resize(Math.round(w / 2)).webp({ quality: 76 }).toFile(file.replace(/\.webp$/, '-sm.webp'));
  console.log('wrote', out, '(+ -sm)');
}

// Icons for browsers, home screens and search results (from the logo, on white).
const logo = join(pub, 'img/logo.png');
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const inner = await sharp(logo).resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'contain', background: '#ffffff' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } }).composite([{ input: inner, gravity: 'centre' }]).png().toFile(join(pub, name));
  console.log('wrote', name);
}

// Social share image (referenced by content/site.ts → ogImage).
await sharp(join(src, 'addis.jpg')).resize(1200, 630, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(join(pub, 'og-default.png'));
console.log('wrote og-default.png');

// Illustrative whitening pair: the "after" is the stock photo; the "before" is a SIMULATION that
// tints only the bright, low-saturation pixels (the teeth) toward a darker, yellower shade.
// The site labels this pair as an illustrative simulation, not a patient result.
const dir = join(pub, 'img/before-after');
mkdirSync(dir, { recursive: true });
const base = sharp(join(src, 'whitening.jpg')).resize(1200, 900, { fit: 'cover', position: 'centre' });
await base.clone().webp({ quality: 80 }).toFile(join(dir, 'whitening-after.webp'));
const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
const smooth = (e0, e1, x) => Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const m = smooth(150, 200, lum) * (1 - smooth(35, 70, sat)); // 1 on teeth, 0 on skin and lips
  data[i] = r * (1 - m * 0.06);
  data[i + 1] = g * (1 - m * 0.14);
  data[i + 2] = b * (1 - m * 0.34);
}
await sharp(data, { raw: info }).webp({ quality: 80 }).toFile(join(dir, 'whitening-before.webp'));
console.log('wrote before-after/whitening-{before,after}.webp');
