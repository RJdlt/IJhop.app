import { useI18n } from '../i18n/i18n'
import { useTheme } from '../hooks/useTheme'
import { FerryIcon, MoonIcon, SunIcon } from './icons'

export function Header() {
  const { t, lang, toggle } = useI18n()
  const { theme, toggle: toggleTheme } = useTheme()

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30">
          <FerryIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl tracking-tight" aria-label={t.appName}>
            <span className="font-medium">{t.appName.slice(0, 2)}</span>
            <span className="font-normal">{t.appName.slice(2)}</span>
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          aria-label="Taal / Language"
        >
          {lang === 'nl' ? 'NL' : 'EN'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
        >
          {theme === 'dark' ? <SunIcon className="h-4.5 w-4.5" /> : <MoonIcon className="h-4.5 w-4.5" />}
        </button>
      </div>
    </header>
  )
}
