import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @shared = pure TS modules shared with the Supabase Edge Functions (no Deno APIs in them).
const shared = fileURLToPath(new URL('../../supabase/functions/_shared', import.meta.url));
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': shared, '@': src } },
  // Never inline fonts as data: URLs: the CSP (public/_headers) only allows fonts from 'self'.
  build: { sourcemap: false, target: 'es2022', assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined) },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
} as never);
