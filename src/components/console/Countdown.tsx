import { useEffect, useState } from 'react'
import { formatCountdown } from '@/lib/autoForge'

/**
 * Seconds until the next automatic block.
 *
 * It ticks on its own second rather than being driven from the forge loop:
 * that loop only wakes when a block is due, so anything counting from there
 * would jump from full to zero. Nothing else in the console re-renders on
 * this tick, because the clock lives here and not in the header above it.
 */
export function Countdown({ at }: { at: number }) {
  const [remaining, setRemaining] = useState(() => at - Date.now())

  useEffect(() => {
    setRemaining(at - Date.now())
    const id = setInterval(() => setRemaining(at - Date.now()), 1000)
    return () => clearInterval(id)
  }, [at])

  return <span className="tabular-nums">{formatCountdown(remaining)}</span>
}
