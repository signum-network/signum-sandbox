import { describe, expect, it } from 'vitest'
import { changedSlots, contractStatus, toDataSlots } from './contractData'

describe('toDataSlots', () => {
  it('splits machine data into 8-byte slots and reads them little-endian', () => {
    const [max, one] = toDataSlots('ffffffffffffffff0100000000000000')
    expect(max).toEqual({
      index: 0,
      raw: 'ffffffffffffffff',
      hex: 'ffffffffffffffff',
      decimal: '18446744073709551615',
      signed: '-1',
      text: null,
    })
    expect(one).toMatchObject({ index: 1, hex: '0000000000000001', decimal: '1', signed: null })
  })

  it('reads a short string in stored byte order', () => {
    expect(toDataSlots('6869000000000000')[0].text).toBe('hi')
    expect(toDataSlots('c3a4c3b600000000')[0].text).toBe('äö')
  })

  it('has no text for zeros, control characters or invalid UTF-8', () => {
    expect(toDataSlots('0000000000000000')[0].text).toBeNull()
    expect(toDataSlots('0100000000000000')[0].text).toBeNull()
    expect(toDataSlots('0a00b00000000000')[0].text).toBeNull()
    expect(toDataSlots('c300000000000000')[0].text).toBeNull()
  })

  it('pads a partial trailing slot at its high end, keeping its value', () => {
    const slots = toDataSlots('ffffffffffffffff00e1f505')
    expect(slots).toHaveLength(2)
    expect(slots[1]).toMatchObject({ raw: '00e1f50500000000', decimal: '100000000' })
  })

  it('accepts upper-case hex and an empty stack', () => {
    expect(toDataSlots('0A00000000000000')[0].decimal).toBe('10')
    expect(toDataSlots('')).toEqual([])
  })
})

describe('changedSlots', () => {
  const before = toDataSlots('01000000000000000200000000000000')

  it('marks nothing on first sight', () => {
    expect(changedSlots(null, before).size).toBe(0)
  })

  it('marks nothing when the data is the same', () => {
    expect(changedSlots(before, toDataSlots('01000000000000000200000000000000')).size).toBe(0)
  })

  it('marks exactly the slots that differ', () => {
    const after = toDataSlots('01000000000000000300000000000000')
    expect([...changedSlots(before, after)]).toEqual([1])
  })

  it('marks a slot that did not exist before', () => {
    const grown = toDataSlots('010000000000000002000000000000000100000000000000')
    expect([...changedSlots(before, grown)]).toEqual([2])
  })
})

describe('contractStatus', () => {
  const flags = { dead: false, frozen: false, finished: false, stopped: false, running: false }

  it('is idle with no flag set', () => {
    expect(contractStatus(flags)).toBe('idle')
  })

  it('takes the most final flag', () => {
    expect(contractStatus({ ...flags, running: true, stopped: true })).toBe('stopped')
    expect(contractStatus({ ...flags, stopped: true, finished: true })).toBe('finished')
    expect(contractStatus({ ...flags, finished: true, frozen: true })).toBe('frozen')
    expect(contractStatus({ ...flags, frozen: true, dead: true })).toBe('dead')
  })
})
