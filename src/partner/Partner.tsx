import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CODE_LENGTH, normalizeDealCode } from '../lib/dealCode'

/**
 * De pagina achter de kassa: /partner/<slug>.
 *
 * Eén ding tegelijk. Inloggen met vier cijfers (blijft op dit toestel staan),
 * daarna één veld en één knop. De medewerker heeft een rij voor zich, dus
 * alles is groot, de uitslag is groen of rood, en er is niets om weg te
 * klikken.
 *
 * Onderaan staat wat er vandaag en deze week is ingewisseld. Dat cijfer is
 * waarom de partner meedoet; het hoort groot en trots op het scherm.
 */

const PIN_KEY = (slug: string) => `ijhop:partner:${slug}`

interface Stats {
  ok: true
  partner: { name: string; slug: string; logo_url: string | null }
  today: number
  week: number
  deal: { offer: string; valid_to: string } | null
}

/** Een mislukte inlog is een gewone uitkomst, geen fout: de database geeft
 *  hem terug als json, zodat de pogingenteller blijft staan. */
interface Geweigerd {
  ok: false
  reason: 'pin' | 'locked'
  until?: string
}

const LOGIN_TEKST: Record<string, string> = {
  pin: 'Die pincode klopt niet.',
  locked: 'Te vaak geprobeerd. Probeer het over een kwartier opnieuw.',
}

type Uitslag =
  | { kind: 'ok'; offer: string; code: string }
  | { kind: 'used'; offer?: string; at?: string }
  | { kind: 'expired'; offer?: string }
  | { kind: 'unknown' }
  | { kind: 'error'; message: string }

export function Partner() {
  const slug = decodeURIComponent(window.location.pathname.replace(/\/+$/, '').split('/').pop() ?? '')
  const [pin, setPin] = useState(() => {
    try {
      return localStorage.getItem(PIN_KEY(slug)) ?? ''
    } catch {
      return ''
    }
  })
  const [pinInvoer, setPinInvoer] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loginFout, setLoginFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  // Code uit de QR van de bezoeker staat al in de URL.
  const [code, setCode] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('code')
    return q ? normalizeDealCode(q) : ''
  })
  const [uitslag, setUitslag] = useState<Uitslag | null>(null)

  const laadStats = useCallback(
    async (metPin: string) => {
      if (!supabase || !metPin) return false
      const { data, error } = await supabase.rpc('partner_stats', { p_slug: slug, p_pin: metPin })
      if (error || !data) {
        setLoginFout(error?.message ?? 'Inloggen lukte niet.')
        return false
      }
      const res = data as Stats | Geweigerd
      if (!res.ok) {
        setLoginFout(LOGIN_TEKST[res.reason] ?? 'Inloggen lukte niet.')
        setStats(null)
        return false
      }
      setStats(res)
      setLoginFout(null)
      return true
    },
    [slug],
  )

  useEffect(() => {
    if (pin) void laadStats(pin)
  }, [pin, laadStats])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setBezig(true)
    const ok = await laadStats(pinInvoer)
    setBezig(false)
    if (!ok) return
    setPin(pinInvoer)
    try {
      localStorage.setItem(PIN_KEY(slug), pinInvoer)
    } catch {
      /* onthouden lukt niet; inloggen werkt verder gewoon */
    }
  }

  const uitloggen = () => {
    try {
      localStorage.removeItem(PIN_KEY(slug))
    } catch {
      /* stil */
    }
    setPin('')
    setPinInvoer('')
    setStats(null)
  }

  const inwisselen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || bezig) return
    setBezig(true)
    setUitslag(null)
    try {
      const { data, error } = await supabase.rpc('partner_redeem', {
        p_slug: slug,
        p_pin: pin,
        p_code: normalizeDealCode(code),
      })
      if (error) {
        setUitslag({ kind: 'error', message: error.message })
      } else {
        const r = data as { ok: boolean; reason?: string; offer?: string; redeemed_at?: string; code?: string }
        if (r.ok) {
          setUitslag({ kind: 'ok', offer: r.offer ?? '', code: r.code ?? code })
          setCode('')
          void laadStats(pin)
        } else if (r.reason === 'pin' || r.reason === 'locked') {
          // Pincode ondertussen gewijzigd of het slot zit erop: terug naar het
          // inlogscherm in plaats van een rood vak zonder uitweg.
          setLoginFout(LOGIN_TEKST[r.reason])
          setStats(null)
        } else if (r.reason === 'used') {
          setUitslag({ kind: 'used', offer: r.offer, at: r.redeemed_at })
        } else if (r.reason === 'expired') {
          setUitslag({ kind: 'expired', offer: r.offer })
        } else {
          setUitslag({ kind: 'unknown' })
        }
      }
    } catch (err) {
      setUitslag({ kind: 'error', message: String(err) })
    }
    setBezig(false)
  }

  if (!supabase) {
    return <Kader><p className="text-slate-600">Supabase is niet geconfigureerd.</p></Kader>
  }

  // ---- Inloggen -------------------------------------------------------------
  if (!stats) {
    return (
      <Kader>
        <h1 className="text-xl font-bold text-slate-900">Pontdeals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Voer de pincode van deze zaak in. We onthouden hem op dit toestel.
        </p>
        <form onSubmit={login} className="mt-5 flex flex-col gap-3">
          <label htmlFor="pin" className="text-sm font-medium text-slate-700">
            Pincode
          </label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            value={pinInvoer}
            onChange={(e) => setPinInvoer(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            className="rounded-2xl border border-slate-200 px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] text-slate-900"
          />
          {loginFout && <p className="text-sm font-medium text-rose-600">{loginFout}</p>}
          <button
            type="submit"
            disabled={pinInvoer.length !== 4 || bezig}
            className="rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-40"
          >
            {bezig ? 'Even kijken…' : 'Inloggen'}
          </button>
        </form>
      </Kader>
    )
  }

  // ---- Inwisselen -----------------------------------------------------------
  return (
    <Kader>
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{stats.partner.name}</h1>
        <button type="button" onClick={uitloggen} className="text-sm text-slate-500 underline-offset-2 hover:underline">
          Uitloggen
        </button>
      </header>
      {stats.deal && <p className="mt-0.5 text-sm text-slate-500">{stats.deal.offer}</p>}

      <form onSubmit={inwisselen} className="mt-6 flex flex-col gap-3">
        <label htmlFor="code" className="text-sm font-medium text-slate-700">
          Code van de klant
        </label>
        <input
          id="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          // Geen maxLength: die kapt af vóór het opschonen, waardoor iemand
          // die "AB-37" typt blijft steken op "AB-3" en de knop grijs houdt.
          onChange={(e) => setCode(normalizeDealCode(e.target.value).slice(0, CODE_LENGTH))}
          className="rounded-2xl border border-slate-200 px-4 py-5 text-center font-mono text-4xl font-bold uppercase tracking-[0.3em] text-slate-900"
        />
        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH || bezig}
          className="rounded-2xl bg-emerald-700 px-4 py-5 text-lg font-semibold text-white disabled:opacity-40"
        >
          {bezig ? 'Even kijken…' : 'Inwisselen'}
        </button>
      </form>

      {uitslag && <Uitslagvak uitslag={uitslag} />}

      <div className="mt-8 grid grid-cols-2 gap-3" aria-live="polite">
        <Teller label="Vandaag" waarde={stats.today} />
        <Teller label="Deze week" waarde={stats.week} />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Ingewisselde Pontdeals. Klanten die anders langs waren gelopen.
      </p>
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        Scan de QR op het scherm van de klant met de camera van je telefoon;
        deze pagina opent dan met de code er al in.
      </p>
    </Kader>
  )
}

