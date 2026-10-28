import { describe, expect, it } from 'vitest'
import {
  changedSlots,
  contractPartyId,
  contractStatus,
  knownIds,
  stackLayout,
  wakeThreshold,
  toDataSlots,
} from './contractData'
import { toAddress } from './recipient'

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

  it('has no text for a single character, which is a small number far more often than a word', () => {
    expect(toDataSlots('5500000000000000')[0].text).toBeNull()
    expect(toDataSlots('e282ac0000000000')[0].text).toBeNull()
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

describe('stackLayout', () => {
  // The header of the Construct contract on the sandbox chain: version 3,
  // 38 code pages, 8 data pages, one page each of call and user stack.
  const header = '0300' + '0000' + '2600' + '0800' + '0100' + '0100'

  it('reads where the data ends and the two stacks begin, in slots', () => {
    expect(stackLayout(header + 'ff'.repeat(16))).toEqual({
      dataSlots: 256,
      callStackSlots: 32,
      userStackSlots: 32,
    })
  })

  it('is null for creation bytes too short to hold a header', () => {
    expect(stackLayout('0300')).toBeNull()
    expect(stackLayout('')).toBeNull()
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

  it('reads frozen beside finished or stopped as the ordinary wait for the next call', () => {
    // The node sets frozen on every FIN and STP, so it says nothing on its own.
    expect(contractStatus({ ...flags, finished: true, frozen: true })).toBe('finished')
    expect(contractStatus({ ...flags, stopped: true, frozen: true })).toBe('stopped')
  })

  it('reads frozen while running as a run that ran out of SIGNA', () => {
    expect(contractStatus({ ...flags, running: true, frozen: true })).toBe('outOfFunds')
  })

  it('puts dead above everything, and finished above stopped', () => {
    expect(contractStatus({ ...flags, running: true, frozen: true, dead: true })).toBe('dead')
    expect(contractStatus({ ...flags, stopped: true, finished: true })).toBe('finished')
    expect(contractStatus({ ...flags, running: true, stopped: true })).toBe('stopped')
    expect(contractStatus({ ...flags, running: true })).toBe('running')
  })
})

describe('wakeThreshold', () => {
  const contract = { frozen: true, prevBalanceNQT: '2206600000', minActivation: '300000000' }

  it('is the last balance plus the activation amount, as the node checks it', () => {
    expect(wakeThreshold(contract)).toBe('2506600000')
  })

  it('is null for a contract that is not frozen', () => {
    expect(wakeThreshold({ ...contract, frozen: false })).toBeNull()
  })
})

describe('knownIds', () => {
  // Only id and name are read, so no key derivation (and no crypto adapter) is needed.
  const alice = { id: '9999', address: toAddress('9999', 'TS'), name: 'Alice', passphrase: '' }
  const contacts = {
    '1111': { name: 'Bob', kind: 'account' as const },
    '2222': { name: 'Registry', kind: 'contract' as const },
  }

  it('names owned accounts, contacts and the extras', () => {
    const known = knownIds([alice], contacts, [{ id: '3333', name: 'Creator', contract: false }])
    expect(known.get(alice.id)).toEqual({ id: alice.id, name: 'Alice', contract: false })
    expect(known.get('1111')).toEqual({ id: '1111', name: 'Bob', contract: false })
    expect(known.get('2222')).toEqual({ id: '2222', name: 'Registry', contract: true })
    expect(known.get('3333')?.name).toBe('Creator')
  })

  it('lets an owned account or a contact name win over an extra', () => {
    const known = knownIds([alice], contacts, [
      { id: alice.id, name: 'Creator', contract: false },
      { id: '2222', name: 'This contract', contract: true },
    ])
    expect(known.get(alice.id)?.name).toBe('Alice')
    expect(known.get('2222')?.name).toBe('Registry')
  })

  it('never knows zero, which is what an unset slot holds', () => {
    expect(knownIds([], {}, [{ id: '0', name: 'x', contract: false }]).has('0')).toBe(false)
  })
})

describe('contractPartyId', () => {
  const contacts = { '2222': { name: 'Registry', kind: 'contract' as const } }
  const registry = toAddress('2222', 'TS')

  it('links a contract contact in either role', () => {
    expect(contractPartyId(registry, 'recipient', 'payment', contacts)).toBe('2222')
    expect(contractPartyId(registry, 'sender', 'message', contacts)).toBe('2222')
  })

  it('links the sender of a contract payment even when it is no contact', () => {
    const other = toAddress('4444', 'TS')
    expect(contractPartyId(other, 'sender', 'contractPayment', contacts)).toBe('4444')
    expect(contractPartyId(other, 'recipient', 'contractPayment', contacts)).toBeNull()
  })

  it('does not link anyone else', () => {
    expect(contractPartyId(toAddress('4444', 'TS'), 'recipient', 'payment', contacts)).toBeNull()
  })
})
