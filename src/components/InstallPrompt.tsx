import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'

/**
 * Nodigt de bezoeker uit om IJhop op het startscherm te zetten (PWA-install).
 *
 * - Al geïnstalleerd (standalone) of weggeklikt → niets tonen.
 * - Android/desktop Chrome: vangt `beforeinstallprompt` en toont één knop die
 *   de echte install-dialoog opent.
 * - iOS/iPadOS (Safari ondersteunt geen prompt): toont de handmatige stappen,
 *   net als de schermafbeelding (deelknop → "Zet op beginscherm").
 */

const DISMISS_KEY = 'ijhop:install:dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari gebruikt deze niet-standaard vlag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ doet zich voor als macOS, maar heeft touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function InstallPrompt() {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const installed = isStandalone()
  const ios = isIOS()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // bewaar 'm zodat we hem op ons eigen moment tonen
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Niets te tonen: geïnstalleerd, weggeklikt, of geen bruikbare actie.
  if (installed || dismissed || (!ios && !deferred)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* faal stil */
    }
    setDismissed(true)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  return (
    <section className="card animate-riseIn p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t.install.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.install.subtitle}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-f4/10 text-2xl">
          📲
        </span>
      </div>

      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          📲 {t.install.button}
        </button>
      ) : (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="font-semibold">{t.install.iosTitle}</p>
          <ol className="mt-2 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {[t.install.ios1, t.install.ios2, t.install.ios3].map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full text-center text-sm font-medium text-slate-400 underline-offset-2 hover:underline"
      >
        {t.install.dismiss}
      </button>
    </section>
  )
}
