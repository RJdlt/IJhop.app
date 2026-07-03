import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { fetchDisruptions, affectedLines } from '../lib/disruptions'
import type { Disruption } from '../lib/disruptions'
import { fetchDelayCounts } from '../lib/delayReports'
import type { DelayCount } from '../lib/delayReports'
import { track } from '../lib/analytics'

const DISMISS_KEY = 'ijhop:dismissed-alerts'
const OFFICIAL_POLL_MS = 5 * 60 * 1000
const COMMUNITY_POLL_MS = 2 * 60 * 1000
/** Community-signaal pas tonen vanaf dit aantal meldingen binnen 20 minuten. */
const COMMUNITY_MIN = 2

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveDismissed(s: Set<string>) {
  try {
    // Bewaar hooguit de laatste 20 id's; oude storingen komen toch niet terug.
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-20)))
  } catch {
    /* faal stil */
  }
}

interface DisruptionBannerProps {
  /** Favoriete lijnen; leeg = alles is relevant. */
  favLines: string[]
}

/**
 * Rustige storingsstrook op het hoofdscherm. Onzichtbaar zonder storing.
 * Twee bronnen: officiele GVB-alerts (via /api/storingen) en anonieme
 * community-meldingen (vanaf 2 binnen 20 minuten). Laadt parallel aan de
 * aftelklok; de klok wacht hier nooit op.
 */
export function DisruptionBanner({ favLines }: DisruptionBannerProps) {
  const { t } = useI18n()
  const [alerts, setAlerts] = useState<Disruption[]>([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [counts, setCounts] = useState<DelayCount[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const shownRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    const load = async () => {
      const feed = await fetchDisruptions()
      if (alive && feed) {
        setAlerts(feed.alerts)
        setUpdatedAt(new Date())
      }
    }
    load()
    const id = setInterval(load, OFFICIAL_POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const rows = await fetchDelayCounts()
      if (alive) setCounts(rows)
    }
    load()
    const id = setInterval(load, COMMUNITY_POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const favSet = new Set(favLines)
  const relevantLine = (line: string) => favSet.size === 0 || favSet.has(line)

  const visibleAlerts = alerts.filter((a) => {
    if (dismissed.has(a.id)) return false
    const lines = affectedLines(a)
    return lines.some(relevantLine)
  })
  const crowd = counts.filter((c) => c.reports >= COMMUNITY_MIN && relevantLine(c.line_id))

  // Meet of banners echt gezien worden (één event per melding per sessie).
  useEffect(() => {
    for (const a of visibleAlerts) {
      if (!shownRef.current.has(a.id)) {
        shownRef.current.add(a.id)
        track('disruption_shown', { id: a.id, source: 'gvb' })
      }
    }
    for (const c of crowd) {
      const key = `crowd:${c.line_id}`
      if (!shownRef.current.has(key)) {
        shownRef.current.add(key)
        track('disruption_shown', { id: key, source: 'community', reports: c.reports })
      }
    }
  }, [visibleAlerts, crowd])

  if (visibleAlerts.length === 0 && crowd.length === 0) return null

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(next)
    track('disruption_dismiss', { id })
  }
  const stamp = (d: Date | null) =>
    d ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="flex flex-col gap-2">
      {visibleAlerts.slice(0, 2).map((a) => (
        <div
          key={a.id}
          className="animate-riseIn flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/30"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>🚧</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t.disruption} · GVB
              {affectedLines(a).length < 7 ? ` · ${affectedLines(a).join(', ')}` : ''}
            </p>
            <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-100">{a.header}</p>
            {updatedAt && (
              <p className="mt-1 text-[11px] text-amber-700/70 dark:text-amber-300/60">
                {t.lastUpdated} {stamp(updatedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label={t.dismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-amber-700/70 transition hover:bg-amber-100 dark:text-amber-300/70 dark:hover:bg-amber-400/10"
          >
            ✕
          </button>
        </div>
      ))}
      {crowd.map((c) => (
        <div
          key={c.line_id}
          className="animate-riseIn flex items-center gap-3 rounded-2xl bg-sky-50 px-4 py-2.5 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-400/30"
        >
          <span aria-hidden>🕐</span>
          <p className="min-w-0 flex-1 text-sm text-sky-900 dark:text-sky-100">
            <strong>{c.line_id}</strong>: {c.reports} {t.delayCrowd}
          </p>
          <span className="shrink-0 text-[11px] tabular-nums text-sky-700/70 dark:text-sky-300/60">
            {stamp(new Date(c.latest))}
          </span>
        </div>
      ))}
    </div>
  )
}
