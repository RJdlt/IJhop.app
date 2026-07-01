import { useI18n } from '../i18n/i18n'
import { LINES, LINE_IDS, STOPS } from '../lib/schedule'

/**
 * Eenmalige vraag bij de eerste keer: welke pontjes pak je het meest? Die zet je
 * als favoriet, zodat het hoofdscherm overzichtelijk blijft (alleen favorieten,
 * de rest ingeklapt).
 */
export function OnboardingFavorites({
  favs,
  onToggle,
  onDone,
}: {
  favs: Set<string>
  onToggle: (line: string) => void
  onDone: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <p className="text-xl font-extrabold text-slate-900 dark:text-white">👋 {t.onbTitle}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{t.onbSubtitle}</p>

        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {LINE_IDS.map((l) => {
            const line = LINES[l]
            const [a, b] = line.connects
            const on = favs.has(l)
            return (
              <button
                key={l}
                type="button"
                onClick={() => onToggle(l)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                  on ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <span className="pill text-white" style={{ backgroundColor: line.color }}>
                  {l}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-white">
                  {STOPS[a]?.name ?? a} ↔ {STOPS[b]?.name ?? b}
                </span>
                <span className={`text-xl ${on ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                  {on ? '★' : '☆'}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onDone}
          className="mt-4 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          {favs.size > 0 ? t.onbDone : t.onbSkip}
        </button>
      </div>
    </div>
  )
}
