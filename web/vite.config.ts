import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuration Vite + PWA (section 11.4).
 *
 * - `precache` du shell applicatif (Workbox).
 * - `NetworkFirst` pour `/api` avec expiration 24 h.
 * - `CacheFirst` pour les images signees.
 * - `StaleWhileRevalidate` pour le corpus des consignes.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['assets/icon.svg', 'favicon.svg'],
      manifest: {
        name: 'PrevEnSanté — Prévention des risques professionnels',
        short_name: 'PrevEnSanté',
        description:
          'Signalez les dangers, suivez les accidents et les actions correctives pour les mines, cimenteries, usines et chantiers.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6f7',
        theme_color: '#14425c',
        lang: 'en',
        dir: 'ltr',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/assets/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-network-first',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/storage/v1/object/sign/') ||
              /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'signed-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/safety_documents/') || url.pathname.includes('/instructions'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'instructions',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
});
