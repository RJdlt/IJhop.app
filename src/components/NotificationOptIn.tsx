import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { pushSupported, pushConfig, subscribedLines, subscribePush, unsubscribePush } from '../lib/push'
import { track } from '../lib/analytics'

interface NotificationOptInProps {
  /** Favoriete lijnen; zonder favorieten tonen we deze kaart niet. */
  favLines: string[]
}

/**
 * Rustige opt-in voor storingsmeldingen op je favoriete pont(en). Verschijnt
 * alleen als de browser het kan én er favorieten zijn. De permissievraag komt
 * pas na een bewuste tik, met uitleg vooraf. Nooit marketing.
 */
export function NotificationOptIn({ favLines }: NotificationOptInProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false) // server geconfigureerd?
  const [subscribed, setSubscribed] = useState<string[] | null>(() => subscribedLines())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) return
    let alive = true
    pushConfig().then((cfg) => {
      if (alive && cfg?.enabled) setEnabled(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // Favorieten gewijzigd terwijl je geabonneerd bent: abonnement stil bijwerken.
  useEffect(() => {
    if (!subscribed || favLines.length === 0) return
    const same = subscribed.length === favLines.length && subscribed.every((l) => favLines.includes(l))
    if (!same) {
      subscribePush(favLines).then((r) => {
        if (r === 'ok') setSubscribed(favLines)
      })
    }
  }, [favLines, subscribed])

  if (!pushSupported() || !enabled || favLines.length === 0) return null

  const on = subscribed != null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    if (on) {
      await unsubscribePush()
      setSubscribed(null)
      track('push_unsubscribe')
    } else {
      const r = await subscribePush(favLines)
      if (r === 'ok') {
        setSubscribed(favLines)
        setMsg(t.pushOn)
        track('push_subscribe', { lines: favLines })
      } else {
        setMsg(r === 'denied' ? t.pushDenied : t.pushError)
        track('push_subscribe_failed', { reason: r })
      }
    }
    setBusy(false)
  }

  return (
    <div className="card flex items-center gap-3 px-5 py-4">
      <span className="text-xl" aria-hidden>{on ? '🔔' : '🔕'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t.pushTitle}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {on ? `${t.pushActiveFor} ${subscribed!.join(', ')}` : t.pushExplain}
        </p>
        {msg && <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{msg}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition disabled:opacity-60 ${
          on
            ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
            : 'bg-brand text-white shadow-md shadow-brand/30'
        }`}
      >
        {busy ? '…' : on ? t.pushOff : t.pushEnable}
      </button>
    </div>
  )
}
