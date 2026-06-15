import type { Lang } from '../i18n/strings'

/** Compact relative label for a departure, e.g. "4 min", "nu", "1u 12". */
export function relativeLabel(secondsUntil: number, lang: Lang): string {
  const totalMin = Math.floor(secondsUntil / 60)
  if (secondsUntil < 30) return lang === 'nl' ? 'nu' : 'now'
  if (totalMin < 60) return `${Math.max(1, totalMin)} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const hUnit = lang === 'nl' ? 'u' : 'h'
  return m === 0 ? `${h}${hUnit}` : `${h}${hUnit} ${m}`
}

/** Big mm:ss for the headline countdown (capped to show hours when far out). */
export function clockCountdown(secondsUntil: number): string {
  const s = Math.max(0, secondsUntil)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}
