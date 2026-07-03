/**
 * Push-handlers voor de service worker. Dit bestand wordt door de gegenereerde
 * workbox-SW binnengehaald via importScripts (zie vite.config.ts), zodat de
 * bewezen offline/precache-opzet onaangeraakt blijft.
 *
 * Alleen storingsmeldingen voor de veren; nooit marketing.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    /* onleesbare payload: toon een generieke melding */
  }
  const title = data.title || 'IJhop'
  const options = {
    body: data.body || 'Er is een melding over jouw pont.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ijhop-storing',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
