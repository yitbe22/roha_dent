import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @shared = pure TS modules shared with the Supabase Edge Functions (no Deno APIs in them).
const shared = fileURLToPath(new URL('../../supabase/functions/_shared', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': shared } },
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
} as never);
