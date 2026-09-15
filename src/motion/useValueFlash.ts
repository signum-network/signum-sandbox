import { useEffect, useRef } from 'react'
import { useAnimate } from 'framer-motion'
import { useMotion } from './MotionProvider'
import { seconds } from './tokens'

/**
 * A single flash when a value on screen becomes a different value.
 *
 * Attach the returned scope as a `ref`. It owns the three judgements that
 * would otherwise be made again at every call site:
 *
 * Never on first sight — a number appearing for the first time did not
 * change, it arrived, and the whole view arriving is not news.
 *
 * Only on a genuine change — these values come from queries that refetch on
 * every block and mostly answer with what is already on screen. Flashing for
 * those would make a still account look busy, which is the opposite of what
 * watching one is for.
 *
 * And silent when the motion switch is off, because Framer's imperative
 * `animate()` does not read `MotionConfig`.
 *
 * The value is compared as a string, so the caller decides what counts as
 * one value: a balance is its own text, and a set of token holdings is a
 * signature of all of them.
 */
export function useValueFlash<T extends Element = HTMLSpanElement>(
  value: string | null | undefined,
) {
  const [scope, animate] = useAnimate<T>()
  const { enabled } = useMotion()
  // `undefined` means never seen. A null or undefined value is not a change
  // to anything, so it neither flashes nor counts as having been seen.
  const shown = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (value === null || value === undefined) return
    const previous = shown.current
    shown.current = value
    if (previous === undefined || previous === value) return
    if (!enabled || !scope.current) return
    void animate(scope.current, { opacity: [0.3, 1] }, { duration: seconds('quick') })
  }, [value, enabled, animate, scope])

  return scope
}
