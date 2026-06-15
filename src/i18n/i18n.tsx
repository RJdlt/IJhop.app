import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { STRINGS } from './strings'
import type { Lang, Strings } from './strings'

interface I18nValue {
  lang: Lang
  t: Strings
  setLang: (lang: Lang) => void
  toggle: () => void
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'ijhop.lang'

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'nl'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'nl' || stored === 'en') return stored
  // Default to Dutch, but honour an English-preferring browser.
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'nl'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: STRINGS[lang],
      setLang,
      toggle: () => setLang((l) => (l === 'nl' ? 'en' : 'nl')),
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
