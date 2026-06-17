import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// ---- Types -----------------------------------------------------------------
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
interface Funnel {
  sessions: number
  snack: number
  started: number
  finished: number
}
interface RecentEvent {
  name: string
  props: Record<string, unknown> | null
  path: string | null
  created_at: string
}

// ---- Helpers ---------------------------------------------------------------
const EVENT_META: Record<string, { emoji: string; label: string }> = {
  session_start: { emoji: '🚀', label: 'Sessie gestart' },
  tab_view: { emoji: '🧭', label: 'Tab bekeken' },
  snack_open: { emoji: '🎮', label: 'Arcade geopend' },
  ferry_pick: { emoji: '⛴️', label: 'Pont gekozen' },
  game_start: { emoji: '▶️', label: 'Spel gestart' },
  game_over: { emoji: '💦', label: 'Game over' },
  character_select: { emoji: '🧑', label: 'Poppetje gekozen' },
  character_buy: { emoji: '🧇', label: 'Poppetje gekocht' },
  heartbeat: { emoji: '💓', label: 'Actief' },
  app_visible: { emoji: '👀', label: 'App actief' },
  app_hidden: { emoji: '🌙', label: 'App naar achtergrond' },
}
const meta = (n: string) => EVENT_META[n] ?? { emoji: '•', label: n }
const DOW = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

