import { useI18n } from '../i18n/i18n'
import { clockCountdown } from '../lib/format'
import { LINES } from '../lib/schedule'
import type { LineId, StopId } from '../types'

export interface FerryOption {
  key: string
  line: LineId
  to: StopId
  secondsUntil?: number
}

interface FerryPickerProps {
  options: FerryOption[]
  value: string | null
  onChange: (key: string | null) => void
}

/**
 * Laat de speler kiezen welke pont hij wacht. Alleen die afvaart pauzeert straks
 * de game; "Alleen spelen" pauzeert nooit. Live aftelklok per richting.
 */
export function FerryPicker({ options, value, onChange }: FerryPickerProps) {
  const { t } = useI18n()

  const base =
    'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition border'
  const on = 'border-white/80 bg-white/20'
  const off = 'border-white/10 bg-white/5 hover:bg-white/10'

  return (
    <div className="w-full max-w-xs text-left">
      <p className="mb-2 text-xs font-medium text-white/70">{t.arcade.whichFerry}</p>
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
              <span className="flex-1 leading-tight">
                <span className="block truncate text-xs font-semibold text-white">
                  {t.stopNames[o.to]}
                </span>
                <span className="block tabular-nums text-[11px] text-white/70">
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
          🎮 {t.arcade.justPlaying}
        </button>
      </div>
    </div>
  )
}
