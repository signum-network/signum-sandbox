import { describe, expect, it } from 'vitest'
import {
  changedSlots,
  contractPartyId,
  contractStatus,
  knownIds,
  moveSlot,
  slotMatches,
  slotOfValue,
  slotReadings,
  slotValue,
  stackLayout,
  stepHit,
  toPages,
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

describe('slotReadings', () => {
  const read = (machineData: string) => slotReadings(toDataSlots(machineData)[0], 'TS')

  it('reads a short string in stored order', () => {
    expect(read('6869000000000000').string).toBe('hi')
  })

  it('reads a single printable character, which the list would not call text', () => {
    expect(read('5500000000000000').string).toBe('U')
    expect(toDataSlots('5500000000000000')[0].text).toBeNull()
  })

  it('gives signed and unsigned even when they agree, and differ for -1', () => {
    expect(read('0100000000000000')).toMatchObject({ unsigned: '1', signed: '1' })
    expect(read('ffffffffffffffff')).toMatchObject({
      unsigned: '18446744073709551615',
      signed: '-1',
    })
  })

  it('reads 0 as false and as no address', () => {
    expect(read('0000000000000000')).toMatchObject({ bool: false, address: null, string: null })
  })

  it('reads anything else as true and as an address', () => {
    const readings = read('5100ff4d27486770')
    expect(readings.bool).toBe(true)
    expect(readings.address).toBe(toAddress('8099521788498608209', 'TS'))
    expect(readings).toMatchObject({ hex: '706748274dff0051', stored: '5100ff4d27486770' })
  })
})

describe('slotValue', () => {
  const slot = toDataSlots('6869000000000000')[0]

  it('is hex when no type is set, because the list never guesses', () => {
    expect(slotValue(slot, undefined, 'TS')).toBe('0000000000006968')
  })

  it('is the reading of the set type', () => {
    expect(slotValue(slot, 'unsigned', 'TS')).toBe('26984')
    expect(slotValue(slot, 'signed', 'TS')).toBe('26984')
    expect(slotValue(slot, 'string', 'TS')).toBe('"hi"')
    expect(slotValue(slot, 'bool', 'TS')).toBe('true')
    expect(slotValue(slot, 'address', 'TS')).toBe(toAddress('26984', 'TS'))
  })

  it('says so when the set type has no reading, rather than falling back', () => {
    const zero = toDataSlots('0000000000000000')[0]
    expect(slotValue(zero, 'address', 'TS')).toBe('—')
    expect(slotValue(toDataSlots('0100000000000000')[0], 'string', 'TS')).toBe('—')
  })
})

describe('slotOfValue', () => {
  it('turns a map value into the slot that would hold it', () => {
    expect(slotOfValue('26984')).toMatchObject({ raw: '6869000000000000', text: 'hi' })
  })

  it('stores a negative value as its two complement', () => {
    expect(slotOfValue('-1')).toMatchObject({ raw: 'ffffffffffffffff', signed: '-1' })
  })
})

describe('slotMatches', () => {
  const known = new Map([['8099521788498608209', { id: '8099521788498608209', name: 'Tester', contract: false }]])
  const context = { addressPrefix: 'TS', known }
  const greeting = toDataSlots('6869000000000000')[0]
  const owner = toDataSlots('5100ff4d27486770')[0]
  const minusOne = toDataSlots('ffffffffffffffff')[0]

  it('matches nothing for an empty query', () => {
    expect(slotMatches(greeting, '', context)).toBe(false)
    expect(slotMatches(greeting, '   ', context)).toBe(false)
  })

  it('finds a value by its decimal, signed or not', () => {
    expect(slotMatches(greeting, '2698', context)).toBe(true)
    expect(slotMatches(minusOne, '-1', context)).toBe(true)
  })

  it('finds a value by its hex, with or without 0x, ignoring case', () => {
    expect(slotMatches(owner, '0x7067', context)).toBe(true)
    expect(slotMatches(owner, '4DFF', context)).toBe(true)
    expect(slotMatches(owner, '5100ff', context)).toBe(true)
  })

  it('finds a string, ignoring case', () => {
    expect(slotMatches(greeting, 'HI', context)).toBe(true)
  })

  it('finds an id by its address or by the name it is known under', () => {
    const address = toAddress('8099521788498608209', 'TS')
    expect(slotMatches(owner, address.toLowerCase(), context)).toBe(true)
    expect(slotMatches(owner, 'test', context)).toBe(true)
  })

  it('finds a slot by its label', () => {
    expect(slotMatches(greeting, 'greet', { ...context, label: 'greeting' })).toBe(true)
  })

  it('does not match what is not there', () => {
    expect(slotMatches(greeting, 'zz', context)).toBe(false)
  })
})

describe('toPages', () => {
  it('splits into the AT pages of 32 slots, keeping each index', () => {
    const pages = toPages(toDataSlots('00'.repeat(8 * 320)))
    expect(pages).toHaveLength(10)
    expect(pages[2][0].index).toBe(64)
  })

  it('keeps a partial last page', () => {
    const pages = toPages(toDataSlots('00'.repeat(8 * 40)))
    expect(pages.map((page) => page.length)).toEqual([32, 8])
  })
})

describe('stepHit', () => {
  const hits = [3, 40, 70]

  it('has nowhere to go without hits', () => {
    expect(stepHit([], 5, 1)).toBeNull()
    expect(stepHit([], null, -1)).toBeNull()
  })

  it('steps from a hit to its neighbours', () => {
    expect(stepHit(hits, 40, 1)).toBe(70)
    expect(stepHit(hits, 40, -1)).toBe(3)
  })

  it('steps from a slot between hits to the nearest one that way', () => {
    expect(stepHit(hits, 10, 1)).toBe(40)
    expect(stepHit(hits, 10, -1)).toBe(3)
  })

  it('starts at the first or the last hit from nowhere', () => {
    expect(stepHit(hits, null, 1)).toBe(3)
    expect(stepHit(hits, null, -1)).toBe(70)
  })

  it('wraps around both ways', () => {
    expect(stepHit(hits, 70, 1)).toBe(3)
    expect(stepHit(hits, 80, 1)).toBe(3)
    expect(stepHit(hits, 3, -1)).toBe(70)
    expect(stepHit(hits, 0, -1)).toBe(70)
  })

  it('steps from a single hit to itself', () => {
    expect(stepHit([7], 7, 1)).toBe(7)
    expect(stepHit([7], 7, -1)).toBe(7)
  })
})

describe('moveSlot', () => {
  // Two full pages and a partial third: positions 0–79.
  const count = 80

  it('moves by a row, across page edges, and stops at the ends', () => {
    expect(moveSlot(count, 5, 'ArrowDown')).toBe(6)
    expect(moveSlot(count, 31, 'ArrowDown')).toBe(32)
    expect(moveSlot(count, 32, 'ArrowUp')).toBe(31)
    expect(moveSlot(count, 0, 'ArrowUp')).toBe(0)
    expect(moveSlot(count, 79, 'ArrowDown')).toBe(79)
  })

  it('moves by a page to the same row', () => {
    for (const key of ['ArrowRight', 'PageDown']) expect(moveSlot(count, 5, key)).toBe(37)
    for (const key of ['ArrowLeft', 'PageUp']) expect(moveSlot(count, 37, key)).toBe(5)
  })

  it('stops at the first or last slot when no full page is left', () => {
    expect(moveSlot(count, 60, 'ArrowRight')).toBe(79)
    expect(moveSlot(count, 79, 'PageDown')).toBe(79)
    expect(moveSlot(count, 20, 'ArrowLeft')).toBe(0)
  })

  it('goes to either end with Home and End', () => {
    expect(moveSlot(count, 40, 'Home')).toBe(0)
    expect(moveSlot(count, 40, 'End')).toBe(79)
  })

  it('ignores other keys', () => {
    expect(moveSlot(count, 40, 'a')).toBeNull()
    expect(moveSlot(count, 40, 'Enter')).toBeNull()
  })
})
