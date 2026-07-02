import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// ---- Types -----------------------------------------------------------------
// Eén dashboard-RPC (migratie 0012) levert alles: consistent Europe/Amsterdam,
// test-events uitgesloten, dagen zonder events als echte nullen.
interface Daily { day: string; users: number; sessions: number; events: number }
interface PropRow { value: string; users: number; events: number }
interface Dash {
  quality: {
    last_event_at: string | null
    last_real_event_at: string | null
    events_today: number
    test_events: number
    total_events: number
    own_included: boolean
  }
  life: {
    users_today: number
    users_7d: number
    users_30d: number
    users_total: number
    sessions_today: number
    sessions_7d: number
    sessions_per_user_7d: number | null
    active_5m: number
    median_session_sec: number
    n_dur_sessions: number
  }
  window: { days: number; events: number; users: number; sessions: number }
  daily: Daily[]
  funnel: { sessions: number; arcade: number; started: number; finished: number }
  hourly: number[]
  dow: number[]
  tabs: PropRow[]
  ferries: PropRow[]
  characters: PropRow[]
  devices: PropRow[]
}
interface RecentEvent { name: string; props: Record<string, unknown> | null; path: string | null; created_at: string }
interface AdminRow { user_id: string; email: string | null; created_at: string }
interface InviteRow { id: string; email: string; status: string; expires_at: string; used_at: string | null; created_at: string }
interface EntryRow { id: string; game_id: string; score: number; name: string | null; email: string; created_at: string }
type Bar = { label: string; value: number; title?: string }

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
  ontmoeting_join: { emoji: '🤝', label: 'Ontmoeting: meedoen' },
  ontmoeting_matched: { emoji: '✨', label: 'Ontmoeting: gematcht' },
  ontmoeting_found: { emoji: '🙌', label: 'Ontmoeting: gevonden' },
  heartbeat: { emoji: '💓', label: 'Actief' },
  app_visible: { emoji: '👀', label: 'App actief' },
  app_hidden: { emoji: '🌙', label: 'App naar achtergrond' },
}
const meta = (n: string) => EVENT_META[n] ?? { emoji: '•', label: n }
const DOW = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const nf = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('nl-NL')

function fmtDuration(sec: number): string {
  const s = Math.round(sec || 0)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`
}
function ago(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}
function clock(d: Date | null): string {
  return d ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'nooit'
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
const deviceLabel = (v: string) =>
  v === 'true' ? 'PWA (geïnstalleerd)' : v === 'false' ? 'Browser' : v

// ---- UI bouwstenen ---------------------------------------------------------
const ACCENTS: Record<string, string> = {
  brand: 'from-brand to-teal-500',
  sky: 'from-sky-500 to-blue-500',
  violet: 'from-violet-500 to-fuchsia-500',
  amber: 'from-amber-500 to-orange-500',
  rose: 'from-rose-500 to-pink-500',
  slate: 'from-slate-600 to-slate-700',
}
function Stat({ emoji, label, value, sub, accent = 'brand' }: { emoji: string; label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className={`absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${ACCENTS[accent] ?? ACCENTS.brand} opacity-15`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400"><span className="mr-1">{emoji}</span>{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
function Panel({ title, emoji, sub, children }: { title: string; emoji: string; sub?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-slate-700"><span className="mr-1.5">{emoji}</span>{title}</p>
        {sub && <p className="shrink-0 text-[11px] text-slate-400">{sub}</p>}
      </div>
      {children}
    </div>
  )
}
function Empty({ text = 'Nog geen data. Dit vult zich zodra mensen de app gebruiken.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
      <span className="text-2xl">📭</span>
      <p className="text-xs text-slate-400">{text}</p>
    </div>
  )
}
/** Drempel-poort: onder de minimale steekproef geen lege doos maar een
 *  compacte voortgangsregel, zodat je groei ziet in plaats van leegte. */
function Gate({ n, min, unit, children }: { n: number; min: number; unit: string; children: ReactNode }) {
  if (n < min) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <span aria-hidden>⏳</span>
        <p className="text-xs text-slate-500">Nog te weinig data ({nf(n)}/{nf(min)} {unit}).</p>
        <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((n / min) * 100))}%` }} />
        </div>
      </div>
    )
  }
  return <>{children}</>
}
function BarList({ rows, color = 'bg-brand' }: { rows: Bar[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <Empty />
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm" title={r.title}>
          <span className="w-28 shrink-0 truncate text-slate-600">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-slate-800">{nf(r.value)}</span>
        </div>
      ))}
    </div>
  )
}
/** Kolomgrafiek met pixel-hoogtes (procent-hoogtes in geneste flex breken in
 *  Safari) en een expliciete max-as, zodat "vol" nooit meer "veel" suggereert. */
