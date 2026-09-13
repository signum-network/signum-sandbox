import { describe, expect, it } from 'vitest'
import { formatQuantity } from './token'

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
