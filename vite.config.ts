import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
