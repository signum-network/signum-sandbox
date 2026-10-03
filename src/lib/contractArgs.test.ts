import { describe, expect, it } from 'vitest'
import {
  activationSigna,
  attachmentModeFor,
  encodeContractArgs,
  isBelowActivation,
  pickAttachment,
  toContractData,
  type ContractArg,
} from './contractArgs'

const int = (value: string): ContractArg => ({ type: 'integer', value })
const addr = (value: string): ContractArg => ({ type: 'address', value })
const bool = (value: 'true' | 'false'): ContractArg => ({ type: 'boolean', value })
const str = (value: string): ContractArg => ({ type: 'shortString', value })

// The contract deployed on the local sandbox chain while the spec was written;
// any valid id would do, this one has a verified encoding.
const CONTRACT_ID = '13125641130491689178'
const CONTRACT_RS = 'TS-FG8U-4565-CMY2-D7XBE'

const hexOf = (args: ContractArg[]) => {
  const result = encodeContractArgs(args)
  if (!('hex' in result)) throw new Error(`expected hex, got ${JSON.stringify(result)}`)
  return result.hex
}

describe('encodeContractArgs — one little-endian long per argument', () => {
  it('packs integers', () => {
    expect(hexOf([int('1')])).toBe('0100000000000000')
    expect(hexOf([int('42')])).toBe('2a00000000000000')
    expect(hexOf([int('-1')])).toBe('ffffffffffffffff')
    expect(hexOf([int('-9223372036854775808')])).toBe('0000000000000080')
    expect(hexOf([int('9223372036854775807')])).toBe('ffffffffffffff7f')
    expect(hexOf([int('18446744073709551615')])).toBe('ffffffffffffffff')
  })

  it('accepts surrounding whitespace on an integer', () => {
    expect(hexOf([int(' 42 ')])).toBe('2a00000000000000')
  })

  it('packs an address the same in every spelling', () => {
    const expected = 'dab836c810a527b6'
    expect(hexOf([addr(CONTRACT_ID)])).toBe(expected)
    expect(hexOf([addr(CONTRACT_RS)])).toBe(expected)
    expect(hexOf([addr('fg8u-4565-cmy2-d7xbe')])).toBe(expected)
  })

  it('packs booleans as 1 and 0', () => {
    expect(hexOf([bool('true')])).toBe('0100000000000000')
    expect(hexOf([bool('false')])).toBe('0000000000000000')
  })

  it('packs short strings as UTF-8 bytes', () => {
    expect(hexOf([str('abc')])).toBe('6162630000000000')
    expect(hexOf([str('12345678')])).toBe('3132333435363738')
    expect(hexOf([str('äöü')])).toBe('c3a4c3b6c3bc0000')
  })

  it('concatenates arguments in order', () => {
    const hex = hexOf([int('1'), bool('true'), str('abc')])
    expect(hex).toHaveLength(48)
    expect(hex).toBe('0100000000000000' + '0100000000000000' + '6162630000000000')
  })

  it('encodes nothing for no arguments', () => {
    expect(encodeContractArgs([])).toEqual({ hex: '' })
  })

  it('reports every bad row by index and encodes nothing', () => {
    expect(encodeContractArgs([int('1'), int('x'), str('123456789')])).toEqual({
      errors: { 1: 'notAnInteger', 2: 'tooLong' },
    })
  })
})

describe('toContractData — what cannot be one long', () => {
  it('rejects integers outside -2^63 … 2^64-1', () => {
    expect(toContractData(int('18446744073709551616'))).toEqual({ error: 'outOfRange' })
    expect(toContractData(int('-9223372036854775809'))).toEqual({ error: 'outOfRange' })
  })

  it('rejects anything that is not a plain decimal integer', () => {
    for (const value of ['+5', '1e3', '0x10', '4.2', '--1', 'abc']) {
      expect(toContractData(int(value)), value).toEqual({ error: 'notAnInteger' })
    }
  })

  it('rejects empty values, except for booleans', () => {
    expect(toContractData(int('  '))).toEqual({ error: 'empty' })
    expect(toContractData(addr(''))).toEqual({ error: 'empty' })
    expect(toContractData(str(''))).toEqual({ error: 'empty' })
  })

  it('rejects what is not an address', () => {
    expect(toContractData(addr('TS-NOPE'))).toEqual({ error: 'notAnAddress' })
    expect(toContractData(addr('-5'))).toEqual({ error: 'notAnAddress' })
    expect(toContractData(addr('18446744073709551616'))).toEqual({ error: 'notAnAddress' })
  })

  it('counts short-string length in UTF-8 bytes, not characters', () => {
    expect(toContractData(str('123456789'))).toEqual({ error: 'tooLong' })
    // five characters, ten bytes
    expect(toContractData(str('äöüäö'))).toEqual({ error: 'tooLong' })
  })

  it('keeps spaces inside a short string', () => {
    expect(hexOf([str(' a ')])).toBe('2061200000000000')
  })
})

describe('activation amount', () => {
  it('converts planck to SIGNA', () => {
    expect(activationSigna('40000000')).toBe('0.4')
  })

  it('warns only below the minimum', () => {
    expect(isBelowActivation('0.3', '40000000')).toBe(true)
    expect(isBelowActivation('0.4', '40000000')).toBe(false)
    expect(isBelowActivation('5', '40000000')).toBe(false)
  })

  it('does not warn about an amount that is not a number yet', () => {
    expect(isBelowActivation('', '40000000')).toBe(false)
    expect(isBelowActivation('abc', '40000000')).toBe(false)
  })
})

describe('pickAttachment', () => {
  const base = {
    attach: true,
    toContract: true,
    mode: 'args' as const,
    encoded: { hex: '0100000000000000' },
    text: 'hello',
  }

  it('attaches nothing when the toggle is off', () => {
    expect(pickAttachment({ ...base, attach: false })).toEqual({})
  })

  it('sends arguments as binary for a contract', () => {
    expect(pickAttachment(base)).toEqual({ binaryMessage: '0100000000000000' })
  })

  it('sends no attachment for an empty argument list', () => {
    expect(pickAttachment({ ...base, encoded: { hex: '' } })).toEqual({})
  })

  it('blocks the send while arguments are invalid', () => {
    expect(pickAttachment({ ...base, encoded: { errors: { 0: 'empty' } } })).toBeNull()
  })

  it('sends text for a contract in text mode', () => {
    expect(pickAttachment({ ...base, mode: 'text' })).toEqual({ message: 'hello' })
  })

  it('ignores argument mode once the recipient is no longer a contract', () => {
    expect(pickAttachment({ ...base, toContract: false })).toEqual({ message: 'hello' })
  })

  it('blocks the send while the text payload is invalid', () => {
    expect(pickAttachment({ ...base, mode: 'text', text: null })).toBeNull()
  })

  it('attaches nothing for empty text', () => {
    expect(pickAttachment({ ...base, mode: 'text', text: '' })).toEqual({})
  })
})

describe('attachmentModeFor — what a contract recipient opens with', () => {
  it('opens on arguments when nothing was written yet', () => {
    expect(attachmentModeFor('')).toBe('args')
    expect(attachmentModeFor(null)).toBe('args')
  })

  it('keeps text that was already written in view', () => {
    expect(attachmentModeFor('hello')).toBe('text')
  })
})
