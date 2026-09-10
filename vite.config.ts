import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Versiestempel. De commit-hash is de enige die twee builds echt uit elkaar
// houdt, dus die gaat voor; Vercel zet hem in de omgeving. Lokaal vragen we
// het aan git, en lukt dat ook niet (los uitgepakte map), dan valt het terug
// op de bouwtijd. Deze waarde staat onderaan het scherm en gaat mee in elk
// analytics-event, zodat het dashboard kan laten zien wie nog op oud draait.
function buildVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return `t${Math.floor(Date.now() / 1000).toString(36)}`
  }
}

const APP_VERSION = buildVersion()
const BUILT_AT = new Date().toISOString()
const BUILD_ID = new Date()
  .toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'short' })

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' en niet 'autoUpdate'. Met autoUpdate roept de nieuwe worker
      // meteen skipWaiting() en clientsClaim() aan: die neemt het dan over
      // terwijl de pagina nog de oude code draait, en wisselt de gecachete
      // bestanden onder een lopende aftelling vandaan. Nu blijft de nieuwe
      // versie netjes wachten tot de bezoeker op "Vernieuwen" tikt.
      registerType: 'prompt',
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
        // De bezoeker bepaalt het moment; zie hierboven.
        skipWaiting: false,
        clientsClaim: false,
        // Ruim de precache van vorige versies op zodra de nieuwe het overneemt,
        // anders blijft er per build een set bestanden liggen.
        cleanupOutdatedCaches: true,
        // Push-handlers los van de gegenereerde SW (public/push-sw.js), zodat
        // web push werkt zonder de precache-opzet te verbouwen.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
