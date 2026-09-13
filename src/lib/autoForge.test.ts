import { describe, expect, it } from 'vitest'
import { AUTO_INTERVALS_S, DEFAULT_AUTO_INTERVAL_S, parseAutoInterval } from './autoForge'

describe('parseAutoInterval', () => {
  it('accepts every interval the control offers', () => {
    for (const seconds of AUTO_INTERVALS_S) {
      expect(parseAutoInterval(String(seconds))).toBe(seconds)
    }
  })

  it('falls back to the default when nothing is stored', () => {
    expect(parseAutoInterval(null)).toBe(DEFAULT_AUTO_INTERVAL_S)
    expect(parseAutoInterval('')).toBe(DEFAULT_AUTO_INTERVAL_S)
  })

  it('refuses a value the chain cannot honour, however it got there', () => {
    expect(parseAutoInterval('1')).toBe(DEFAULT_AUTO_INTERVAL_S)
    expect(parseAutoInterval('0')).toBe(DEFAULT_AUTO_INTERVAL_S)
    expect(parseAutoInterval('-5')).toBe(DEFAULT_AUTO_INTERVAL_S)
    expect(parseAutoInterval('nonsense')).toBe(DEFAULT_AUTO_INTERVAL_S)
  })

  it('never offers an interval below the five seconds a block needs', () => {
    expect(Math.min(...AUTO_INTERVALS_S)).toBeGreaterThanOrEqual(5)
  })
})
