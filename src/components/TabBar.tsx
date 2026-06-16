import type { ReactNode } from 'react'
import { useI18n } from '../i18n/i18n'
import type { AppView } from '../hooks/useHashView'
import { FerryIcon } from './icons'

interface TabBarProps {
  view: AppView
  onNavigate: (view: AppView) => void
}

/** Onderbalk met de twee hoofdweergaven. Mobile-first, één duim. */
export function TabBar({ view, onNavigate }: TabBarProps) {
  const { t } = useI18n()

  const tab = (id: AppView, label: string, glyph: ReactNode) => {
    const active = view === id
    return (
      <button
        type="button"
        onClick={() => onNavigate(id)}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs font-medium transition ${
          active ? 'text-brand' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
        }`}
      >
        <span className="grid h-6 w-6 place-items-center">{glyph}</span>
        {label}
      </button>
    )
  }

  return (
    <nav className="sticky bottom-0 z-20 mt-3 -mx-4 border-t border-slate-200/70 bg-ij-50/90 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-white/10 dark:bg-ij-950/90">
      <div className="mx-auto flex max-w-md items-stretch">
        {tab('ferries', t.arcade.tabFerries, <FerryIcon className="h-5 w-5" />)}
        {tab('arcade', t.arcade.tabGames, <span className="text-lg leading-none">🕹️</span>)}
      </div>
    </nav>
  )
}