const CHART_H = 104
function Columns({ data, color = 'bg-brand', labelEvery = 1 }: { data: { label: string; value: number; title?: string }[]; color?: string; labelEvery?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <Empty />
  return (
    <div>
      <p className="mb-1 text-right text-[10px] tabular-nums text-slate-400">max {nf(max)}</p>
      <div className="flex items-end gap-[3px]" style={{ height: CHART_H }}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 items-end" title={d.title ?? `${d.label}: ${nf(d.value)}`}>
            <div
              className={`w-full rounded-t ${d.value > 0 ? color : 'bg-slate-200'}`}
              style={{ height: d.value > 0 ? Math.max(3, Math.round((d.value / max) * CHART_H)) : 1 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[9px] text-slate-400">
        {data.map((d, i) => <span key={i} className="flex-1 text-center">{i % labelEvery === 0 ? d.label : ''}</span>)}
      </div>
    </div>
  )
}
function SkeletonBody() {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />)}
      </div>
    </>
  )
}

// ---- Demo-data (client-side, NIET naar de database) ------------------------
function makeDemo(days: number): { dash: Dash; recent: RecentEvent[]; entries: EntryRow[] } {
  const rnd = (a: number, b: number) => Math.floor(a + Math.random() * (b - a))
  const today = new Date()
  const daily: Daily[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    const isWeekend = ((d.getDay() + 6) % 7) >= 5
    const growth = 1 + (i / Math.max(1, days - 1)) * 1.8
    const noise = 0.82 + Math.random() * 0.36
    const users = Math.max(1, Math.round(14 * growth * (isWeekend ? 1.35 : 1) * noise))
    const sessions = Math.round(users * (1.1 + Math.random() * 0.4))
    const events = sessions * rnd(6, 11)
    return { day: d.toISOString().slice(0, 10), users, sessions, events }
  })
  const hourly = Array.from({ length: 24 }, (_, h) =>
    (h >= 7 && h <= 9) || (h >= 16 && h <= 18) ? rnd(60, 140) : h >= 1 && h <= 5 ? rnd(0, 6) : rnd(10, 50),
  )
  const dow = [120, 116, 122, 128, 150, 188, 162].map((v) => v + rnd(-14, 14))
  const dash: Dash = {
    quality: {
      last_event_at: new Date(Date.now() - 40_000).toISOString(),
      last_real_event_at: new Date(Date.now() - 40_000).toISOString(),
      events_today: 430, test_events: 0, total_events: 18450, own_included: false,
    },
    life: {
      users_today: 38, users_7d: 210, users_30d: 640, users_total: 1240,
      sessions_today: 52, sessions_7d: 290, sessions_per_user_7d: 1.38,
      active_5m: 6, median_session_sec: 96, n_dur_sessions: 240,
    },
    window: { days, events: 18450, users: 640, sessions: 900 },
    daily,
    funnel: { sessions: 900, arcade: 520, started: 410, finished: 330 },
    hourly, dow,
    tabs: [
      { value: 'ferries', users: 520, events: 1400 },
      { value: 'arcade', users: 310, events: 700 },
    ],
    ferries: [
      { value: 'F4:ndsm:centraal', users: 180, events: 340 },
      { value: 'F7:ndsm:pontsteiger', users: 150, events: 280 },
      { value: 'F4:centraal:ndsm', users: 110, events: 190 },
      { value: 'F7:pontsteiger:ndsm', users: 60, events: 90 },
    ],
    characters: [
      { value: 'pim', users: 200, events: 300 },
      { value: 'toerist', users: 80, events: 120 },
      { value: 'wielrenner', users: 45, events: 70 },
      { value: 'koning', users: 16, events: 25 },
      { value: 'pontkat', users: 6, events: 8 },
    ],
    devices: [
      { value: 'false', users: 420, events: 760 },
      { value: 'true', users: 260, events: 480 },
    ],
  }
  const rn = ['game_over', 'ferry_pick', 'tab_view', 'snack_open', 'game_start', 'character_select', 'session_start', 'heartbeat']
  const recent: RecentEvent[] = Array.from({ length: 14 }, (_, i) => {
    const n = rn[rnd(0, rn.length)]
    const props =
      n === 'game_over' ? { score: rnd(5, 130) } :
      n === 'tab_view' ? { view: Math.random() < 0.6 ? 'ferries' : 'arcade' } :
      n === 'ferry_pick' ? { key: 'F7:ndsm:pontsteiger' } :
      n === 'character_select' ? { id: 'toerist' } : null
    return { name: n, props, path: '/', created_at: new Date(Date.now() - i * rnd(20, 300) * 1000).toISOString() }
  })
  const dn = ['Sven', 'Lisa', 'Pim', 'Noa', 'Daan', 'Eva', 'Tim', 'Fleur']
  const entries: EntryRow[] = Array.from({ length: 8 }, (_, i) => ({
    id: String(i), game_id: 'ponthop', score: rnd(20, 130), name: dn[i], email: `speler${i}@voorbeeld.nl`,
    created_at: new Date(Date.now() - i * 3_600_000 * rnd(1, 40)).toISOString(),
  }))
  return { dash, recent, entries }
}

