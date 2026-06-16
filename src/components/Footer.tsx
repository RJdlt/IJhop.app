import { useI18n } from '../i18n/i18n'
import { timetable } from '../lib/schedule'

export function Footer() {
  const { t, lang } = useI18n()
  const updated = new Date(timetable.generated).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <footer className="space-y-2 pb-2 pt-2 text-center text-xs text-slate-400">
      <p>{t.scheduleNote}</p>
      <p>
        {t.dataSource} · {t.lastUpdated} {updated}
      </p>
      <p className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t.offlineReady}
      </p>
      <p className="text-[10px] text-slate-300 dark:text-slate-600">v{__BUILD_ID__}</p>
    </footer>
  )
}
