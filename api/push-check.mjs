/**
 * Periodieke storingscontrole (pg_cron, elke 5 minuten): haalt de actuele
 * veeralerts op en stuurt elke NIEUWE storing één keer als pushmelding naar
 * abonnees met een geraakte favoriete lijn. Secret-beveiligd; dedupe via
 * push_sent. Plain ESM-JavaScript (zie storingen.mjs voor de reden).
 */
import { createRequire } from 'node:module'
import { filterFerryAlerts, alertLines } from './_lib/ferryAlerts.mjs'

const require = createRequire(import.meta.url)
const FEED_URL = 'https://gtfs.ovapi.nl/nl/alerts.pb'
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function rest(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const secret = typeof req.query?.secret === 'string' ? req.query.secret : ''
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      res.status(401).json({ ok: false })
      return
    }
    if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
      res.status(200).json({ ok: false, error: 'push niet geconfigureerd (env-variabelen ontbreken)' })
      return
    }
    const webpush = require('web-push')
    const { transit_realtime } = require('gtfs-realtime-bindings')
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:robertjandelaat@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )

    // 1. Actuele veeralerts.
    const r = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) throw new Error(`upstream ${r.status}`)
    const buf = new Uint8Array(await r.arrayBuffer())
    const feed = transit_realtime.FeedMessage.decode(buf)
    const plain = transit_realtime.FeedMessage.toObject(feed, { longs: String })
    const alerts = filterFerryAlerts(plain.entity ?? [], Math.floor(Date.now() / 1000))
    if (alerts.length === 0) {
      res.status(200).json({ ok: true, alerts: 0, sent: 0 })
      return
    }

    // 2. Blokkeerlijst: alerts die een admin als onterecht heeft gemarkeerd
    // gaan er nooit meer uit, ook niet als GVB de tekst aanpast.
    const blockResp = await rest(
      `push_alert_blocklist?select=alert_id&alert_id=in.(${alerts.map((a) => `"${a.id}"`).join(',')})`,
    )
    const geblokkeerd = new Set(
      blockResp.ok ? (await blockResp.json()).map((x) => x.alert_id) : [],
    )

    // 3. Wat we van deze alerts al weten. De tekst bewaren we mee, want GVB
    // hergebruikt dezelfde id bij een gewijzigde melding; dat leggen we apart
    // vast in plaats van er nog een keer voor te trillen.
    const sentResp = await rest(
      `push_sent?select=alert_id,header&alert_id=in.(${alerts.map((a) => `"${a.id}"`).join(',')})`,
    )
    const bekend = new Map(
      sentResp.ok ? (await sentResp.json()).map((x) => [x.alert_id, x.header ?? null]) : [],
    )

    // Tekstwijzigingen loggen. Geen nieuwe melding: één storing hoort één keer
    // te trillen, ook als de bewoording verandert.
    for (const a of alerts) {
      if (!bekend.has(a.id)) continue
      const oud = bekend.get(a.id)
      if (oud != null && oud !== a.header) {
        await rest('push_alert_changes', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ alert_id: a.id, old_header: oud, new_header: a.header }),
        }).catch(() => {})
        await rest(`push_sent?alert_id=eq.${encodeURIComponent(a.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ header: a.header }),
        }).catch(() => {})
      }
    }

    const teDoen = alerts.filter((a) => !geblokkeerd.has(a.id))
    if (teDoen.length === 0) {
      res.status(200).json({ ok: true, alerts: alerts.length, blocked: geblokkeerd.size, sent: 0 })
      return
    }

    // 4. Abonnees laden.
    const subsResp = await rest('push_subscriptions?select=endpoint,p256dh,auth,lines')
    const subs = (await subsResp.json()) ?? []

    // Wie kreeg welke alert al? Ontdubbelen gebeurt per abonnee en niet
    // globaal: wie zich later abonneert mist een lopende storing anders
    // helemaal, en een geslaagde tweede poging was niet te onderscheiden van
    // een eerste voor iemand nieuw.
    const alRespons = await rest(
      `push_sent_to?select=alert_id,endpoint&alert_id=in.(${teDoen.map((a) => `"${a.id}"`).join(',')})`,
    )
    const al = new Set(
      alRespons.ok ? (await alRespons.json()).map((x) => `${x.alert_id}|${x.endpoint}`) : [],
    )

    let sent = 0
    const dead = []
    for (const alert of teDoen) {
      // De lijnen komen uit het filter zelf; dat weet of het bericht
      // netwerkbreed was en hoeft hier niet geraden te worden.
      const lines = alertLines(alert)
      const payload = JSON.stringify({
        title: `Storing op pont ${lines.length <= 3 ? lines.join(', ') : 'GVB'}`,
        body: alert.header,
        tag: alert.id,
        url: '/',
      })

      let ontvangers = 0
      for (const sub of subs) {
        // Echte lijn-overlap tussen wat deze abonnee koos en wat dit bericht
        // raakt. Geen "raakt toevallig een veerlijn": als F4 en F9 gekozen
        // zijn en de storing raakt F2, dan gaat het hem niet aan.
        const gekozen = Array.isArray(sub.lines) ? sub.lines : []
        if (gekozen.length === 0) continue
        if (!gekozen.some((l) => lines.includes(l))) continue
        if (al.has(`${alert.id}|${sub.endpoint}`)) continue

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
          ontvangers++
          await rest('push_sent_to', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify({ alert_id: alert.id, endpoint: sub.endpoint }),
          }).catch(() => {})
        } catch (e) {
          const code = (e && e.statusCode) || 0
          if (code === 404 || code === 410) dead.push(sub.endpoint) // abonnement weg
        }
      }

      // Eén regel per alert, met genoeg erbij om hem in het dashboard terug te
      // herkennen zonder de feed erbij te halen.
      await rest('push_sent?on_conflict=alert_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          alert_id: alert.id,
          header: alert.header,
          lines,
          network_wide: alert.networkWide === true,
          recipients: ontvangers,
        }),
      }).catch(() => {})
    }

    // 5. Dode abonnementen opruimen.
    for (const endpoint of new Set(dead)) {
      await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
    }
    res.status(200).json({
      ok: true,
      alerts: alerts.length,
      blocked: geblokkeerd.size,
      sent,
      cleaned: dead.length,
    })
  } catch (e) {
    res.status(200).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
