import { useState } from 'react'
import { supabase, ensureAnonSession } from '../lib/supabase'

/**
 * Optionele inzending na een goede score: e-mail + expliciete toestemming voor
 * een toekomstige prijzenactie. Consent-first en AVG-proof: zonder vinkje geen
 * opslag. Insert gaat via de security-definer RPC submit_highscore_entry.
 */
export function PrizeEntry({ gameId, score }: { gameId: string; score: number }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const valid = /\S+@\S+\.\S+/.test(email) && consent

  const submit = async () => {
    if (!supabase || !valid) return
    setBusy(true)
    setErr(null)
    try {
      await ensureAnonSession()
      const { error } = await supabase.rpc('submit_highscore_entry', {
        p_game_id: gameId,
        p_score: score,
        p_email: email,
        p_consent: consent,
      })
      if (error) throw error
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Er ging iets mis.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-xs rounded-2xl bg-white/10 p-3 text-center text-sm text-white">
        🎉 Bedankt! Je doet mee aan de actie. Succes!
      </div>
    )
  }

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/10 p-3 text-left">
      <p className="text-sm font-semibold text-white">🍽️ Maak kans op een prijs</p>
      <p className="mt-0.5 text-xs text-white/70">
        Laat je e-mail achter en maak kans op een prijs bij een NDSM-restaurant.
      </p>
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
      <button
        type="button"
        disabled={!valid || busy}
        onClick={submit}
        className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition disabled:opacity-50"
      >
        {busy ? 'Versturen…' : 'Doe mee'}
      </button>
    </div>
  )
}
