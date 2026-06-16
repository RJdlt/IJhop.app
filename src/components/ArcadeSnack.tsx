import { useI18n } from '../i18n/i18n'

interface ArcadeSnackProps {
  onOpen: () => void
}

/**
 * Kleine "speel terwijl je wacht"-affordance op het countdown-scherm. Opent de
 * arcade als overlay zónder de countdown eronder te raken.
 */
export function ArcadeSnack({ onOpen }: ArcadeSnackProps) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card animate-riseIn flex items-center gap-3 px-5 py-3.5 text-left transition hover:shadow-2xl"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-xl">
        🕹️
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{t.arcade.playWhileWaiting}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">Pont Hop · IJhop Arcade</span>
      </span>
      <span className="text-slate-300 dark:text-slate-500">›</span>
    </button>
  )
}
