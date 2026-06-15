import { useEffect, useState } from 'react'

/**
 * A ticking clock. Re-renders consumers every `intervalMs` (default 1s) so live
 * countdowns stay accurate. Pauses while the tab is hidden to save battery and
 * resyncs immediately on return.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: number | undefined

    const start = () => {
      stop()
      setNow(new Date())
      timer = window.setInterval(() => setNow(new Date()), intervalMs)
    }
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
