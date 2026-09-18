import { describe, expect, it } from 'vitest'
import { DEFAULT_IDENTICON_STYLE, IDENTICON_STYLES, nextStyle, readStyle } from './identicon'

describe('nextStyle', () => {
  it('returns to where it started after one full round of clicks', () => {
    let style = DEFAULT_IDENTICON_STYLE
    for (const _ of IDENTICON_STYLES) style = nextStyle(style)
    expect(style).toBe(DEFAULT_IDENTICON_STYLE)
  })

  // Driven off the exported tuple rather than a written-out list, so a fourth
  // style added later cannot quietly sit outside the cycle.
  it('reaches every style on the way round', () => {
    const seen = new Set([DEFAULT_IDENTICON_STYLE])
    let style = DEFAULT_IDENTICON_STYLE
    for (const _ of IDENTICON_STYLES) {
      style = nextStyle(style)
      seen.add(style)
    }
    expect([...seen].sort()).toEqual([...IDENTICON_STYLES].sort())
  })

  it('never stays where it is', () => {
    for (const style of IDENTICON_STYLES) {
      expect(nextStyle(style)).not.toBe(style)
    }
  })
})

describe('readStyle', () => {
  it('returns a stored style unchanged', () => {
    for (const style of IDENTICON_STYLES) {
      expect(readStyle(style)).toBe(style)
    }
  })

  // The default is the one hashicon pins its version for: the picture a Signum
  // wallet draws for the same address. Nothing but a deliberate click leaves it.
  it('falls back to the wallet-matching default when nothing is stored', () => {
    expect(readStyle(null)).toBe('hashicon')
    expect(readStyle('')).toBe('hashicon')
  })

  it('falls back when the stored value is not a style', () => {
    expect(readStyle('blockies')).toBe('hashicon')
    expect(readStyle('HASHICON')).toBe('hashicon')
  })
})
