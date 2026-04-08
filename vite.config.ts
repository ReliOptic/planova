import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Planova',
        short_name: 'Planova',
        description: 'Offline visual task timeline.',
        theme_color: '#1e293b',
        background_color: '#1e293b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'ko',
        categories: ['productivity'],
        icons: [
          {
            src: '/icons/icon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
          },
          {
            src: '/icons/icon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify — file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
