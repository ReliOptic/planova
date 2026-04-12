import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Vite config — Tauri 2 desktop target (Windows 11 WebView2).
 *
 * Notes:
 * - `base: './'` lets Tauri load assets from `tauri://localhost/` without a
 *   hard-coded absolute path.
 * - `server.strictPort` must be true so Tauri's dev hook can rely on port 3000.
 * - `clearScreen: false` keeps Rust build output visible alongside Vite.
 * - PWA plugin is intentionally absent — service workers are a web deployment
 *   concern and would fight WebView2's single-window assumptions.
 */
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: 'localhost',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      // Tell Vite to ignore the Rust target dir so file watchers don't churn
      // during `cargo build`.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'chrome120',
    sourcemap: true,
  },
}));
