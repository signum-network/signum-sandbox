import { useEffect, useRef } from 'react'
import hashicon from 'hashicon'
import { createAvatar } from '@dicebear/core'
import * as identicon from '@dicebear/identicon'
import * as pixelArt from '@dicebear/pixel-art'
import { useIdenticon } from '@/identicon'

/**
 * The picture an address wears, in whichever style this visitor picked.
 *
 * Three engines, one size contract: every branch renders into a span of
 * exactly `size` square, so cycling the style cannot move a row.
 *
 * It lives here rather than under `console/` because `AppHeader` draws one too
 * — the style button is a live preview of itself — and app chrome reaching
 * into the console for a component would be the wrong way round.
 */
export function Identicon({ value, size = 20 }: { value: string; size?: number }) {
  const { style } = useIdenticon()

  // Separate components rather than branches inside one: the hashicon path
  // mounts a canvas through a ref, the DiceBear path sets innerHTML. Sharing a
  // span between those two would leave React managing markup it never wrote.
  return style === 'hashicon' ? (
    <HashiconPicture value={value} size={size} />
  ) : (
    <DicebearPicture style={style} value={value} size={size} />
  )
}

/**
 * hashicon renders into a canvas element. Pinned at 0.3.0 so the same address
 * produces the same picture here as in the Signum wallets — which is also why
 * it is the default style rather than one of the two below.
 *
 * Note: 0.3.0 ships only a default export (`export default hashicon`), not the
 * named export the plan assumed — `import hashicon from 'hashicon'` here.
 */
function HashiconPicture({ value, size }: { value: string; size: number }) {
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    node.replaceChildren(hashicon(value, { size }))
  }, [value, size])

  return <span ref={host} style={{ width: size, height: size, display: 'inline-block' }} />
}

const DICEBEAR = { identicon, 'pixel-art': pixelArt }

type DicebearStyle = keyof typeof DICEBEAR

/**
 * Generating an SVG is pure — the same address, style and size always give the
 * same string — so it is worth keeping. The console's feed is a long list that
 * re-renders on every block, and without this each of those blocks would redraw
 * every visible row from scratch.
 *
 * Cleared wholesale rather than evicted one by one: a sandbox has a handful of
 * accounts, so the bound exists to stop a pathological session growing the map
 * forever, not to be hit in normal use.
 */
const svgCache = new Map<string, string>()
const CACHE_LIMIT = 200

function dicebearSvg(style: DicebearStyle, value: string, size: number): string {
  const key = `${style}:${size}:${value}`
  const cached = svgCache.get(key)
  if (cached) return cached

  const svg = createAvatar(DICEBEAR[style], { seed: value, size }).toString()
  if (svgCache.size >= CACHE_LIMIT) svgCache.clear()
  svgCache.set(key, svg)
  return svg
}

function DicebearPicture({
  style, value, size,
}: { style: DicebearStyle; value: string; size: number }) {
  return (
    <span
      style={{ width: size, height: size, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: dicebearSvg(style, value, size) }}
    />
  )
}
