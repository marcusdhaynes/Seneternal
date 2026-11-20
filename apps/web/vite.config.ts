import { defineConfig } from 'vite';
export default defineConfig({
  // GitHub Pages project paths use the repository's canonical casing.
  // This repository is `Seneternal`, NOT `seneternal`; the wrong case makes
  // JavaScript/CSS chunks return 404 and leaves the page completely blank.
  base: process.env.GITHUB_PAGES === 'true' ? '/Seneternal/' : '/',
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1100 }
});
