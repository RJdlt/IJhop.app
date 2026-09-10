import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18n'
import { track } from '../lib/analytics'
import { isIOS, isStandalone } from '../lib/display'
import { profile } from '../lib/profile'
import type { Profile } from '../lib/profile'

/**
 * Nodigt de bezoeker uit om IJhop op het beginscherm te zetten.
 *
 * Eén regel tekst en één knop, onder de klok. Op Android en desktop Chrome
 * opent die knop de echte install-dialoog (we vangen `beforeinstallprompt` af
 * en bewaren hem tot de bezoeker klikt). Op iOS bestaat die dialoog niet, dus
 * daar klapt er een uitleg van twee stappen open.
 *
 * Wanneer we hem tonen is een proef met twee armen, want we weten niet wat
 * werkt:
 *
 *   A: vanaf het tweede bezoek. Rustig, maar je mist iedereen die één keer
 *      langskomt.
 *   B: al bij het eerste bezoek, na 30 seconden kijken. Bereikt meer mensen,
 *      maar vraagt iets van iemand die de app net ontdekt.
 *
 * De arm ligt vast per bezoeker (deterministisch uit zijn id) en gaat mee in
 * elk install-event, zodat het dashboard de twee kan vergelijken.
 */

const DISMISS_KEY = 'ijhop:install:dismissed'
const DISMISS_DAYS = 14
/** Zo lang moet de app zichtbaar zijn geweest voordat arm B iets vraagt. */
export const VARIANT_B_DELAY_MS = 30_000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Ligt het wegklikken minder dan 14 dagen terug? Dan houden we onze mond.
 *  Vóór deze versie schreven we hier alleen '1' neer, zonder tijdstip; die
 *  mensen hebben ooit nee gezegd en krijgen de vraag niet opnieuw. */
export function dismissActive(stored: string | null, now: number): boolean {
  if (!stored) return false
  const at = Number(stored)
  const isTimestamp = Number.isFinite(at) && at > Date.parse('2020-01-01')
  if (!isTimestamp) return true
  return now - at < DISMISS_DAYS * 86_400_000
}

/** Mag de prompt nu, gegeven de arm, het bezoeknummer en de kijktijd? */
export function shouldShow(variant: 'A' | 'B', visits: number, visibleMs: number): boolean {
  if (variant === 'A') return visits >= 2
  return visits >= 2 || visibleMs >= VARIANT_B_DELAY_MS
}

export function InstallPrompt() {
  const { t } = useI18n()
  const [prof, setProf] = useState<Profile | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visibleMs, setVisibleMs] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [gone, setGone] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return dismissActive(localStorage.getItem(DISMISS_KEY), Date.now())
    } catch {
      return false
    }
  })

  const installed = isStandalone()
  const ios = isIOS()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // bewaren, zodat we hem op ons eigen moment tonen
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  useEffect(() => {
    if (installed) return
    let alive = true
    profile().then((p) => alive && setProf(p))
    return () => {
      alive = false
    }
  }, [installed])

  // Kijktijd voor arm B. Telt alleen door zolang de app echt zichtbaar is:
  // een tabblad dat op de achtergrond ligt is geen aandacht.
  useEffect(() => {
    if (installed || dismissed || !prof || prof.variant !== 'B' || prof.visits >= 2) return
    if (visibleMs >= VARIANT_B_DELAY_MS) return
    const step = 1000
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setVisibleMs((ms) => ms + step)
    }, step)
    return () => clearInterval(timer)
  }, [installed, dismissed, prof, visibleMs])

  // Op Android en desktop Chrome hebben we alleen iets te bieden zodra de
  // browser `beforeinstallprompt` gaf; op iOS is de uitleg altijd bruikbaar.
  const canOffer = ios || deferred != null
  const show =
    !installed &&
    !dismissed &&
    !gone &&
    canOffer &&
    prof != null &&
    shouldShow(prof.variant, prof.visits, visibleMs)

  // Eén keer melden dat de uitnodiging in beeld kwam, met de arm erbij.
  const [reported, setReported] = useState(false)
  useEffect(() => {
    if (!show || reported || !prof) return
    setReported(true)
    track('install_prompt_shown', { variant: prof.variant, visit_nr: prof.visits })
  }, [show, reported, prof])

  if (!show || !prof) return null

  const meta = { variant: prof.variant, visit_nr: prof.visits }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* faal stil */
    }
    track('install_prompt_dismissed', meta)
    setDismissed(true)
  }

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setGone(true)
      return
    }
    // Geen native dialoog: op iOS moet het met de hand, dus leg het uit.
    setHelpOpen(true)
    track('install_prompt_ios_help_opened', meta)
  }

  return (
    <section className="card animate-riseIn px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-f4/10 text-xl">
          📲
        </span>
        <p className="flex-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
          {t.install.line}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={install}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {t.install.button}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          {t.install.dismiss}
        </button>
      </div>

      {helpOpen && (
        <ol className="mt-3 flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {[t.install.step1, t.install.step2].map((step, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
