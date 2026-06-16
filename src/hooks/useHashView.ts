import { useEffect, useState } from 'react'

/** De twee hoofdweergaven van de app, gesynchroniseerd met de URL-hash. */
export type AppView = 'ferries' | 'arcade'

const ARCADE_HASH = '#spelletjes'

function fromHash(): AppView {
  if (typeof window === 'undefined') return 'ferries'
  return window.location.hash === ARCADE_HASH ? 'arcade' : 'ferries'
}

/**
 * Houdt de actieve weergave gelijk met de URL-hash, zodat `#spelletjes`
 * deelbaar/bookmarkbaar is en de back-knop tussen de tabs werkt.
 */
export function useHashView(): [AppView, (view: AppView) => void] {
  const [view, setView] = useState<AppView>(fromHash)

  useEffect(() => {
    const onHashChange = () => setView(fromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (next: AppView) => {
    if (next === 'arcade') {
      if (window.location.hash !== ARCADE_HASH) window.location.hash = 'spelletjes'
    } else if (window.location.hash) {
      // Hash leegmaken zonder hashchange — daarom hier zelf de state bijwerken.
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setView(next)
  }

  return [view, navigate]
}
