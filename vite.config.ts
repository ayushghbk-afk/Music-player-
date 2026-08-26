import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow requests through preview/proxy hosts (e.g. *.e2b.app). Without
      // this, Vite's host check rejects the preview with a 403 and the app
      // never loads.
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
    },
  };
});
