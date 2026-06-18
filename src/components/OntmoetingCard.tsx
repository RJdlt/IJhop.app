import { useEffect, useMemo, useState } from 'react'
import { useOntmoeting } from '../hooks/useOntmoeting'
import { getNickname } from '../lib/nickname'
import { track } from '../lib/analytics'

/**
 * Pont Ontmoeting (1-op-1). Het scherm is alleen startsein en matchmaker: zodra
 * je gematcht bent, stuurt het je naar een vaste plek aan boord, met een
 * zichtbaar signaal en een codewoord. Volledig vrijwillig en altijd te stoppen.
 */
export function OntmoetingCard({ room, userId }: { room: string; userId: string | null }) {
  const [joined, setJoined] = useState(false)
  const [found, setFound] = useState(false)
  const nick = useMemo(() => getNickname(), [])
  const st = useOntmoeting(room, userId, nick, joined)

  useEffect(() => {
    if (st.status === 'matched') track('ontmoeting_matched')
  }, [st.status])

  const join = () => {
    setFound(false)
    setJoined(true)
    track('ontmoeting_join')
  }
  const stop = () => {
    setJoined(false)
    setFound(false)
  }

  // Gematcht: groot signaal-scherm (houd je telefoon omhoog).
  if (joined && st.status === 'matched' && st.signal && !found) {
    const s = st.signal
    return (
      <section
        className="card animate-riseIn overflow-hidden p-0 text-white"
        style={{ backgroundColor: s.color.hex }}
      >
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
            Je bent gematcht. Houd je scherm omhoog.
          </p>
          <p className="text-6xl leading-none">{s.symbol}</p>
          <p className="text-sm font-medium">
            Zoek de ander met hetzelfde <strong>{s.color.name.toLowerCase()}</strong> scherm{' '}
            <strong>{s.meetingPoint}</strong>.
          </p>
          <p className="mt-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            Codewoord: zeg &ldquo;{s.codeword}&rdquo;
          </p>
          <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setFound(true)
                track('ontmoeting_found')
              }}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              Ik heb de ander gevonden 🙌
            </button>
            <button type="button" onClick={stop} className="text-xs font-medium text-white/70">
              Liever niet, stoppen
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Gevonden: kort gelukt-moment.
  if (joined && found) {
    return (
      <section className="card animate-riseIn p-5 text-center">
        <p className="text-3xl">🙌</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-white">Leuk, jullie hebben elkaar gevonden!</p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">
          Geef elkaar een high five en geniet van de overtocht.
        </p>
        <button
          type="button"
          onClick={stop}
          className="mt-3 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Klaar
        </button>
      </section>
    )
  }

  // Meegedaan, wachten op iemand.
  if (joined) {
    return (
      <section className="card animate-riseIn p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">🤝 Pont Ontmoeting</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">
              Wachten op iemand die ook meedoet op deze overtocht.
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-brand" />
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">{st.count} klaar op deze overtocht</p>
        <button
          type="button"
          onClick={stop}
          className="mt-2 text-sm font-medium text-slate-400 underline-offset-2 hover:underline"
        >
          Stoppen
        </button>
      </section>
    )
  }

  // Uitnodiging.
  return (
    <section className="card animate-riseIn p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🤝 Pont Ontmoeting</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">
            Doe samen iets leuks met iemand op dezelfde pont. Je krijgt een signaal en een plek aan
            boord; daar vind je elkaar.
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-xl">
          🤝
        </span>
      </div>
      <button
        type="button"
        onClick={join}
        className="mt-4 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
      >
        Doe mee
      </button>
      <p className="mt-2 text-[11px] text-slate-400">
        Helemaal vrijwillig, geen locatie of gegevens nodig. Je kunt altijd stoppen.
      </p>
    </section>
  )
}
