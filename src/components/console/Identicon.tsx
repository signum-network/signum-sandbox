import { useEffect, useRef } from 'react'
import hashicon from 'hashicon'

/**
 * hashicon renders into a canvas element. Pinned at 0.3.0 so the same address
 * produces the same picture here as in the Signum wallets.
 *
 * Note: 0.3.0 ships only a default export (`export default hashicon`), not the
 * named export the plan assumed — `import hashicon from 'hashicon'` here.
 */
export function Identicon({ value, size = 20 }: { value: string; size?: number }) {
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    node.replaceChildren(hashicon(value, { size }))
  }, [value, size])

  return <span ref={host} style={{ width: size, height: size, display: 'inline-block' }} />
}
