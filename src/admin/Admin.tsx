import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Overview {
  users_total: number
  users_today: number
  users_7d: number
  sessions_total: number
  sessions_today: number
  events_total: number
  events_today: number
  avg_session_sec: number
  game_overs: number
  game_starts: number
  avg_score: number
  max_score: number
}
interface NameCount {
  name: string
  count: number
}
interface Daily {
  day: string
  users: number
  sessions: number
  events: number
}

function fmtDuration(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [byName, setByName] = useState<NameCount[]>([])
  const [daily, setDaily] = useState<Daily[]>([])
  const [loading, setLoading] = useState(false)

  // Login-form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function check() {
      if (!supabase) return
      if (!session) {
        setIsAdmin(null)
        setChecking(false)
        return
      }
      const { data } = await supabase.rpc('is_admin')
      setIsAdmin(data === true)
      setChecking(false)
    }
    check()
  }, [session])

  const loadMetrics = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const [ov, bn, dl] = await Promise.all([
      supabase.rpc('analytics_overview'),
      supabase.rpc('analytics_by_name', { days: 30 }),
      supabase.rpc('analytics_daily', { days: 30 }),
    ])
    if (ov.data) setOverview(ov.data as Overview)
    if (bn.data) setByName(bn.data as NameCount[])
    if (dl.data) setDaily(dl.data as Daily[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) loadMetrics()
  }, [isAdmin, loadMetrics])

  const signIn = async (mode: 'in' | 'up') => {
    if (!supabase) return
    setAuthBusy(true)
    setAuthMsg(null)
    const fn =
      mode === 'in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await fn
    if (error) setAuthMsg(error.message)
    else if (mode === 'up') setAuthMsg('Account aangemaakt. Check eventueel je e-mail om te bevestigen, en log daarna in.')
    setAuthBusy(false)
  }

  const signOut = () => supabase?.auth.signOut()

  // ---- States ----
  if (!supabase) {
    return <Shell><p className="text-slate-600">Supabase is niet geconfigureerd.</p></Shell>
  }

  if (checking) {
    return <Shell><p className="text-slate-500">Laden…</p></Shell>
  }

  // Niet ingelogd → login
  if (!session) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">IJhop Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Log in om het dashboard te zien.</p>
        <div className="mt-4 flex flex-col gap-2">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <input
            type="password"
            placeholder="Wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={authBusy}
              onClick={() => signIn('in')}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Inloggen
            </button>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => signIn('up')}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Account aanmaken
            </button>
          </div>
          {authMsg && <p className="text-xs text-amber-600">{authMsg}</p>}
        </div>
      </Shell>
    )
  }

  // Ingelogd maar geen admin → bootstrap
  if (isAdmin === false) {
    const uid = session.user.id
    const sql = `insert into public.admins(user_id) values ('${uid}');`
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">Bijna klaar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Je bent ingelogd als <strong>{session.user.email}</strong>, maar nog geen admin. Draai
          deze SQL eenmalig in de Supabase SQL-editor en herlaad:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
          {sql}
        </pre>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(sql)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Kopieer SQL
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Ik heb het gedraaid — herlaad
          </button>
          <button type="button" onClick={signOut} className="rounded-xl px-3 py-2 text-sm text-slate-500">
            Uitloggen
          </button>
        </div>
      </Shell>
    )
  }

  // Admin dashboard
  const maxEvents = Math.max(1, ...daily.map((d) => d.events))
  return (
    <Shell wide>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">IJhop Admin</h1>
          <p className="text-xs text-slate-400">{session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadMetrics}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            {loading ? 'Verversen…' : 'Verversen'}
          </button>
          <button type="button" onClick={signOut} className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Uitloggen
          </button>
        </div>
      </div>

      {overview && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="Gebruikers" value={overview.users_total} sub={`${overview.users_today} vandaag`} />
          <Card label="Actief 7 dgn" value={overview.users_7d} />
          <Card label="Sessies" value={overview.sessions_total} sub={`${overview.sessions_today} vandaag`} />
          <Card label="Gem. sessieduur" value={fmtDuration(overview.avg_session_sec)} />
          <Card label="Events" value={overview.events_total} sub={`${overview.events_today} vandaag`} />
          <Card label="Spellen gespeeld" value={overview.game_overs} sub={`${overview.game_starts} gestart`} />
          <Card label="Gem. score" value={overview.avg_score} />
          <Card label="Hoogste score" value={overview.max_score} />
        </div>
      )}

      {/* Events per dag */}
      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-700">Events per dag (30 dgn)</p>
        <div className="mt-3 flex h-32 items-end gap-1">
          {daily.length === 0 && <p className="text-xs text-slate-400">Nog geen data.</p>}
          {daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.events} events, ${d.users} users`}>
              <div
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${(d.events / maxEvents) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {daily.length > 0 && (
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>{daily[0]?.day}</span>
            <span>{daily[daily.length - 1]?.day}</span>
          </div>
        )}
      </div>

      {/* Events op naam = welke knoppen/features */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-slate-700">Gebruik per actie (30 dgn)</p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {byName.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-700">{r.name}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{r.count}</td>
              </tr>
            ))}
            {byName.length === 0 && (
              <tr>
                <td className="py-2 text-xs text-slate-400">Nog geen data.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-8">
      <div className={`mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-sm'}`}>{children}</div>
    </div>
  )
}
