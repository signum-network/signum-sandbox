import { describe, expect, it } from 'vitest'
import {
  AUTO_INTERVALS_S,
  DEFAULT_AUTO_INTERVAL_S,
  formatCountdown,
  formatInterval,
  parseAutoInterval,
} from './autoForge'

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

describe('formatInterval', () => {
  it('keeps short rates in seconds', () => {
    expect(formatInterval(5)).toBe('5 s')
    expect(formatInterval(30)).toBe('30 s')
  })

  it('switches to minutes once seconds stop being readable', () => {
    expect(formatInterval(60)).toBe('1 min')
    expect(formatInterval(240)).toBe('4 min')
  })
})

describe('formatCountdown', () => {
  it('counts bare seconds under a minute', () => {
    expect(formatCountdown(12_000)).toBe('12 s')
    expect(formatCountdown(59_000)).toBe('59 s')
  })

  it('switches to m:ss above a minute, zero-padded', () => {
    expect(formatCountdown(60_000)).toBe('1:00')
    expect(formatCountdown(187_000)).toBe('3:07')
    expect(formatCountdown(240_000)).toBe('4:00')
  })

  it('never counts below zero, however late the tick arrives', () => {
    expect(formatCountdown(0)).toBe('0 s')
    expect(formatCountdown(-5_000)).toBe('0 s')
  })

  it('rounds up, so the last second is shown as a second and not as zero', () => {
    expect(formatCountdown(1)).toBe('1 s')
  })
})
