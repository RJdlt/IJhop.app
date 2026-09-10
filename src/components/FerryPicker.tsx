import { useI18n } from '../i18n/i18n'
import { clockCountdown } from '../lib/format'
import { LINES, STOPS } from '../lib/schedule'
import type { LineId, StopId } from '../types'

export interface FerryOption {
  key: string
  line: LineId
  from: StopId
  to: StopId
  secondsUntil?: number
}

interface FerryPickerProps {
  options: FerryOption[]
  value: string | null
  onChange: (key: string | null) => void
}

/**
 * Laat je kiezen op welke afvaart je wacht. Die keuze bepaalt met wie je
 * elkaar kunt vinden op de pont (Pont Ontmoeting). Live aftelklok per richting.
 */
export function FerryPicker({ options, value, onChange }: FerryPickerProps) {
  const { t } = useI18n()

  const base = 'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition border'
  const on = 'border-brand bg-brand/10 dark:border-brand dark:bg-brand/20'
  const off =
    'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'

  return (
    <section className="card px-5 py-4 text-left">
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t.whichFerry}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = value === o.key
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(active ? null : o.key)}
              className={`${base} ${active ? on : off}`}
            >
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: LINES[o.line].color }}
              >
                {o.line}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-xs font-semibold">
                  → {STOPS[o.to]?.name ?? o.to}
                </span>
                <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {t.from} {STOPS[o.from]?.name ?? o.from}
                </span>
                <span className="block tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                  {o.secondsUntil != null ? clockCountdown(o.secondsUntil) : '–'}
                </span>
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`${base} col-span-2 justify-center ${value === null ? on : off}`}
        >
          {t.noFerryChosen}
        </button>
      </div>
    </section>
  )
}
