import { useEffect, useState } from 'react'
import { useAnimate } from 'framer-motion'
import { formatCountdown } from '@/lib/autoForge'
import { useMotion, seconds } from '@/motion'

/** Below this many milliseconds the clock starts pulsing with each tick. */
const IMMINENT_MS = 3_500

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
  const [clock, animate] = useAnimate<HTMLSpanElement>()
  const { enabled } = useMotion()

  useEffect(() => {
    setRemaining(at - Date.now())
    const id = setInterval(() => setRemaining(at - Date.now()), 1000)
    return () => clearInterval(id)
  }, [at])

  // The last three seconds are the ones worth watching, so those tick
  // visibly. Pulsing for the whole interval would be a metronome nobody asked
  // for, and the rest of the countdown is a number you read, not a rhythm you
  // feel.
  useEffect(() => {
    if (!enabled || !clock.current) return
    if (remaining > IMMINENT_MS || remaining < 0) return
    void animate(clock.current, { opacity: [0.45, 1] }, { duration: seconds('quick') })
  }, [remaining, enabled, animate, clock])

  return (
    <span ref={clock} className="tabular-nums">
      {formatCountdown(remaining)}
    </span>
  )
}
