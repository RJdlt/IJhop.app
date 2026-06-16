import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build-tijdstempel (Amsterdam) als versie-stempel in de footer — zo is in één
// oogopslag te zien of de PWA-cache al ververst is naar de nieuwe build.
const BUILD_ID = new Date()
  .toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'short' })

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The web app manifest is maintained by hand in public/manifest.json and
      // linked from index.html, so the plugin should not generate its own.
      manifest: false,
      injectRegister: 'auto',
      includeAssets: [
        'icon.svg',
        'favicon-32.png',
        'apple-touch-icon.png',
        'manifest.json',
      ],
      workbox: {
        // The whole timetable ships with the app, so the core works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
      },
    }),
  ],
})