function Uitslagvak({ uitslag }: { uitslag: Uitslag }) {
  const basis = 'mt-5 rounded-2xl px-4 py-5 text-center'
  if (uitslag.kind === 'ok') {
    return (
      <div className={`${basis} bg-emerald-700 text-white`} role="status">
        <p className="text-3xl" aria-hidden="true">✓</p>
        <p className="mt-1 text-lg font-bold">Ingewisseld</p>
        <p className="text-sm text-white/90">{uitslag.offer}</p>
      </div>
    )
  }
  const tekst =
    uitslag.kind === 'used'
      ? uitslag.at
        ? `Deze code is al gebruikt op ${new Date(uitslag.at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
        : 'Deze code is al gebruikt.'
      : uitslag.kind === 'expired'
        ? 'Deze deal is verlopen.'
        : uitslag.kind === 'unknown'
          ? 'Deze code kennen we niet. Even samen naar het scherm van de klant kijken?'
          : uitslag.message
  return (
    <div className={`${basis} bg-rose-600 text-white`} role="status">
      <p className="text-3xl" aria-hidden="true">✗</p>
      <p className="mt-1 text-base font-semibold">{tekst}</p>
    </div>
  )
}

function Teller({ label, waarde }: { label: string; waarde: number }) {
  return (
    <div className="rounded-2xl bg-slate-100 px-4 py-5 text-center">
      <p className="text-4xl font-bold tabular-nums text-slate-900">{waarde}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-500">{label}</p>
    </div>
  )
}

function Kader({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-white">
      <div className="mx-auto w-full max-w-md px-5 py-8">{children}</div>
    </div>
  )
}
