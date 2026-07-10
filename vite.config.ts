import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages serves project sites at https://USERNAME.github.io/REPO_NAME/
// Vite needs `base` set to that sub-path so all asset URLs are prefixed
// correctly. For a custom domain (e.g. redlife.studio), leave VITE_BASE_PATH
// unset — the site is served from the root, so base = '/'.
//
// The GitHub Actions workflow sets VITE_BASE_PATH to /REPO_NAME automatically.
// For local dev, this is undefined and defaults to '/', which is correct.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
