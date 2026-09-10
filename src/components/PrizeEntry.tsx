import { useState } from 'react'
import { supabase, ensureAnonSession } from '../lib/supabase'
import { PRIZE_CONFIG, setPrizeDone } from '../lib/prize'

/**
 * Eenmalige, rustige uitnodiging voor de prijzenactie. Eerlijk over de
 * testfase: er is nog niks te winnen. Consent-first en AVG-proof: naam +
 * e-mail worden alleen opgeslagen mét toestemming, via de security-definer
 * RPC. Altijd overslaanbaar; komt daarna (per browser) niet meer terug.
 *
 * Stond eerder op het game-over-scherm en hing aan een spelscore. Nu de
 * spellen weg zijn staat hij op het klok-scherm en gaat er een neutrale
 * inzending naar dezelfde RPC (die accepteert score 0 gewoon).
 */
export function PrizeEntry() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && consent

  const submit = async () => {
    if (!supabase || !valid) return
    setBusy(true)
    setErr(null)
    try {
      await ensureAnonSession()
      const { error } = await supabase.rpc('submit_highscore_entry', {
        p_game_id: 'ijhop',
        p_score: 0,
        p_name: name,
        p_email: email,
        p_consent: consent,
      })
      if (error) throw error
      setPrizeDone()
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Er ging iets mis.')
    } finally {
      setBusy(false)
    }
  }

  if (hidden) return null
  if (done) {
    return (
      <section className="card px-5 py-4 text-center text-sm">
        🎉 Top, je staat op de lijst. We laten je weten zodra de actie start.
      </section>
    )
  }

  return (
    <section className="card px-5 py-4 text-left">
      <p className="text-sm font-semibold">🚧 Nog in opbouw, doe je straks mee?</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Dit is nog een testfase, dus er is nu nog niks te winnen. Maar straks wel! Wil je meedoen om{' '}
        {PRIZE_CONFIG.prize} te winnen? Laat dan eenmalig je naam en e-mail achter, en wie weet ben jij
        winnaar van de week of maand.
      </p>
      <input
        type="text"
        placeholder="Je naam"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand dark:border-white/10"
      />
      <input
        type="email"
        inputMode="email"
        placeholder="jouw@email.nl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand dark:border-white/10"
      />
      <label className="mt-2 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        />
        <span>
          Ja, ik wil mails over acties ontvangen. Zie de{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            privacyverklaring
          </a>
          .
        </span>
      </label>
      {err && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!valid || busy}
          onClick={submit}
          className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {busy ? 'Versturen…' : 'Doe mee'}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          Misschien later
        </button>
      </div>
    </section>
  )
}
