import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * /admin/join — een uitgenodigde maakt z'n admin-account aan met e-mail + code
 * + wachtwoord. Het account wordt server-side aan `admins` toegevoegd via de
 * security-definer RPC `redeem_admin_invite` (client kan dit niet zelf).
 */
export function Join() {
  const params = new URLSearchParams(window.location.search)
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState(params.get('code') ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    try {
      // 1) Account aanmaken of inloggen om een sessie te krijgen.
      const up = await supabase.auth.signUp({ email, password })
      if (up.error && /already/i.test(up.error.message)) {
        const si = await supabase.auth.signInWithPassword({ email, password })
        if (si.error) throw si.error
      } else if (up.error) {
        throw up.error
      }

      // 2) Sessie nodig (e-mailbevestiging kan dit blokkeren).
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setMsg(
          'Account aangemaakt — bevestig eerst je e-mail via de link in je mail en open daarna deze uitnodigingslink opnieuw om het af te ronden.',
        )
        return
      }

      // 3) Invite inwisselen (server-side gevalideerd).
      const { error } = await supabase.rpc('redeem_admin_invite', {
        p_email: email,
        p_code: code,
      })
      if (error) throw error

      setDone(true)
      setMsg('Gelukt! Je bent nu admin. Je wordt doorgestuurd…')
      setTimeout(() => (window.location.href = '/admin'), 1200)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Er ging iets mis.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400'

  return (
    <div className="min-h-[100dvh] bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900">🛟 Word IJhop-admin</h1>
        <p className="mt-1 text-sm text-slate-500">Vul je e-mail, de uitnodigingscode en een wachtwoord in.</p>
        <div className="mt-4 flex flex-col gap-2">
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <input placeholder="Uitnodigingscode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${inputCls} tracking-[0.3em]`} />
          <input type="password" placeholder="Kies een wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <button type="button" disabled={busy || done || !email || !code || password.length < 6} onClick={submit} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Bezig…' : 'Account aanmaken & toetreden'}
          </button>
          {msg && <p className="text-xs text-amber-700">{msg}</p>}
          <a href="/admin" className="text-center text-xs text-slate-400 underline-offset-2 hover:underline">Terug naar inloggen</a>
        </div>
      </div>
    </div>
  )
}