function fmtDuration(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`
}
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}
function propSummary(p: Record<string, unknown> | null): string {
  if (!p) return ''
  if ('score' in p) return `score ${p.score}`
  if ('view' in p) return String(p.view)
  if ('key' in p) return String(p.key)
  if ('id' in p) return String(p.id)
  if ('game' in p) return String(p.game)
  return ''
}

// ---- UI bouwstenen ---------------------------------------------------------
const ACCENTS: Record<string, string> = {
  emerald: 'from-emerald-500 to-teal-500',
  sky: 'from-sky-500 to-blue-500',
  violet: 'from-violet-500 to-fuchsia-500',
  amber: 'from-amber-500 to-orange-500',
  rose: 'from-rose-500 to-pink-500',
  slate: 'from-slate-600 to-slate-700',
}
function Stat({
  emoji,
  label,
  value,
  sub,
  accent = 'emerald',
}: {
  emoji: string
  label: string
  value: ReactNode
  sub?: string
  accent?: keyof typeof ACCENTS | string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className={`absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${ACCENTS[accent] ?? ACCENTS.emerald} opacity-15`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="mr-1">{emoji}</span>
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
function Panel({ title, emoji, children }: { title: string; emoji: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="mb-3 text-sm font-bold text-slate-700">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </p>
      {children}
    </div>
  )
}
function BarList({ rows, color = 'bg-emerald-500', empty = 'Nog geen data.' }: { rows: { label: string; value: number }[]; color?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="text-xs text-slate-400">{empty}</p>
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate text-slate-600">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-slate-800">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
function Columns({ data, color = 'bg-emerald-500', labelEvery = 1 }: { data: { label: string; value: number; title?: string }[]; color?: string; labelEvery?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={d.title ?? `${d.label}: ${d.value}`}>
            <div className={`w-full rounded-t ${color}`} style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[9px] text-slate-400">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">{i % labelEvery === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

// ---- Hoofdcomponent ---------------------------------------------------------
export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [days, setDays] = useState(30)
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [live, setLive] = useState(0)
  const [byName, setByName] = useState<NameCount[]>([])
  const [daily, setDaily] = useState<Daily[]>([])
  const [hourly, setHourly] = useState<number[]>(Array(24).fill(0))
  const [dow, setDow] = useState<number[]>(Array(7).fill(0))
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [recent, setRecent] = useState<RecentEvent[]>([])
  const [tabs, setTabs] = useState<NameCount[]>([])
  const [ferries, setFerries] = useState<{ label: string; value: number }[]>([])
  const [chars, setChars] = useState<{ label: string; value: number }[]>([])
  const [devices, setDevices] = useState<{ label: string; value: number }[]>([])

  // Login
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

  const loadAll = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const num = (v: unknown) => (typeof v === 'number' ? v : 0)
    const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
    const [ov, lv, bn, dl, hr, dw, fn, rc, tb, fr, ch, dv] = await Promise.all([
      supabase.rpc('analytics_overview'),
      supabase.rpc('analytics_live'),
      supabase.rpc('analytics_by_name', { days }),
      supabase.rpc('analytics_daily', { days }),
      supabase.rpc('analytics_hourly', { days }),
      supabase.rpc('analytics_dow', { days }),
      supabase.rpc('analytics_funnel', { days }),
      supabase.rpc('analytics_recent', { lim: 40 }),
      supabase.rpc('analytics_prop', { p_name: 'tab_view', p_key: 'view', days }),
      supabase.rpc('analytics_prop', { p_name: 'ferry_pick', p_key: 'key', days }),
      supabase.rpc('analytics_prop', { p_name: 'character_select', p_key: 'id', days }),
      supabase.rpc('analytics_prop', { p_name: 'session_start', p_key: 'standalone', days }),
    ])
    if (ov.data) setOverview(ov.data as Overview)
    setLive(num(lv.data))
    setByName(list<NameCount>(bn.data))
    setDaily(list<Daily>(dl.data))
    const h = Array(24).fill(0)
    list<{ hour: number; count: number }>(hr.data).forEach((r) => (h[r.hour] = r.count))
    setHourly(h)
    const d = Array(7).fill(0)
    list<{ dow: number; count: number }>(dw.data).forEach((r) => (d[r.dow - 1] = r.count))
    setDow(d)
    if (fn.data) setFunnel(fn.data as Funnel)
    setRecent(list<RecentEvent>(rc.data))
    setTabs(list<NameCount>(tb.data))
    setFerries(list<{ value: string; count: number }>(fr.data).map((r) => ({ label: r.value, value: r.count })))
    setChars(list<{ value: string; count: number }>(ch.data).map((r) => ({ label: r.value, value: r.count })))
    setDevices(
      list<{ value: string; count: number }>(dv.data).map((r) => ({
        label: r.value === 'true' ? 'PWA (geïnstalleerd)' : r.value === 'false' ? 'Browser' : r.value,
        value: r.count,
      })),
    )
    setLoading(false)
  }, [days])

  useEffect(() => {
    if (isAdmin) loadAll()
  }, [isAdmin, loadAll])

  useEffect(() => {
    if (!isAdmin || !auto) return
    const t = setInterval(loadAll, 20_000)
    return () => clearInterval(t)
  }, [isAdmin, auto, loadAll])

  const signIn = async (mode: 'in' | 'up') => {
    if (!supabase) return
    setAuthBusy(true)
    setAuthMsg(null)
    const { error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setAuthMsg(error.message)
    else if (mode === 'up') setAuthMsg('Account aangemaakt. Bevestig eventueel je e-mail en log daarna in.')
    setAuthBusy(false)
  }
  const signOut = () => supabase?.auth.signOut()

  // ---- Render states ----
  if (!supabase) return <Shell><p className="text-slate-600">Supabase is niet geconfigureerd.</p></Shell>
  if (checking) return <Shell><p className="text-slate-500">Laden…</p></Shell>

  if (!session) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">🛟 IJhop Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Log in om het dashboard te zien.</p>
        <div className="mt-4 flex flex-col gap-2">
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          <input type="password" placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          <div className="flex gap-2">
            <button type="button" disabled={authBusy} onClick={() => signIn('in')} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Inloggen</button>
            <button type="button" disabled={authBusy} onClick={() => signIn('up')} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Account aanmaken</button>
          </div>
          {authMsg && <p className="text-xs text-amber-600">{authMsg}</p>}
        </div>
      </Shell>
    )
  }

  if (isAdmin === false) {
    const uid = session.user.id
    const sql = `insert into public.admins(user_id) values ('${uid}');`
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">Bijna klaar</h1>
        <p className="mt-1 text-sm text-slate-600">Ingelogd als <strong>{session.user.email}</strong>, maar nog geen admin. Draai deze SQL eenmalig en herlaad:</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{sql}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => navigator.clipboard?.writeText(sql)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Kopieer SQL</button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Ik heb het gedraaid — herlaad</button>
          <button type="button" onClick={signOut} className="rounded-xl px-3 py-2 text-sm text-slate-500">Uitloggen</button>
        </div>
      </Shell>
    )
  }

  // ---- Dashboard ----
  const fin = funnel
  const steps = fin
    ? [
        { label: 'Bezoeken', value: fin.sessions, emoji: '👋' },
        { label: 'Arcade open', value: fin.snack, emoji: '🎮' },
        { label: 'Spel gestart', value: fin.started, emoji: '▶️' },
        { label: 'Game over', value: fin.finished, emoji: '💦' },
      ]
    : []
  const funnelMax = Math.max(1, ...steps.map((s) => s.value))

  return (
    <Shell wide>
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">🛟 IJhop Admin</h1>
            <p className="text-sm text-white/80">{session.user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
              </span>
              {live} live
            </span>
            <div className="flex overflow-hidden rounded-full bg-white/15 text-xs font-semibold">
              {[1, 7, 30].map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`px-3 py-1.5 ${days === d ? 'bg-white text-emerald-700' : 'text-white'}`}>
                  {d === 1 ? 'Vandaag' : `${d}d`}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAuto((a) => !a)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${auto ? 'bg-white text-emerald-700' : 'bg-white/15 text-white'}`}>{auto ? '⏱ Auto aan' : '⏱ Auto uit'}</button>
            <button type="button" onClick={loadAll} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">{loading ? 'Verversen…' : 'Verversen'}</button>
            <button type="button" onClick={signOut} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">Uitloggen</button>
          </div>
        </div>
      </div>

      {overview && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat emoji="👥" label="Gebruikers" value={overview.users_total} sub={`${overview.users_today} vandaag`} accent="emerald" />
          <Stat emoji="🔥" label="Actief 7 dgn" value={overview.users_7d} accent="amber" />
          <Stat emoji="🎫" label="Sessies" value={overview.sessions_total} sub={`${overview.sessions_today} vandaag`} accent="sky" />
          <Stat emoji="⏱" label="Gem. sessieduur" value={fmtDuration(overview.avg_session_sec)} accent="violet" />
          <Stat emoji="✨" label="Events" value={overview.events_total} sub={`${overview.events_today} vandaag`} accent="slate" />
          <Stat emoji="🎮" label="Spellen gespeeld" value={overview.game_overs} sub={`${overview.game_starts} gestart`} accent="rose" />
          <Stat emoji="🎯" label="Gem. score" value={overview.avg_score} accent="emerald" />
          <Stat emoji="🏆" label="Hoogste score" value={overview.max_score} accent="amber" />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`Activiteit per dag (${days}d)`} emoji="📈">
          <Columns data={daily.map((d) => ({ label: d.day.slice(5), value: d.events, title: `${d.day}: ${d.events} events · ${d.users} users` }))} labelEvery={Math.ceil(Math.max(1, daily.length) / 6)} />
        </Panel>
        <Panel title="Wanneer zijn ze actief? (per uur)" emoji="🕑">
          <Columns data={hourly.map((v, i) => ({ label: String(i), value: v, title: `${i}:00 — ${v} events` }))} color="bg-sky-500" labelEvery={3} />
        </Panel>
        <Panel title="Per weekdag" emoji="🗓️">
          <Columns data={dow.map((v, i) => ({ label: DOW[i], value: v }))} color="bg-violet-500" />
        </Panel>
        <Panel title={`Funnel (${days}d)`} emoji="🫳">
          <div className="flex flex-col gap-2">
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 text-slate-600">{s.emoji} {s.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 pr-2 text-[10px] font-bold text-white" style={{ width: `${(s.value / funnelMax) * 100}%` }}>
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
            {steps.length === 0 && <p className="text-xs text-slate-400">Nog geen data.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Welke tab" emoji="🧭"><BarList rows={tabs.map((t) => ({ label: t.name === 'arcade' ? 'Spelletjes' : t.name === 'ferries' ? 'Ponten' : t.name, value: t.count }))} color="bg-sky-500" /></Panel>
        <Panel title="Welk apparaat" emoji="📱"><BarList rows={devices} color="bg-violet-500" /></Panel>
        <Panel title="Gekozen pont" emoji="⛴️"><BarList rows={ferries} color="bg-emerald-500" /></Panel>
        <Panel title="Gekozen poppetje" emoji="🧑"><BarList rows={chars} color="bg-amber-500" /></Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`Gebruik per actie (${days}d)`} emoji="✨">
          <BarList rows={byName.map((r) => ({ label: meta(r.name).label, value: r.count }))} />
        </Panel>
        <Panel title="Live activiteit" emoji="📡">
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {recent.length === 0 && <p className="text-xs text-slate-400">Nog geen data.</p>}
            {recent.map((e, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm odd:bg-slate-50">
                <span>{meta(e.name).emoji}</span>
                <span className="flex-1 truncate text-slate-700">
                  {meta(e.name).label}
                  {propSummary(e.props) && <span className="text-slate-400"> · {propSummary(e.props)}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">{ago(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">Anonieme, privacy-vriendelijke statistieken · ververst automatisch</p>
    </Shell>
  )
}

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-slate-100 px-4 py-6">
      <div className={`mx-auto w-full ${wide ? 'max-w-4xl' : 'max-w-sm pt-10'}`}>{children}</div>
    </div>
  )
}
