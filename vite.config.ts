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
      // 'prompt' en niet 'autoUpdate': wij bepalen wanneer er herladen wordt,
      // niet de browser. Zie de workbox-instellingen hieronder voor de reden
      // dat skipWaiting toch aan staat.
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
        // Deze twee horen bij elkaar en de combinatie is met opzet zo.
        //
        // skipWaiting AAN: de nieuwe worker blijft niet in de wachtstand
        // hangen. Dat klinkt tegenstrijdig, maar een wachtende worker wordt
        // pas actief als álle vensters van de app dicht zijn geweest, en een
        // geïnstalleerde PWA op een telefoon gaat soms weken niet dicht.
        // Getest: met skipWaiting uit bleef zo'n toestel op de oude versie,
        // ook nadat de bezoeker op "Vernieuwen" tikte, want een gewone
        // herlaad maakt een wachtende worker niet actief.
        //
        // clientsClaim UIT: de nieuwe worker neemt geen open pagina's over.
        // Wie op dat moment naar de aftelklok kijkt houdt zijn eigen worker
        // en zijn eigen bestanden tot hij zelf herlaadt. Er wisselt dus
        // niets onder een lopende telling vandaan.
        //
        // Samen: de nieuwe versie staat klaar, de app zegt dat met een balkje,
        // en pas bij een tik (of de volgende keer openen) stap je over.
        skipWaiting: true,
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
