/**
 * Vertrek-nu-meldingen versturen. Draait elke minuut.
 *
 * Zelfde opzet als push-check.mjs: secret-beveiligd, service-role-sleutel,
 * plain ESM. Wordt aangeroepen door pg_cron in Supabase; zie het blok
 * onderaan 0026_planner.sql voor het commando.
 *
 * Wat er verstuurd is staat in de tabel, niet in een analytics-event. Een
 * event uit de app zegt alleen dat iemand op een knop drukte; deze regel zegt
 * dat er echt een melding de deur uit ging.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** Hoe lang na het tijdstip we een herinnering nog de moeite waard vinden.
 *  Vijf minuten te laat "vertrek nu" is geen hulp meer maar spot. */
const TE_LAAT_MS = 5 * 60_000

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
    if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PRIVATE_KEY) {
      res.status(200).json({ ok: false, error: 'push niet geconfigureerd' })
      return
    }
    const webpush = require('web-push')
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:robertjandelaat@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )

    const nu = Date.now()
    const vanaf = new Date(nu - TE_LAAT_MS).toISOString()
    const tot = new Date(nu).toISOString()

    const r = await rest(
      `reminders?select=id,user_id,fire_at,title,body&sent_at=is.null&failed_at=is.null` +
        `&fire_at=gte.${vanaf}&fire_at=lte.${tot}&order=fire_at&limit=200`,
    )
    if (!r.ok) throw new Error(`reminders ${r.status}`)
    const due = await r.json()
    if (due.length === 0) {
      res.status(200).json({ ok: true, due: 0, sent: 0 })
      return
    }

    // Verlopen herinneringen sluiten we af zonder te sturen: te laat is te laat.
    await rest(`reminders?sent_at=is.null&failed_at=is.null&fire_at=lt.${vanaf}`, {
      method: 'PATCH',
      body: JSON.stringify({ failed_at: new Date().toISOString(), error: 'te laat' }),
    }).catch(() => {})

    let verstuurd = 0
    for (const rem of due) {
      const subsResp = await rest(
        `push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${rem.user_id}`,
      )
      const subs = subsResp.ok ? await subsResp.json() : []
      let gelukt = false
      let fout = 'geen abonnement'
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: rem.title, body: rem.body, tag: 'ijhop-vertrek', url: '/' }),
          )
          gelukt = true
        } catch (e) {
          fout = e instanceof Error ? e.message : String(e)
          // 404 of 410: het abonnement bestaat niet meer, ruim het op.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
              method: 'DELETE',
            }).catch(() => {})
          }
        }
      }
      await rest(`reminders?id=eq.${rem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          gelukt
            ? { sent_at: new Date().toISOString() }
            : { failed_at: new Date().toISOString(), error: fout.slice(0, 200) },
        ),
      }).catch(() => {})
      if (gelukt) verstuurd++
    }

    res.status(200).json({ ok: true, due: due.length, sent: verstuurd })
  } catch (e) {
    res.status(200).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
