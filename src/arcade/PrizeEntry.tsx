import { useState } from 'react'
import { supabase, ensureAnonSession } from '../lib/supabase'
import { PRIZE_CONFIG, setPrizeDone } from '../lib/prize'

/**
 * Eenmalige, rustige uitnodiging na een goede score. Eerlijk over de testfase:
 * er is nog niks te winnen. Consent-first en AVG-proof: naam + e-mail worden
 * alleen opgeslagen mét toestemming, via de security-definer RPC. Altijd
 * overslaanbaar; komt daarna (per browser) niet meer terug.
 */
export function PrizeEntry({ gameId, score }: { gameId: string; score: number }) {
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
        p_game_id: gameId,
        p_score: score,
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
      <div className="w-full max-w-xs rounded-2xl bg-white/10 p-3 text-center text-sm text-white">
        🎉 Top, je staat op de lijst. We laten je weten zodra de actie start.
      </div>
    )
  }

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/10 p-3 text-left">
      <p className="text-sm font-semibold text-white">🚧 Nog in opbouw, doe je straks mee?</p>
      <p className="mt-0.5 text-xs text-white/70">
        Dit is nog een testfase, dus er is nu nog niks te winnen. Maar straks wel! Wil je meedoen om{' '}
        {PRIZE_CONFIG.prize} te winnen? Laat dan eenmalig je naam en e-mail achter, en wie weet ben jij
        winnaar van de week of maand.
      </p>
      <input
        type="text"
        placeholder="Je naam"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
      />
      <input
        type="email"
        inputMode="email"
        placeholder="jouw@email.nl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
      />
      <label className="mt-2 flex items-start gap-2 text-xs text-white/80">
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
      {err && <p className="mt-1 text-xs text-amber-300">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!valid || busy}
          onClick={submit}
          className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition disabled:opacity-50"
        >
          {busy ? 'Versturen…' : 'Doe mee'}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          Misschien later
        </button>
      </div>
    </div>
  )
}
