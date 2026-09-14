import { describe, expect, it } from 'vitest'
import { finerThanToken, formatQuantity, toSmallestUnit } from './token'

describe('formatQuantity', () => {
  it('leaves an indivisible token alone', () => {
    expect(formatQuantity('1000', 0)).toBe('1000')
  })

  it('places the point according to the asset decimals', () => {
    expect(formatQuantity('1000', 2)).toBe('10')
    expect(formatQuantity('1234', 2)).toBe('12.34')
  })

  it('pads a quantity smaller than one whole token', () => {
    expect(formatQuantity('5', 2)).toBe('0.05')
    expect(formatQuantity('5', 4)).toBe('0.0005')
  })

  it('drops trailing zeros in the fraction rather than showing 12.30', () => {
    expect(formatQuantity('1230', 2)).toBe('12.3')
    expect(formatQuantity('1200', 2)).toBe('12')
  })

  it('handles zero', () => {
    expect(formatQuantity('0', 2)).toBe('0')
  })
})

describe('finerThanToken', () => {
  it('allows what the token can hold', () => {
    expect(finerThanToken('250', 2)).toBe(false)
    expect(finerThanToken('250.5', 2)).toBe(false)
    expect(finerThanToken('250.50', 2)).toBe(false)
  })

  it('refuses a division the token does not have', () => {
    expect(finerThanToken('250.001', 2)).toBe(true)
    expect(finerThanToken('1.5', 0)).toBe(true)
  })
})

describe('toSmallestUnit', () => {
  it('shifts a whole amount by the token decimals', () => {
    expect(toSmallestUnit('10000', 2)).toBe('1000000')
    expect(toSmallestUnit('250', 2)).toBe('25000')
  })

  it('leaves a token without decimals alone', () => {
    expect(toSmallestUnit('40', 0)).toBe('40')
  })

  it('fills a short fraction out to the token width', () => {
    expect(toSmallestUnit('250.5', 2)).toBe('25050')
    expect(toSmallestUnit('250.05', 2)).toBe('25005')
  })

  // The pair has to survive the round trip, or a number typed by a person and
  // the number they are later shown would differ.
  it('round-trips with formatQuantity', () => {
    for (const [amount, decimals] of [
      ['10000', 2],
      ['250.5', 2],
      ['1', 8],
      ['40', 0],
    ] as const) {
      expect(formatQuantity(toSmallestUnit(amount, decimals), decimals)).toBe(
        String(Number(amount)),
      )
    }
  })
})
