import { useEffect, useRef, useState } from 'react'

/**
 * How many blocks have arrived while this component has been mounted.
 *
 * The number itself means nothing; that it *changed* is the signal, which is
 * what makes it usable as an effect dependency. It counts rather than holding
 * a boolean because two blocks in a row have to read as two events.
 *
 * It exists so that "a block arrived" is decided once. Before this, the only
 * detection in the app lived inside useBlockChime, on the start page, and the
 * console — the screen built for watching the chain — knew nothing.
 */
export function useChainPulse(height: number | null): number {
  const [pulse, setPulse] = useState(0)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (height === null) return
    // Only forward. A height that fell is a rewind, which is not an arrival.
    if (previous.current !== null && height > previous.current) setPulse((n) => n + 1)
    previous.current = height
  }, [height])

  return pulse
}
