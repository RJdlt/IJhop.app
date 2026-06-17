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
interface AdminRow {
  user_id: string
  email: string | null
  created_at: string
}
interface InviteRow {
  id: string
  email: string
  status: string
  expires_at: string
  used_at: string | null
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

  // Toegangsbeheer
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [newInvite, setNewInvite] = useState<{ email: string } | null>(null)
  const [mgmtMsg, setMgmtMsg] = useState<string | null>(null)

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'link' | 'password'>('link')
  const [linkSent, setLinkSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)

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
      let ok = data === true
      if (!ok) {
        // Uitgenodigd e-mailadres? Dan automatisch toegang verlenen.
        const claim = await supabase.rpc('claim_admin_access')
        ok = claim.data === true
      }
      setIsAdmin(ok)
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
    const [ad, iv] = await Promise.all([
      supabase.rpc('admin_list_admins'),
      supabase.rpc('admin_list_invites'),
    ])
    setAdmins(list<AdminRow>(ad.data))
    setInvites(list<InviteRow>(iv.data))
    setLoading(false)
  }, [days])

  const createInvite = async () => {
    if (!supabase || !inviteEmail) return
    setMgmtMsg(null)
    const { data, error } = await supabase.rpc('create_admin_invite', { p_email: inviteEmail })
    if (error) {
      setMgmtMsg(error.message)
      return
    }
    const d = data as { email: string }
    setNewInvite({ email: d.email })
    setInviteEmail('')
    loadAll()
  }
  const revokeInvite = async (id: string) => {
    if (!supabase) return
    await supabase.rpc('revoke_admin_invite', { p_id: id })
    loadAll()
  }
  const removeAdmin = async (uid: string) => {
    if (!supabase) return
    setMgmtMsg(null)
    const { error } = await supabase.rpc('remove_admin', { p_user_id: uid })
    if (error) setMgmtMsg(error.message)
    loadAll()
  }

  useEffect(() => {
    if (isAdmin) loadAll()
  }, [isAdmin, loadAll])

  useEffect(() => {
    if (!isAdmin || !auto) return
    const t = setInterval(loadAll, 20_000)
    return () => clearInterval(t)
  }, [isAdmin, auto, loadAll])

  const sendLink = async () => {
    if (!supabase || !email) return
    setAuthBusy(true)
    setAuthMsg(null)
    // Alleen toegestane adressen (admin of openstaande uitnodiging) krijgen een link.
    const { data: allowed } = await supabase.rpc('email_allowed_for_admin', { p_email: email })
    if (allowed !== true) {
      setAuthMsg('Dit e-mailadres heeft geen toegang tot het dashboard.')
      setAuthBusy(false)
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/admin` },
    })
    if (error) setAuthMsg(error.message)
    else {
      setLinkSent(true)
      setAuthMsg(`We hebben een inloglink naar ${email} gestuurd. Open je mail en klik de link.`)
    }
    setAuthBusy(false)
  }
  const signInPw = async () => {
    if (!supabase) return
    setAuthBusy(true)
    setAuthMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMsg(error.message)
    setAuthBusy(false)
  }
  const savePassword = async () => {
    if (!supabase || newPassword.length < 6) return
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : 'Wachtwoord opgeslagen — je kunt nu ook met wachtwoord inloggen.')
    if (!error) setNewPassword('')
  }
  const signOut = () => supabase?.auth.signOut()

  // ---- Render states ----
  if (!supabase) return <Shell><p className="text-slate-600">Supabase is niet geconfigureerd.</p></Shell>
  if (checking) return <Shell><p className="text-slate-500">Laden…</p></Shell>

  if (!session) {
    const inputCls =
      'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400'
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-xl font-bold text-slate-900">🛟 IJhop Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Log in om het dashboard te zien.</p>

          <div className="mt-4 flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
            {(['link', 'password'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setAuthMode(m)
                  setAuthMsg(null)
                  setLinkSent(false)
                }}
                className={`flex-1 rounded-full px-3 py-1.5 ${authMode === m ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                {m === 'link' ? '✉️ Inloglink' : '🔑 Wachtwoord'}
              </button>
            ))}
          </div>

          {authMode === 'link' ? (
            <div className="mt-4 flex flex-col gap-2">
              <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <button type="button" disabled={authBusy || !email || linkSent} onClick={sendLink} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {authBusy ? 'Versturen…' : linkSent ? '✓ Link verstuurd' : 'Stuur inloglink'}
              </button>
              {linkSent && (
                <button type="button" onClick={() => { setLinkSent(false); setAuthMsg(null) }} className="text-xs text-slate-400 underline-offset-2 hover:underline">
                  Opnieuw versturen / ander e-mailadres
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <button type="button" disabled={authBusy} onClick={signInPw} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Inloggen</button>
              <p className="text-[11px] text-slate-400">Nog geen wachtwoord? Log eerst in met de inloglink en stel daarna een wachtwoord in.</p>
            </div>
          )}
          {authMsg && <p className="mt-2 text-xs text-amber-600">{authMsg}</p>}
        </div>
      </Shell>
    )
  }

  if (isAdmin === false) {
    const uid = session.user.id
    const sql = `insert into public.admins(user_id) values ('${uid}');`
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Nog geen toegang</h1>
          <p className="mt-1 text-sm text-slate-600">
            Je bent ingelogd als <strong>{session.user.email}</strong>, maar dit adres is nog niet
            uitgenodigd. Vraag een beheerder je uit te nodigen — daarna ben je bij de volgende keer
            inloggen automatisch admin.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Opnieuw proberen</button>
            <button type="button" onClick={signOut} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Uitloggen</button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-slate-400">Eerste admin van een nieuw project?</summary>
            <p className="mt-2 text-xs text-slate-500">Draai eenmalig in de Supabase SQL-editor en herlaad:</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">{sql}</pre>
          </details>
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

      <div className="mt-4">
        <Panel title="Toegang & uitnodigingen" emoji="🔑">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              placeholder="e-mail van nieuwe admin"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400"
            />
            <button type="button" disabled={!inviteEmail} onClick={createInvite} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              ✉️ Nodig uit
            </button>
          </div>
          {mgmtMsg && <p className="mt-2 text-xs text-rose-600">{mgmtMsg}</p>}
          {newInvite && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-100">
              <p className="text-slate-700">
                Uitnodiging klaar voor <strong>{newInvite.email}</strong> (7 dagen geldig).
              </p>
              <p className="mt-1 text-slate-600">
                Laat ze naar <strong>{window.location.host}/admin</strong> gaan en inloggen met dit
                e-mailadres (ze krijgen een inloglink in hun mail). Daarna zijn ze automatisch admin.
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Uitnodigingen</p>
              <div className="flex flex-col gap-1">
                {invites.length === 0 && <p className="text-xs text-slate-400">Nog geen uitnodigingen.</p>}
                {invites.map((iv) => (
                  <div key={iv.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                    <span className="flex-1 truncate text-slate-700">{iv.email}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${iv.status === 'open' ? 'bg-emerald-100 text-emerald-700' : iv.status === 'gebruikt' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{iv.status}</span>
                    {iv.status === 'open' && (
                      <button type="button" onClick={() => revokeInvite(iv.id)} className="text-xs font-semibold text-rose-600">Intrekken</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Admins</p>
              <div className="flex flex-col gap-1">
                {admins.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                    <span className="flex-1 truncate text-slate-700">{a.email ?? a.user_id.slice(0, 8)}</span>
                    {a.user_id === session.user.id ? (
                      <span className="text-[10px] font-bold text-emerald-600">jij</span>
                    ) : (
                      <button type="button" onClick={() => removeAdmin(a.user_id)} className="text-xs font-semibold text-rose-600">Verwijderen</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Jouw wachtwoord</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                placeholder="nieuw wachtwoord (min. 6 tekens)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400"
              />
              <button type="button" disabled={newPassword.length < 6} onClick={savePassword} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                Opslaan
              </button>
            </div>
            {pwMsg && <p className="mt-1 text-xs text-slate-500">{pwMsg}</p>}
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