// ---- Hoofdcomponent ---------------------------------------------------------
export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [days, setDays] = useState(30)
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)
  const [firstLoaded, setFirstLoaded] = useState(false)
  const [demo, setDemo] = useState(false)
  // Eigen (admin-)activiteit telt standaard NIET mee in de cijfers.
  const [includeOwn, setIncludeOwn] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const [dash, setDash] = useState<Dash | null>(null)
  const [dashErr, setDashErr] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentEvent[]>([])

  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [newInvite, setNewInvite] = useState<{ email: string } | null>(null)
  const [mgmtMsg, setMgmtMsg] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'link' | 'password'>('link')
  const [linkSent, setLinkSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function check() {
      if (!supabase) return
      if (!session) { setIsAdmin(null); setChecking(false); return }
      const { data } = await supabase.rpc('is_admin')
      let ok = data === true
      if (!ok) {
        const claim = await supabase.rpc('claim_admin_access')
        ok = claim.data === true
      }
      setIsAdmin(ok)
      setChecking(false)
    }
    check()
  }, [session])

  const loadAll = useCallback(async () => {
    if (demo) {
      const d = makeDemo(days)
      setDash(d.dash); setRecent(d.recent); setEntries(d.entries)
      setDashErr(null); setLastUpdated(new Date()); setFirstLoaded(true)
      return
    }
    if (!supabase) return
    setLoading(true)
    const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
    const [db, rc, ad, iv, he] = await Promise.all([
      supabase.rpc('analytics_dashboard', { p_days: days, p_include_own: includeOwn }),
      supabase.rpc('analytics_recent', { lim: 40 }),
      supabase.rpc('admin_list_admins'),
      supabase.rpc('admin_list_invites'),
      supabase.rpc('admin_list_highscore_entries'),
    ])
    // Fouten zijn zichtbaar, nooit stilletjes een leeg dashboard.
    if (db.error) {
      setDashErr(db.error.message)
    } else if (db.data) {
      setDash(db.data as Dash)
      setDashErr(null)
    }
    setRecent(list<RecentEvent>(rc.data))
    setAdmins(list<AdminRow>(ad.data))
    setInvites(list<InviteRow>(iv.data))
    setEntries(list<EntryRow>(he.data))
    setLastUpdated(new Date()); setFirstLoaded(true); setLoading(false)
  }, [days, demo, includeOwn])

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin, loadAll])
  useEffect(() => {
    if (!isAdmin || !auto || demo) return
    const t = setInterval(loadAll, 20_000)
    return () => clearInterval(t)
  }, [isAdmin, auto, demo, loadAll])

  // ---- Test-events (echte inserts, gelabeld; tellen nooit mee in de cijfers) ----
  const genTestEvents = async () => {
    if (!supabase || !session) return
    setTestMsg('Bezig…')
    const uid = session.user.id
    const names = ['session_start', 'tab_view', 'snack_open', 'ferry_pick', 'game_start', 'game_over', 'character_select', 'heartbeat', 'app_visible']
    const rnd = (a: number, b: number) => Math.floor(a + Math.random() * (b - a))
    const rows = Array.from({ length: 60 }, (_, i) => {
      const name = names[rnd(0, names.length)]
      const daysAgo = i < 10 ? 0 : rnd(0, 30)
      const created = new Date(Date.now() - daysAgo * 86_400_000 - rnd(0, 86_400_000))
      const props =
        name === 'game_over' ? { score: rnd(0, 130), test: true } :
        name === 'tab_view' ? { view: Math.random() < 0.6 ? 'ferries' : 'arcade', test: true } :
        name === 'ferry_pick' ? { key: ['F4:ndsm:centraal', 'F7:ndsm:pontsteiger'][rnd(0, 2)], test: true } :
        name === 'character_select' ? { id: ['pim', 'toerist', 'wielrenner'][rnd(0, 3)], test: true } :
        name === 'session_start' ? { standalone: Math.random() < 0.4, test: true } : { test: true }
      return { user_id: uid, session_id: `test-${i % 8}-${rnd(0, 9999)}`, name, props, path: '/test', created_at: created.toISOString() }
    })
    const { error } = await supabase.from('analytics_events').insert(rows)
    setTestMsg(error ? error.message : `${rows.length} test-events toegevoegd. Ze tellen niet mee in de grafieken; zie het datakwaliteit-blok.`)
    loadAll()
  }
  const clearTestEvents = async () => {
    if (!supabase) return
    setTestMsg('Bezig…')
    const { data, error } = await supabase.rpc('admin_delete_test_events')
    const n = (data as { deleted?: number } | null)?.deleted ?? 0
    setTestMsg(error ? error.message : `${n} test-events gewist.`)
    loadAll()
  }

  const exportCsv = () => {
    const csv = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
    const head = 'datum,naam,score,email,spel\n'
    const body = entries
      .map((e) => `${new Date(e.created_at).toISOString()},${csv(e.name ?? '')},${e.score},${csv(e.email)},${e.game_id}`)
      .join('\n')
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ijhop-inzendingen.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- Auth ----
  const sendLink = async () => {
    if (!supabase || !email) return
    setAuthBusy(true); setAuthMsg(null)
    const { data: allowed } = await supabase.rpc('email_allowed_for_admin', { p_email: email })
    if (allowed !== true) { setAuthMsg('Dit e-mailadres heeft geen toegang tot het dashboard.'); setAuthBusy(false); return }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/admin` } })
    if (error) setAuthMsg(error.message)
    else { setLinkSent(true); setAuthMsg(`We hebben een inloglink naar ${email} gestuurd. Open je mail en klik de link.`) }
    setAuthBusy(false)
  }
  const signInPw = async () => {
    if (!supabase) return
    setAuthBusy(true); setAuthMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMsg(error.message)
    setAuthBusy(false)
  }
  const savePassword = async () => {
    if (!supabase || newPassword.length < 6) return
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : 'Wachtwoord opgeslagen. Je kunt nu ook met wachtwoord inloggen.')
    if (!error) setNewPassword('')
  }
  const signOut = () => supabase?.auth.signOut()

  // ---- Beheer ----
  const createInvite = async () => {
    if (!supabase || !inviteEmail) return
    setMgmtMsg(null)
    const { data, error } = await supabase.rpc('create_admin_invite', { p_email: inviteEmail })
    if (error) { setMgmtMsg(error.message); return }
    setNewInvite({ email: (data as { email: string }).email })
    setInviteEmail(''); loadAll()
  }
  const revokeInvite = async (id: string) => { if (supabase) { await supabase.rpc('revoke_admin_invite', { p_id: id }); loadAll() } }
  const removeAdmin = async (uid: string) => {
    if (!supabase) return
    setMgmtMsg(null)
    const { error } = await supabase.rpc('remove_admin', { p_user_id: uid })
    if (error) setMgmtMsg(error.message)
    loadAll()
  }

  // ---- Render states ----
  if (!supabase) return <Shell><p className="text-slate-600">Supabase is niet geconfigureerd.</p></Shell>
  if (checking) return <Shell><p className="text-slate-500">Laden…</p></Shell>

  if (!session) {
    const inputCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand'
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-xl font-bold text-slate-900">🛟 IJhop Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Log in om het dashboard te zien.</p>
          <div className="mt-4 flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
            {(['link', 'password'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setAuthMode(m); setAuthMsg(null); setLinkSent(false) }}
                className={`flex-1 rounded-full px-3 py-1.5 ${authMode === m ? 'bg-white text-brand shadow-sm' : 'text-slate-500'}`}>
                {m === 'link' ? '✉️ Inloglink' : '🔑 Wachtwoord'}
              </button>
            ))}
          </div>
          {authMode === 'link' ? (
            <div className="mt-4 flex flex-col gap-2">
              <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <button type="button" disabled={authBusy || !email || linkSent} onClick={sendLink} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {authBusy ? 'Versturen…' : linkSent ? '✓ Link verstuurd' : 'Stuur inloglink'}
              </button>
              {linkSent && <button type="button" onClick={() => { setLinkSent(false); setAuthMsg(null) }} className="text-xs text-slate-400 underline-offset-2 hover:underline">Opnieuw versturen / ander e-mailadres</button>}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <button type="button" disabled={authBusy} onClick={signInPw} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Inloggen</button>
              <p className="text-[11px] text-slate-400">Nog geen wachtwoord? Log eerst in met de inloglink en stel daarna een wachtwoord in.</p>
            </div>
          )}
          {authMsg && <p className="mt-2 text-xs text-amber-600">{authMsg}</p>}
        </div>
      </Shell>
    )
  }

  if (isAdmin === false) {
    const sql = `insert into public.admins(user_id) values ('${session.user.id}');`
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Nog geen toegang</h1>
          <p className="mt-1 text-sm text-slate-600">Je bent ingelogd als <strong>{session.user.email}</strong>, maar dit adres is nog niet uitgenodigd.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">Opnieuw proberen</button>
            <button type="button" onClick={signOut} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Uitloggen</button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-slate-400">Eerste admin van een nieuw project?</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">{sql}</pre>
          </details>
        </div>
      </Shell>
    )
  }

  // ---- Dashboard ----
  const q = dash?.quality
  const life = dash?.life
  const win = dash?.window
  const funnelSteps = dash
    ? [
        { label: 'App geopend', value: dash.funnel.sessions, emoji: '👋' },
        { label: 'Arcade bereikt', value: dash.funnel.arcade, emoji: '🎮' },
        { label: 'Spel gestart', value: dash.funnel.started, emoji: '▶️' },
        { label: 'Spel afgemaakt', value: dash.funnel.finished, emoji: '🏁' },
      ]
    : []
  const funnelBase = Math.max(1, dash?.funnel.sessions ?? 0)
  const skel = !firstLoaded

  return (
    <Shell wide>
      <div className={`rounded-3xl bg-gradient-to-br from-brand to-teal-600 p-5 text-white shadow-lg ${demo ? 'ring-4 ring-amber-300' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold">
              🛟 IJhop Admin
              {demo && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-amber-950">DEMO</span>}
            </h1>
            <p className="text-sm text-white/80">{session.user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
              </span>
              {life?.active_5m ?? 0} live
            </span>
            <div className="flex overflow-hidden rounded-full bg-white/15 text-xs font-semibold">
              {[7, 30].map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`px-3 py-1.5 ${days === d ? 'bg-white text-brand' : 'text-white'}`}>{d}d</button>
              ))}
            </div>
            <button type="button" onClick={() => setDemo((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${demo ? 'bg-amber-300 text-amber-950' : 'bg-white/15 text-white'}`}>🎭 Demo</button>
            <button type="button" onClick={() => setAuto((a) => !a)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${auto ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}>{auto ? '⏱ Auto aan' : '⏱ Auto uit'}</button>
            <button type="button" onClick={loadAll} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand">{loading ? 'Verversen…' : 'Verversen'}</button>
            <button type="button" onClick={signOut} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">Uitloggen</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/70">Laatst bijgewerkt: {clock(lastUpdated)}{demo ? ' · demo-data (niet opgeslagen)' : ''}</p>
      </div>

      {/* Fouten zichtbaar maken: nooit een stil leeg dashboard */}
      {dashErr && !demo && (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <p className="font-semibold">⚠️ Dashboard-data kon niet laden</p>
          <p className="mt-1 text-xs">{dashErr}</p>
          {/analytics_dashboard/.test(dashErr) && (
            <p className="mt-2 text-xs">Waarschijnlijk is migratie <strong>0012_analytics_dashboard_v2.sql</strong> nog niet gedraaid in de Supabase SQL-editor.</p>
          )}
        </div>
      )}

      {/* Laag 3: datakwaliteit. Kan ik deze cijfers vertrouwen? */}
      {!skel && dash && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs text-slate-500 shadow-sm ring-1 ring-slate-100">
          <span title="Laatste echte (niet-test) event">
            📶 Laatste event: <strong className="text-slate-700">{q?.last_real_event_at ? `${ago(q.last_real_event_at)} geleden` : 'nog nooit'}</strong>
          </span>
          <span>✨ <strong className="text-slate-700">{nf(q?.events_today ?? 0)}</strong> events vandaag</span>
          <span className={q && q.test_events > 0 ? 'font-semibold text-amber-600' : ''}>
            🧪 Test-events: {q && q.test_events > 0 ? `${nf(q.test_events)} aanwezig (tellen niet mee)` : 'geen'}
          </span>
          <span className={demo ? 'font-semibold text-amber-600' : ''}>🎭 Demo: {demo ? 'AAN' : 'uit'}</span>
          <button
            type="button"
            onClick={() => setIncludeOwn((v) => !v)}
            className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${includeOwn ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}
            title="Admin-accounts (zoals jijzelf) meetellen of niet"
          >
            👤 Eigen activiteit: {includeOwn ? 'telt mee' : 'uitgesloten'}
          </button>
        </div>
      )}

      {skel ? (
        <SkeletonBody />
      ) : !dash ? null : (
        <>
          {/* Laag 1: leeft de app? Altijd zichtbaar. */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat emoji="👥" label="Vandaag" value={nf(life?.users_today ?? 0)} sub={`unieke gebruikers · ${nf(life?.sessions_today ?? 0)} sessies`} accent="brand" />
            <Stat emoji="📅" label="Laatste 7 dagen" value={nf(life?.users_7d ?? 0)} sub={`unieke gebruikers · ${nf(life?.sessions_7d ?? 0)} sessies`} accent="sky" />
            <Stat emoji="🗓" label="Laatste 30 dagen" value={nf(life?.users_30d ?? 0)} sub={`totaal ooit: ${nf(life?.users_total ?? 0)}`} accent="violet" />
            <Stat emoji="🔁" label="Sessies per gebruiker" value={life?.sessions_per_user_7d ?? '0'} sub={`7 dagen · n=${nf(life?.sessions_7d ?? 0)} sessies`} accent="amber" />
            <Stat emoji="🟢" label="Actief nu (5 min)" value={nf(life?.active_5m ?? 0)} accent="brand" />
            <Stat emoji="⏱" label="Sessieduur (mediaan)" value={fmtDuration(life?.median_session_sec ?? 0)} sub={`n=${nf(life?.n_dur_sessions ?? 0)} sessies met 2+ events`} accent="slate" />
          </div>

          {/* Dag-reeks: aangevuld met echte nullen, dus een stille dag is zichtbaar 0 */}
          <div className="mt-4">
            <Panel title={`Unieke gebruikers per dag (${days}d)`} emoji="📈" sub={`n=${nf(win?.events ?? 0)} events in venster`}>
              <Columns
                data={dash.daily.map((d) => ({ label: d.day.slice(5), value: d.users, title: `${d.day}: ${nf(d.users)} gebruikers · ${nf(d.sessions)} sessies · ${nf(d.events)} events` }))}
                labelEvery={Math.ceil(Math.max(1, dash.daily.length) / 6)}
              />
            </Panel>
          </div>

          {/* Laag 2: wat doen ze? Met minimale steekproef per widget. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title={`Funnel (${days}d)`} emoji="🫳" sub={`n=${nf(dash.funnel.sessions)} sessies`}>
              <Gate n={dash.funnel.sessions} min={10} unit="sessies">
                <div className="flex flex-col gap-2">
                  {funnelSteps.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-sm">
                      <span className="w-32 shrink-0 text-slate-600">{s.emoji} {s.label}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-brand to-teal-500 pr-2 text-[10px] font-bold text-white" style={{ width: `${Math.max(4, (s.value / funnelBase) * 100)}%` }}>{nf(s.value)}</div>
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">{Math.round((s.value / funnelBase) * 100)}%</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400">Stappen zijn genest: elke stap is een subset van de vorige.</p>
                </div>
              </Gate>
            </Panel>
            <Panel title="Piekuren (sessies per uur)" emoji="🕑" sub={`n=${nf(win?.sessions ?? 0)} sessies`}>
              <Gate n={win?.events ?? 0} min={30} unit="events">
                <Columns data={dash.hourly.map((v, i) => ({ label: String(i), value: v, title: `${i}:00 uur: ${nf(v)} sessies` }))} color="bg-sky-500" labelEvery={3} />
              </Gate>
            </Panel>
            <Panel title="Per weekdag (sessies)" emoji="🗓️" sub={`n=${nf(win?.sessions ?? 0)} sessies`}>
              <Gate n={win?.events ?? 0} min={30} unit="events">
                <Columns data={dash.dow.map((v, i) => ({ label: DOW[i], value: v }))} color="bg-violet-500" />
              </Gate>
            </Panel>
            <Panel title="Welke tab (unieke gebruikers)" emoji="🧭" sub={`n=${nf(win?.users ?? 0)} gebruikers`}>
              <Gate n={win?.users ?? 0} min={10} unit="gebruikers">
                <BarList rows={dash.tabs.map((t) => ({ label: t.value === 'arcade' ? 'Spelletjes' : t.value === 'ferries' ? 'Ponten' : t.value, value: t.users, title: `${nf(t.events)} keer bekeken` }))} color="bg-sky-500" />
              </Gate>
            </Panel>
            <Panel title="Welk apparaat (unieke gebruikers)" emoji="📱" sub={`n=${nf(win?.users ?? 0)} gebruikers`}>
              <Gate n={win?.users ?? 0} min={10} unit="gebruikers">
                <BarList rows={dash.devices.map((r) => ({ label: deviceLabel(r.value), value: r.users }))} color="bg-violet-500" />
              </Gate>
            </Panel>
            <Panel title="Gekozen pont (unieke gebruikers)" emoji="⛴️" sub={`n=${nf(win?.users ?? 0)} gebruikers`}>
              <Gate n={win?.users ?? 0} min={10} unit="gebruikers">
                <BarList rows={dash.ferries.map((r) => ({ label: r.value, value: r.users, title: `${nf(r.events)} keer gekozen` }))} color="bg-brand" />
              </Gate>
            </Panel>
            <Panel title="Gekozen poppetje (unieke gebruikers)" emoji="🧑" sub={`n=${nf(win?.users ?? 0)} gebruikers`}>
              <Gate n={win?.users ?? 0} min={10} unit="gebruikers">
                <BarList rows={dash.characters.map((r) => ({ label: r.value, value: r.users }))} color="bg-amber-500" />
              </Gate>
            </Panel>
            <Panel title="Live activiteit" emoji="📡">
              {recent.length === 0 ? <Empty /> : (
                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {recent.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm odd:bg-slate-50">
                      <span>{meta(e.name).emoji}</span>
                      <span className="flex-1 truncate text-slate-700">{meta(e.name).label}{propSummary(e.props) && <span className="text-slate-400"> · {propSummary(e.props)}</span>}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{ago(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* Verificatie-tools */}
      <div className="mt-4">
        <Panel title="Verificatie" emoji="🧪">
          <p className="text-xs text-slate-500">Test of de keten insert → RPC → grafiek werkt. <strong>Demo</strong> (knop bovenin) vult alles met voorbeelddata zónder iets op te slaan; <strong>test-events</strong> schrijven echte (gelabelde) events. Test-events tellen nooit mee in de cijfers hierboven; je ziet ze alleen in het datakwaliteit-blok en kunt ze hier wissen.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={demo} onClick={genTestEvents} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">➕ Genereer test-events</button>
            <button type="button" disabled={demo} onClick={clearTestEvents} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">🧹 Wis test-events</button>
          </div>
          {demo && <p className="mt-2 text-xs text-amber-600">Zet Demo uit om met echte test-events te werken.</p>}
          {testMsg && !demo && <p className="mt-2 text-xs text-slate-500">{testMsg}</p>}
        </Panel>
      </div>

      {/* Inzendingen prijzenactie */}
      <div className="mt-4">
        <Panel title="Inzendingen (prijzenactie)" emoji="📩">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{nf(entries.length)} inzending(en) met toestemming.</p>
            <button type="button" onClick={exportCsv} disabled={entries.length === 0} className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">⬇ Export CSV</button>
          </div>
          {entries.length === 0 ? <Empty text="Nog geen inzendingen." /> : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-1 font-semibold">Datum</th>
                    <th className="font-semibold">Naam</th>
                    <th className="font-semibold">Score</th>
                    <th className="font-semibold">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-500">{new Date(e.created_at).toLocaleDateString('nl-NL')}</td>
                      <td className="truncate text-slate-700">{e.name ?? '-'}</td>
                      <td className="font-semibold tabular-nums text-slate-800">{e.score}</td>
                      <td className="truncate text-slate-700">{e.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Toegang & uitnodigingen */}
      <div className="mt-4">
        <Panel title="Toegang & uitnodigingen" emoji="🔑">
          <div className="flex flex-wrap items-center gap-2">
            <input type="email" placeholder="e-mail van nieuwe admin" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand" />
            <button type="button" disabled={!inviteEmail} onClick={createInvite} className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">✉️ Nodig uit</button>
          </div>
          {mgmtMsg && <p className="mt-2 text-xs text-rose-600">{mgmtMsg}</p>}
          {newInvite && (
            <div className="mt-3 rounded-xl bg-brand/5 p-3 text-sm ring-1 ring-brand/20">
              <p className="text-slate-700">Uitnodiging klaar voor <strong>{newInvite.email}</strong> (7 dagen geldig).</p>
              <p className="mt-1 text-slate-600">Laat ze naar <strong>{window.location.host}/admin</strong> gaan en inloggen met dit e-mailadres (inloglink in hun mail). Daarna zijn ze automatisch admin.</p>
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
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${iv.status === 'open' ? 'bg-brand/15 text-brand' : iv.status === 'gebruikt' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{iv.status}</span>
                    {iv.status === 'open' && <button type="button" onClick={() => revokeInvite(iv.id)} className="text-xs font-semibold text-rose-600">Intrekken</button>}
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
                    {a.user_id === session.user.id ? <span className="text-[10px] font-bold text-brand">jij</span> : <button type="button" onClick={() => removeAdmin(a.user_id)} className="text-xs font-semibold text-rose-600">Verwijderen</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Jouw wachtwoord</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" placeholder="nieuw wachtwoord (min. 6 tekens)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand" />
              <button type="button" disabled={newPassword.length < 6} onClick={savePassword} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Opslaan</button>
            </div>
            {pwMsg && <p className="mt-1 text-xs text-slate-500">{pwMsg}</p>}
          </div>
        </Panel>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">Anonieme, privacy-vriendelijke statistieken · tijden in Europe/Amsterdam · {auto ? 'ververst automatisch' : 'auto-verversen uit'}</p>
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
