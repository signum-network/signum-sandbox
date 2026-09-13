import { describe, expect, it } from 'vitest'
import {
  MULTI_OUT_LIMITS,
  checkRecipients,
  filledRecipients,
  parseRecipients,
  type Recipient,
} from './multiOut'

const rows = (n: number, signa = '1'): Recipient[] =>
  Array.from({ length: n }, (_, i) => ({ address: `TS-${i}`, signa }))

describe('parseRecipients', () => {
  it('reads an address and an amount per line', () => {
    expect(parseRecipients('TS-A, 10\nTS-B, 20')).toEqual([
      { address: 'TS-A', signa: '10' },
      { address: 'TS-B', signa: '20' },
    ])
  })

  it('accepts a line without an amount, which the same-amount variant does not need', () => {
    expect(parseRecipients('TS-A')).toEqual([{ address: 'TS-A', signa: '' }])
  })

  it('ignores blank lines and surrounding space', () => {
    expect(parseRecipients('\n  TS-A , 5 \n\n')).toEqual([{ address: 'TS-A', signa: '5' }])
  })

  it('drops a line that names no recipient', () => {
    expect(parseRecipients(', 5')).toEqual([])
  })
})

describe('filledRecipients', () => {
  it('leaves out rows nobody has filled in yet', () => {
    expect(filledRecipients([{ address: '', signa: '1' }, { address: 'TS-A', signa: '2' }])).toEqual(
      [{ address: 'TS-A', signa: '2' }],
    )
  })
})

describe('checkRecipients', () => {
  it('accepts a normal list', () => {
    expect(checkRecipients(rows(3), 'individual')).toBe('none')
  })

  it('objects to an empty list', () => {
    expect(checkRecipients([], 'individual')).toBe('empty')
    expect(checkRecipients([{ address: '  ', signa: '1' }], 'same')).toBe('empty')
  })

  it('holds each variant to its own measured limit', () => {
    expect(checkRecipients(rows(64), 'individual')).toBe('none')
    expect(checkRecipients(rows(65), 'individual')).toBe('tooMany')
    expect(checkRecipients(rows(128), 'same')).toBe('none')
    expect(checkRecipients(rows(129), 'same')).toBe('tooMany')
  })

  it('needs an amount per row only where the amounts differ', () => {
    const missing = [{ address: 'TS-A', signa: '' }]
    expect(checkRecipients(missing, 'individual')).toBe('missingAmount')
    expect(checkRecipients(missing, 'same')).toBe('none')
  })

  it('knows the limits it enforces', () => {
    expect(MULTI_OUT_LIMITS).toEqual({ individual: 64, same: 128 })
  })
})
